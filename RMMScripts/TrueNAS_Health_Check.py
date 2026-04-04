#!/usr/bin/env python3

import argparse
import html
import json
import re
import ssl
import sys
import urllib.error
import urllib.request


def build_url(host: str, path: str) -> str:
    host = host.strip()
    if not host:
        raise ValueError("host is empty")
    if not host.startswith(("http://", "https://")):
        host = "https://" + host
    return host.rstrip("/") + path


def api_get(url: str, api_key: str, ignore_ssl_errors: bool):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    request = urllib.request.Request(url, headers=headers, method="GET")
    context = None
    if ignore_ssl_errors:
        context = ssl._create_unverified_context()
    with urllib.request.urlopen(request, context=context, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def join_items(items):
    return ", ".join(str(item).strip() for item in items if str(item).strip())


def clean_alert_text(value):
    text = html.unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    text = " ".join(text.split())
    return text.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="TrueNAS health check for RMM")
    parser.add_argument("--host", required=True, help="TrueNAS host or base URL")
    parser.add_argument("--api-key", required=True, help="TrueNAS API key")
    parser.add_argument("--ignore-boot-pool", action="store_true")
    parser.add_argument("--fail-on-warning", action="store_true")
    parser.add_argument("--ignore-ssl-errors", action="store_true")
    parser.add_argument("--max-alerts", type=int, default=3)
    args = parser.parse_args()

    if args.max_alerts < 1:
        print("CRITICAL - --max-alerts must be >= 1")
        return 1

    try:
        pools = api_get(
            build_url(args.host, "/api/v2.0/pool"),
            args.api_key,
            args.ignore_ssl_errors,
        )
    except (ValueError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"CRITICAL - TrueNAS pool query failed: {exc}")
        return 1
    except Exception as exc:
        print(f"CRITICAL - Unexpected pool query error: {exc}")
        return 1

    if args.ignore_boot_pool:
        pools = [pool for pool in pools if pool.get("name") != "boot-pool"]

    if not pools:
        print("CRITICAL - No pools found.")
        return 1

    pool_problems = []
    pool_healthy = []
    pool_activity = []

    for pool in pools:
        name = str(pool.get("name") or "unknown-pool")
        status = str(pool.get("status") or "UNKNOWN")
        healthy_flag = pool.get("healthy")
        if healthy_flag is None:
            healthy_flag = status == "ONLINE"

        if not healthy_flag or status != "ONLINE":
            detail = str(pool.get("status_detail") or "").strip()
            if detail:
                pool_problems.append(f"{name}={status} ({detail})")
            else:
                pool_problems.append(f"{name}={status}")
        else:
            pool_healthy.append(name)

        scan = pool.get("scan") or {}
        scan_function = str(scan.get("function") or "").strip()
        scan_state = str(scan.get("state") or "").strip()
        if scan_function and scan_state and scan_state not in {"FINISHED", "NONE"}:
            percentage = scan.get("percentage")
            if percentage is not None:
                try:
                    percentage = round(float(percentage), 1)
                    pool_activity.append(f"{name} {scan_function} {scan_state} {percentage}%")
                except (TypeError, ValueError):
                    pool_activity.append(f"{name} {scan_function} {scan_state}")
            else:
                pool_activity.append(f"{name} {scan_function} {scan_state}")

    fail_levels = {"ERROR", "CRITICAL", "ALERT", "EMERGENCY"}
    if args.fail_on_warning:
        fail_levels.add("WARNING")

    try:
        alerts = api_get(
            build_url(args.host, "/api/v2.0/alert/list"),
            args.api_key,
            args.ignore_ssl_errors,
        )
    except (ValueError, urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError) as exc:
        print(f"CRITICAL - TrueNAS alert query failed: {exc}")
        return 1
    except Exception as exc:
        print(f"CRITICAL - Unexpected alert query error: {exc}")
        return 1

    alert_messages = []
    for alert in alerts:
        if alert.get("dismissed") is True:
            continue
        level = str(alert.get("level") or "").upper()
        if level not in fail_levels:
            continue
        text = clean_alert_text(alert.get("formatted") or alert.get("text") or "")
        if not text:
            text = str(alert.get("klass") or "Unknown alert").strip()
        alert_messages.append(f"{level}: {text}")
        if len(alert_messages) >= args.max_alerts:
            break

    if pool_problems or alert_messages:
        parts = []
        if pool_problems:
            parts.append("Pool issues: " + join_items(pool_problems))
        if alert_messages:
            parts.append("Alerts: " + join_items(alert_messages))
        print("CRITICAL - " + " | ".join(parts))
        return 1

    ok_parts = ["Pools healthy: " + join_items(pool_healthy)]
    if pool_activity:
        ok_parts.append("Activity: " + join_items(pool_activity))
    print("OK - " + " | ".join(ok_parts))
    return 0


if __name__ == "__main__":
    sys.exit(main())
