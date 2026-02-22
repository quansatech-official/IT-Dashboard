#!/usr/bin/env python3
"""
Minimal infrastructure discovery scanner for Tactical RMM agents.

Features:
- Ping sweep for one or multiple CIDR ranges
- Optional SNMP probe via local snmpget binary (if available)
- Uploads unmanaged/managed device snapshots to IT-Dashboard backend
- Local cache TTL to avoid scanning too frequently
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Dict, List, Optional, Set


def _now_ms() -> int:
    return int(time.time() * 1000)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Infrastructure discovery scanner")
    parser.add_argument("--api-url", required=True, help="Base API URL, e.g. https://dashboard.example.com/api")
    parser.add_argument("--discovery-token", default="", help="Optional X-Discovery-Token")
    parser.add_argument("--customer-id", type=int, default=None, help="Optional internal customer id")
    parser.add_argument("--customer-number", default="", help="Optional customer number")
    parser.add_argument("--customer-name", default="", help="Optional customer name")
    parser.add_argument("--source", default="rmm_agent_scan", help="Source marker for backend rows")
    parser.add_argument(
        "--subnet",
        action="append",
        default=[],
        help="CIDR subnet to scan (repeatable), e.g. 192.168.100.0/24",
    )
    parser.add_argument("--timeout-ms", type=int, default=800, help="Ping timeout in milliseconds")
    parser.add_argument("--snmp", action="store_true", help="Enable SNMP probe (requires snmpget in PATH)")
    parser.add_argument("--snmp-community", default="public", help="SNMP v2c community")
    parser.add_argument("--snmp-timeout-seconds", type=int, default=2, help="SNMP probe timeout")
    parser.add_argument(
        "--managed-ip",
        action="append",
        default=[],
        help="Mark IP as managed (repeatable). Useful when combining with RMM inventory.",
    )
    parser.add_argument(
        "--cache-file",
        default="/tmp/qt_infra_scan_cache.json",
        help="Path to local cache file",
    )
    parser.add_argument("--cache-ttl-seconds", type=int, default=1800, help="Skip scan if cache is fresh")
    parser.add_argument("--force", action="store_true", help="Ignore cache")
    return parser.parse_args()


def _normalize_api_url(value: str) -> str:
    base = str(value or "").strip().rstrip("/")
    if not base:
        return ""
    if not base.endswith("/api"):
        if "/api/" in base:
            base = base.split("/api/")[0] + "/api"
        elif "/api" not in base:
            base = base + "/api"
    return base


def _load_cache(cache_file: str) -> Dict[str, object]:
    try:
        with open(cache_file, "r", encoding="utf-8") as handle:
            raw = json.load(handle)
        if isinstance(raw, dict):
            return raw
    except Exception:
        pass
    return {}


def _save_cache(cache_file: str, payload: Dict[str, object]) -> None:
    directory = os.path.dirname(cache_file)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(cache_file, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def _is_windows() -> bool:
    return platform.system().lower().startswith("win")


def _ping_host(ip: str, timeout_ms: int) -> bool:
    if _is_windows():
        cmd = ["ping", "-n", "1", "-w", str(max(200, timeout_ms)), ip]
    else:
        timeout_seconds = max(1, int(round(timeout_ms / 1000)))
        cmd = ["ping", "-c", "1", "-W", str(timeout_seconds), ip]
    try:
        proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return proc.returncode == 0
    except Exception:
        return False


def _resolve_hostname(ip: str) -> str:
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return str(hostname or "").strip()
    except Exception:
        return ""


def _resolve_mac(ip: str) -> str:
    if _is_windows():
        cmd = ["arp", "-a", ip]
    else:
        cmd = ["arp", "-n", ip]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            return ""
        text = f"{proc.stdout}\n{proc.stderr}".lower()
        for token in text.replace("(", " ").replace(")", " ").split():
            cleaned = token.strip()
            if len(cleaned) in (17, 14) and ":" in cleaned:
                return cleaned
            if len(cleaned) == 17 and "-" in cleaned:
                return cleaned.replace("-", ":")
    except Exception:
        return ""
    return ""


def _snmp_probe(ip: str, community: str, timeout_seconds: int) -> str:
    binary = shutil.which("snmpget")
    if not binary:
        return ""
    cmd = [
        binary,
        "-v2c",
        "-c",
        community,
        "-t",
        str(max(1, timeout_seconds)),
        "-r",
        "0",
        ip,
        "1.3.6.1.2.1.1.1.0",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            return ""
        output = (proc.stdout or "") + (proc.stderr or "")
        normalized = output.strip()
        if not normalized:
            return ""
        if "=" in normalized:
            normalized = normalized.split("=", 1)[1].strip()
        if ":" in normalized:
            normalized = normalized.split(":", 1)[1].strip()
        return normalized
    except Exception:
        return ""


def _iter_cidr_hosts(cidr: str) -> List[str]:
    network = ipaddress.ip_network(cidr, strict=False)
    return [str(ip) for ip in network.hosts()]


@dataclass
class DiscoveredHost:
    ip: str
    hostname: str
    mac: str
    protocol: str
    device_type: str
    vendor: str
    confidence: int
    evidence: List[str]
    managed: bool


OUI_VENDOR_MAP: Dict[str, str] = {
    "B827EB": "Raspberry Pi",
    "D850E6": "Ubiquiti",
    "F09FC2": "Ubiquiti",
    "001B63": "Cisco",
    "000C29": "VMware",
    "005056": "VMware",
    "3CD92B": "HPE",
    "001560": "HP",
    "001C42": "Parallels",
    "F4EC38": "Netgear",
    "001D7E": "Fortinet",
    "AC9E17": "MikroTik",
    "2CF05D": "QNAP",
    "001132": "Synology",
}


def _mac_oui_prefix(mac: str) -> str:
    text = str(mac or "").strip().upper()
    compact = "".join(ch for ch in text if ch in "0123456789ABCDEF")
    return compact[:6] if len(compact) >= 6 else ""


def _infer_from_hostname(hostname: str) -> Optional[tuple[str, int, str]]:
    name = str(hostname or "").strip().lower()
    if not name:
        return None
    rules = [
        ("firewall", ["fw", "firewall", "fortigate", "pfsense", "sophos"], 75),
        ("switch", ["switch", "sw", "core-sw"], 70),
        ("access_point", ["ap", "wlan", "wifi", "access-point"], 70),
        ("printer", ["printer", "drucker", "hp-", "xerox", "canon"], 80),
        ("nas", ["nas", "synology", "qnap"], 80),
        ("server", ["srv", "server", "dc", "sql"], 65),
        ("workstation", ["pc-", "ws-", "client", "laptop", "notebook"], 55),
    ]
    for device_type, patterns, score in rules:
        for pattern in patterns:
            if pattern in name:
                return device_type, score, f"hostname:{pattern}"
    return None


def _infer_from_sysdescr(sysdescr: str) -> Optional[tuple[str, str, int, List[str]]]:
    text = str(sysdescr or "").strip().lower()
    if not text:
        return None
    vendor = ""
    for keyword, name in [
        ("fortinet", "Fortinet"),
        ("cisco", "Cisco"),
        ("mikrotik", "MikroTik"),
        ("ubiquiti", "Ubiquiti"),
        ("hewlett packard", "HPE"),
        ("hp ", "HP"),
        ("synology", "Synology"),
        ("qnap", "QNAP"),
        ("windows", "Microsoft"),
        ("linux", "Linux"),
    ]:
        if keyword in text:
            vendor = name
            break
    type_rules = [
        ("firewall", ["firewall", "fortigate", "pfsense", "sophos"], 88),
        ("switch", ["switch", "routeros", "ios xe", "procurve"], 82),
        ("access_point", ["access point", "wireless", "wifi"], 82),
        ("nas", ["nas", "synology", "qnap"], 90),
        ("printer", ["printer", "laserjet", "xerox", "canon"], 92),
        ("server", ["windows server", "linux", "esxi", "hyper-v"], 72),
    ]
    for device_type, patterns, score in type_rules:
        for pattern in patterns:
            if pattern in text:
                evidence = [f"snmp_sysdescr:{pattern}"]
                if vendor:
                    evidence.append(f"snmp_vendor:{vendor}")
                return device_type, vendor, score, evidence
    if vendor:
        return "unknown", vendor, 45, [f"snmp_vendor:{vendor}"]
    return None


def _discover_hosts(
    subnets: List[str],
    timeout_ms: int,
    snmp_enabled: bool,
    snmp_community: str,
    snmp_timeout_seconds: int,
    managed_ips: Set[str],
) -> List[DiscoveredHost]:
    results: List[DiscoveredHost] = []
    seen_ips: Set[str] = set()
    for subnet in subnets:
        try:
            targets = _iter_cidr_hosts(subnet)
        except Exception:
            print(f"[WARN] Invalid subnet skipped: {subnet}")
            continue
        print(f"[INFO] Scanning subnet {subnet} ({len(targets)} hosts)")
        for ip in targets:
            if ip in seen_ips:
                continue
            alive = _ping_host(ip, timeout_ms)
            if not alive:
                continue
            hostname = _resolve_hostname(ip)
            mac = _resolve_mac(ip)
            protocol = "ping"
            sysdescr = ""
            if snmp_enabled:
                sysdescr = _snmp_probe(ip, snmp_community, snmp_timeout_seconds)
            if sysdescr:
                protocol = "snmp"
            evidence: List[str] = []
            inferred_type = "unknown"
            inferred_vendor = ""
            confidence = 20
            if hostname:
                hostname_guess = _infer_from_hostname(hostname)
                if hostname_guess:
                    inferred_type, host_score, host_evidence = hostname_guess
                    confidence = max(confidence, host_score)
                    evidence.append(host_evidence)
            if mac:
                oui = _mac_oui_prefix(mac)
                vendor_guess = OUI_VENDOR_MAP.get(oui)
                if vendor_guess:
                    inferred_vendor = vendor_guess
                    confidence = max(confidence, 55)
                    evidence.append(f"mac_oui:{oui}")
            if sysdescr:
                snmp_guess = _infer_from_sysdescr(sysdescr)
                if snmp_guess:
                    snmp_type, snmp_vendor, snmp_score, snmp_evidence = snmp_guess
                    if snmp_type and snmp_type != "unknown":
                        inferred_type = snmp_type
                    if snmp_vendor:
                        inferred_vendor = snmp_vendor
                    confidence = max(confidence, snmp_score)
                    evidence.extend(snmp_evidence)
            if inferred_type == "unknown" and inferred_vendor:
                confidence = max(confidence, 45)
            if inferred_type == "unknown" and not inferred_vendor:
                evidence.append("basic_ping_only")
            confidence = max(0, min(100, confidence))
            results.append(
                DiscoveredHost(
                    ip=ip,
                    hostname=hostname,
                    mac=mac,
                    protocol=protocol,
                    device_type=inferred_type,
                    vendor=inferred_vendor,
                    confidence=confidence,
                    evidence=evidence[:6],
                    managed=ip in managed_ips,
                )
            )
            seen_ips.add(ip)
    return results


def _post_discovery(
    api_base: str,
    discovery_token: str,
    customer_id: Optional[int],
    customer_number: str,
    customer_name: str,
    source: str,
    hosts: List[DiscoveredHost],
) -> Dict[str, object]:
    endpoint = f"{api_base}/infrastructure/discovery"
    items = []
    now_ms = _now_ms()
    for host in hosts:
        items.append(
            {
                "customer_id": customer_id,
                "customer_number": customer_number,
                "customer_name": customer_name,
                "source": source,
                "hostname": host.hostname,
                "ip": host.ip,
                "mac": host.mac,
                "protocol": host.protocol,
                "device_type": host.device_type,
                "vendor": host.vendor,
                "confidence": int(host.confidence),
                "evidence": host.evidence,
                "managed": host.managed,
                "seen_at": now_ms,
            }
        )
    body = json.dumps({"items": items}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if discovery_token:
        headers["X-Discovery-Token"] = discovery_token
    request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            payload = response.read().decode("utf-8", errors="replace")
            if not payload:
                return {"status": "ok"}
            parsed = json.loads(payload)
            return parsed if isinstance(parsed, dict) else {"status": "ok"}
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Discovery upload failed ({exc.code}): {message}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Discovery upload failed: {exc}") from exc


def main() -> int:
    args = _parse_args()
    api_base = _normalize_api_url(args.api_url)
    if not api_base:
        print("[ERROR] --api-url is required")
        return 2
    if not args.customer_id and not str(args.customer_number or "").strip() and not str(args.customer_name or "").strip():
        print("[ERROR] Provide at least one of --customer-id, --customer-number, --customer-name")
        return 2
    subnets = [str(item).strip() for item in (args.subnet or []) if str(item).strip()]
    if not subnets:
        print("[ERROR] Provide at least one --subnet")
        return 2

    cache_key = "|".join(
        [
            api_base,
            str(args.customer_id or ""),
            str(args.customer_number or "").strip().lower(),
            str(args.customer_name or "").strip().lower(),
            ",".join(sorted(subnets)),
            "snmp" if args.snmp else "nosnmp",
        ]
    )
    cache = _load_cache(args.cache_file)
    if not args.force and isinstance(cache, dict):
        entries = cache.get("entries")
        if isinstance(entries, dict):
            previous = entries.get(cache_key)
            if isinstance(previous, dict):
                cached_at = int(previous.get("cached_at") or 0)
                if cached_at and (_now_ms() - cached_at) < max(60, args.cache_ttl_seconds) * 1000:
                    print("[INFO] Skipping scan due to cache TTL")
                    return 0

    managed_ips: Set[str] = set(str(ip).strip() for ip in (args.managed_ip or []) if str(ip).strip())
    discovered = _discover_hosts(
        subnets=subnets,
        timeout_ms=max(200, args.timeout_ms),
        snmp_enabled=bool(args.snmp),
        snmp_community=str(args.snmp_community or "public"),
        snmp_timeout_seconds=max(1, int(args.snmp_timeout_seconds or 2)),
        managed_ips=managed_ips,
    )
    print(f"[INFO] Hosts discovered: {len(discovered)}")

    response = _post_discovery(
        api_base=api_base,
        discovery_token=str(args.discovery_token or "").strip(),
        customer_id=args.customer_id,
        customer_number=str(args.customer_number or "").strip(),
        customer_name=str(args.customer_name or "").strip(),
        source=str(args.source or "rmm_agent_scan").strip() or "rmm_agent_scan",
        hosts=discovered,
    )
    print(f"[INFO] Upload response: {json.dumps(response, ensure_ascii=False)}")

    cache_entries = cache.get("entries") if isinstance(cache.get("entries"), dict) else {}
    cache_entries[cache_key] = {
        "cached_at": _now_ms(),
        "count": len(discovered),
    }
    cache["entries"] = cache_entries
    _save_cache(args.cache_file, cache)
    return 0


if __name__ == "__main__":
    sys.exit(main())
