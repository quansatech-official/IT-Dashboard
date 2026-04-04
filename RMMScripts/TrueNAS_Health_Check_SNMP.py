#!/usr/bin/env python3

import argparse
import re
import shutil
import subprocess
import sys


DEFAULT_POOL_NAME_OID = "1.3.6.1.4.1.50536.1.1.1.1.2"
DEFAULT_POOL_HEALTH_OID = "1.3.6.1.4.1.50536.1.1.1.1.3"
FALLBACK_POOL_HEALTH_OIDS = [
    "1.3.6.1.4.1.50536.1.1.1.1.3",
    "1.3.6.1.4.1.50536.1.1.1.1.7",
]
HEALTH_CODE_MAP = {
    "0": "ONLINE",
    "1": "DEGRADED",
    "2": "FAULTED",
    "3": "OFFLINE",
    "4": "UNAVAIL",
    "5": "REMOVED",
}
FAIL_HEALTH = {"DEGRADED", "FAULTED", "OFFLINE", "UNAVAIL", "REMOVED"}


def parse_args():
    parser = argparse.ArgumentParser(description="TrueNAS SNMP health check for RMM")
    parser.add_argument("--host", required=True, help="TrueNAS hostname or IP")
    parser.add_argument("--port", type=int, default=161, help="SNMP port")
    parser.add_argument("--community", help="SNMPv2c community")
    parser.add_argument("--username", help="SNMPv3 username")
    parser.add_argument(
        "--security-level",
        choices=("noAuthNoPriv", "authNoPriv", "authPriv"),
        default="authPriv",
        help="SNMPv3 security level",
    )
    parser.add_argument("--auth-protocol", default="SHA", help="SNMPv3 auth protocol")
    parser.add_argument("--auth-password", help="SNMPv3 auth password")
    parser.add_argument("--priv-protocol", default="AES", help="SNMPv3 privacy protocol")
    parser.add_argument("--priv-password", help="SNMPv3 privacy password")
    parser.add_argument("--ignore-boot-pool", action="store_true")
    parser.add_argument("--pool-name-oid", default=DEFAULT_POOL_NAME_OID)
    parser.add_argument("--pool-health-oid", default=DEFAULT_POOL_HEALTH_OID)
    parser.add_argument("--snmpwalk-path", default="snmpwalk")
    parser.add_argument("--timeout-seconds", type=int, default=5)
    parser.add_argument("--retries", type=int, default=1)
    return parser.parse_args()


def validate_args(args):
    if not args.community and not args.username:
        print("CRITICAL - Use --community for SNMPv2c or --username for SNMPv3.")
        return 1

    if args.community and args.username:
        print("CRITICAL - Use either SNMPv2c or SNMPv3, not both.")
        return 1

    if args.username:
        if args.security_level in {"authNoPriv", "authPriv"} and not args.auth_password:
            print("CRITICAL - SNMPv3 requires --auth-password for this security level.")
            return 1
        if args.security_level == "authPriv" and not args.priv_password:
            print("CRITICAL - SNMPv3 authPriv requires --priv-password.")
            return 1

    if args.timeout_seconds < 1:
        print("CRITICAL - --timeout-seconds must be >= 1.")
        return 1

    if args.retries < 0:
        print("CRITICAL - --retries must be >= 0.")
        return 1

    if shutil.which(args.snmpwalk_path) is None:
        print(f"CRITICAL - snmpwalk not found: {args.snmpwalk_path}")
        return 1

    return 0


def build_snmpwalk_command(args, oid):
    command = [
        args.snmpwalk_path,
        "-t",
        str(args.timeout_seconds),
        "-r",
        str(args.retries),
    ]

    if args.community:
        command.extend(["-v2c", "-c", args.community])
    else:
        command.extend(["-v3", "-u", args.username, "-l", args.security_level])
        if args.security_level in {"authNoPriv", "authPriv"}:
            command.extend(["-a", args.auth_protocol, "-A", args.auth_password])
        if args.security_level == "authPriv":
            command.extend(["-x", args.priv_protocol, "-X", args.priv_password])

    command.extend([f"{args.host}:{args.port}", oid])
    return command


def run_snmpwalk(args, oid):
    command = build_snmpwalk_command(args, oid)
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=max(args.timeout_seconds + 2, 5),
        check=False,
    )
    if completed.returncode != 0:
        error_text = (completed.stderr or completed.stdout or "unknown snmpwalk error").strip()
        raise RuntimeError(error_text)
    return completed.stdout


def parse_snmp_table(snmp_output, oid):
    results = {}

    for raw_line in snmp_output.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if "=" not in line:
            continue

        left, right = line.split("=", 1)
        index_match = re.search(r"\.(\d+)\s*$", left.strip())
        if not index_match:
            continue

        index = index_match.group(1)
        value_part = right.strip()

        if ":" in value_part:
            value_part = value_part.split(":", 1)[1].strip()

        value_part = value_part.strip().strip('"')
        if value_part:
            results[index] = value_part

    return results


def normalize_health(value):
    raw = str(value).strip().strip('"')
    if not raw:
        return "UNKNOWN", "empty"

    upper = raw.upper()
    if upper in {"ONLINE", "DEGRADED", "FAULTED", "OFFLINE", "UNAVAIL", "REMOVED"}:
        return upper, raw

    numeric_match = re.search(r"(-?\d+)", raw)
    if numeric_match:
        code = numeric_match.group(1)
        if code in HEALTH_CODE_MAP:
            return HEALTH_CODE_MAP[code], raw
        return "UNKNOWN", raw

    return "UNKNOWN", raw


def looks_like_health_table(values):
    if not values:
        return False

    recognized = 0
    for raw_value in values.values():
        normalized, _ = normalize_health(raw_value)
        if normalized != "UNKNOWN":
            recognized += 1

    return recognized > 0


def load_pool_health(args):
    tried_oids = []
    candidate_oids = [args.pool_health_oid]
    for fallback_oid in FALLBACK_POOL_HEALTH_OIDS:
        if fallback_oid not in candidate_oids:
            candidate_oids.append(fallback_oid)

    for oid in candidate_oids:
        tried_oids.append(oid)
        raw_output = run_snmpwalk(args, oid)
        parsed = parse_snmp_table(raw_output, oid)
        if looks_like_health_table(parsed):
            return oid, parsed

    raise RuntimeError(
        "no usable pool health table found via OIDs: " + ", ".join(tried_oids)
    )


def join_items(items):
    return ", ".join(item for item in items if item)


def main():
    args = parse_args()
    validation_rc = validate_args(args)
    if validation_rc != 0:
        return validation_rc

    try:
        pool_names_raw = run_snmpwalk(args, args.pool_name_oid)
        health_oid_used, pool_health = load_pool_health(args)
    except subprocess.TimeoutExpired:
        print("CRITICAL - SNMP query timed out.")
        return 1
    except RuntimeError as exc:
        print(f"CRITICAL - SNMP query failed: {exc}")
        return 1
    except Exception as exc:
        print(f"CRITICAL - Unexpected SNMP error: {exc}")
        return 1

    pool_names = parse_snmp_table(pool_names_raw, args.pool_name_oid)

    if not pool_names:
        print("CRITICAL - No pool names returned from SNMP.")
        return 1

    problems = []
    healthy = []

    for index, pool_name in sorted(pool_names.items(), key=lambda item: int(item[0])):
        if args.ignore_boot_pool and pool_name == "boot-pool":
            continue

        if index not in pool_health:
            problems.append(f"{pool_name}=NO_HEALTH_DATA")
            continue

        normalized_health, raw_health = normalize_health(pool_health[index])
        if normalized_health == "ONLINE":
            healthy.append(pool_name)
        elif normalized_health in FAIL_HEALTH:
            problems.append(f"{pool_name}={normalized_health}")
        else:
            problems.append(f"{pool_name}=UNKNOWN({raw_health})")

    if not healthy and not problems:
        print("CRITICAL - No pools left to evaluate.")
        return 1

    if problems:
        print("CRITICAL - Pool issues: " + join_items(problems))
        return 1

    print("OK - Pools healthy: " + join_items(healthy) + f" | Health OID: {health_oid_used}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
