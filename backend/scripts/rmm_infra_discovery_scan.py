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
import http.client
import ipaddress
import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from urllib.parse import quote
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
        "--snmp-walk-oid",
        default="1.3.6.1.2.1.1",
        help="SNMP walk base OID (default system tree)",
    )
    parser.add_argument("--rmm-host", default="", help="Tactical RMM host, e.g. https://rmmapi.example.com")
    parser.add_argument("--rmm-api-key", default="", help="Tactical RMM API key")
    parser.add_argument("--rmm-api-key-header", default="X-API-KEY", help="Tactical API key header")
    parser.add_argument("--rmm-agent-id", default="", help="Agent ID for subnet derivation")
    parser.add_argument("--derive-prefix", type=int, default=24, help="CIDR prefix for derived subnets")
    parser.add_argument(
        "--auto-local-prefix",
        type=int,
        default=24,
        help="CIDR prefix for local interface fallback derivation",
    )
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


def _snmp_walk_summary(ip: str, community: str, timeout_seconds: int, walk_oid: str) -> Dict[str, str]:
    walk_bin = shutil.which("snmpwalk")
    if walk_bin:
        cmd = [
            walk_bin,
            "-v2c",
            "-c",
            community,
            "-t",
            str(max(1, timeout_seconds)),
            "-r",
            "0",
            ip,
            walk_oid or "1.3.6.1.2.1.1",
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if proc.returncode == 0:
                lines = [line.strip() for line in (proc.stdout or "").splitlines() if line.strip()]
                summary = {"sysdescr": "", "sysname": ""}
                for line in lines:
                    lower = line.lower()
                    if (".1.3.6.1.2.1.1.1.0" in lower or "sysdescr" in lower) and not summary["sysdescr"]:
                        summary["sysdescr"] = line
                    if (".1.3.6.1.2.1.1.5.0" in lower or "sysname" in lower) and not summary["sysname"]:
                        summary["sysname"] = line
                if not summary["sysdescr"] and lines:
                    summary["sysdescr"] = lines[0]
                return summary
        except Exception:
            pass
    # Fallback to single OID probe when snmpwalk isn't available.
    sysdescr = _snmp_probe(ip, community, timeout_seconds)
    return {"sysdescr": sysdescr, "sysname": ""}


def _iter_cidr_hosts(cidr: str) -> List[str]:
    network = ipaddress.ip_network(cidr, strict=False)
    return [str(ip) for ip in network.hosts()]


def _http_get_json(url: str, headers: Dict[str, str], timeout: int = 12) -> object:
    req = urllib.request.Request(url, method="GET", headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        raw = response.read().decode("utf-8", errors="replace").strip()
    if not raw:
        return {}
    return json.loads(raw)


def _build_rmm_headers(api_key: str, header_name: str) -> Dict[str, str]:
    key = str(api_key or "").strip()
    hdr = str(header_name or "X-API-KEY").strip() or "X-API-KEY"
    headers = {"Accept": "application/json"}
    if not key:
        return headers
    value = key
    if hdr.lower() == "authorization" and not key.lower().startswith(("bearer ", "token ")):
        value = f"Bearer {key}"
    headers[hdr] = value
    if hdr.lower() != "x-api-key":
        headers["X-API-KEY"] = key
    return headers


def _extract_ips_recursive(node: object, out: Set[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            key_text = str(key or "").strip().lower()
            if key_text in {"ip", "local_ip", "ip_address", "address"} and isinstance(value, str):
                candidate = value.strip()
                try:
                    ipaddress.ip_address(candidate)
                    out.add(candidate)
                except Exception:
                    pass
            _extract_ips_recursive(value, out)
        return
    if isinstance(node, list):
        for item in node:
            _extract_ips_recursive(item, out)
        return
    if isinstance(node, str):
        token = node.strip()
        try:
            ipaddress.ip_address(token)
            out.add(token)
        except Exception:
            pass


def _derive_subnets_from_rmm_agent(
    rmm_host: str,
    rmm_api_key: str,
    rmm_api_key_header: str,
    rmm_agent_id: str,
    prefix: int,
) -> List[str]:
    host = str(rmm_host or "").strip().rstrip("/")
    agent_id = str(rmm_agent_id or "").strip()
    if not host or not rmm_api_key or not agent_id:
        return []
    headers = _build_rmm_headers(rmm_api_key, rmm_api_key_header)
    endpoints = [
        f"{host}/api/v3/agents/{quote(agent_id)}/",
        f"{host}/api/v3/agents/{quote(agent_id)}",
        f"{host}/api/v3/agents?agent_id={quote(agent_id)}",
        f"{host}/api/v3/agents/?agent_id={quote(agent_id)}",
    ]
    payload = None
    for url in endpoints:
        try:
            payload = _http_get_json(url, headers=headers)
            if payload:
                break
        except Exception:
            continue
    if payload is None:
        return []
    if isinstance(payload, dict):
        data = payload.get("results") if isinstance(payload.get("results"), list) else payload
        if isinstance(data, list) and data:
            payload = data[0]
        elif isinstance(data, dict):
            payload = data
    ips: Set[str] = set()
    _extract_ips_recursive(payload, ips)
    cidrs: Set[str] = set()
    safe_prefix = max(16, min(30, int(prefix or 24)))
    for ip in ips:
        try:
            addr = ipaddress.ip_address(ip)
            if not addr.is_private:
                continue
            network = ipaddress.ip_network(f"{ip}/{safe_prefix}", strict=False)
            cidrs.add(str(network))
        except Exception:
            continue
    return sorted(cidrs)


def _is_private_candidate(ip_text: str) -> bool:
    try:
        ip_obj = ipaddress.ip_address(str(ip_text or "").strip())
        if not isinstance(ip_obj, ipaddress.IPv4Address):
            return False
        if ip_obj.is_loopback or ip_obj.is_link_local:
            return False
        return bool(ip_obj.is_private)
    except Exception:
        return False


def _derive_subnets_from_windows_ipconfig() -> List[str]:
    try:
        proc = subprocess.run(["ipconfig"], capture_output=True, text=True, check=False)
    except Exception:
        return []
    if proc.returncode != 0:
        return []
    text = f"{proc.stdout or ''}\n{proc.stderr or ''}"
    blocks = re.split(r"\n\s*\n", text)
    subnets: Set[str] = set()
    ip_pattern = re.compile(r"(\d{1,3}(?:\.\d{1,3}){3})")
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if not lines:
            continue
        ip_value = ""
        mask_value = ""
        for line in lines:
            lower = line.lower()
            matches = ip_pattern.findall(line)
            if not matches:
                continue
            if ("ipv4" in lower or "ipv4-adresse" in lower or "ipv4 address" in lower) and not ip_value:
                for candidate in matches:
                    if _is_private_candidate(candidate):
                        ip_value = candidate
                        break
            if ("subnet" in lower or "maske" in lower) and not mask_value:
                mask_value = matches[-1]
        if ip_value and mask_value:
            try:
                network = ipaddress.ip_network(f"{ip_value}/{mask_value}", strict=False)
                subnets.add(str(network))
            except Exception:
                continue
    return sorted(subnets)


def _derive_subnets_from_local_interfaces(default_prefix: int) -> List[str]:
    cidrs: Set[str] = set()
    if _is_windows():
        for cidr in _derive_subnets_from_windows_ipconfig():
            cidrs.add(cidr)
    fallback_ips: Set[str] = set()
    try:
        local_name = socket.gethostname()
        for entry in socket.getaddrinfo(local_name, None, socket.AF_INET):
            ip_value = str(entry[4][0] or "").strip()
            if _is_private_candidate(ip_value):
                fallback_ips.add(ip_value)
    except Exception:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.connect(("8.8.8.8", 53))
        probe_ip = str(probe.getsockname()[0] or "").strip()
        probe.close()
        if _is_private_candidate(probe_ip):
            fallback_ips.add(probe_ip)
    except Exception:
        pass
    safe_prefix = max(16, min(30, int(default_prefix or 24)))
    for ip_value in fallback_ips:
        try:
            network = ipaddress.ip_network(f"{ip_value}/{safe_prefix}", strict=False)
            cidrs.add(str(network))
        except Exception:
            continue
    return sorted(cidrs)


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
    snmp_walk_oid: str,
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
                walk = _snmp_walk_summary(ip, snmp_community, snmp_timeout_seconds, snmp_walk_oid)
                sysdescr = str(walk.get("sysdescr") or "").strip()
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
            partial_response = False
            try:
                payload_bytes = response.read()
            except http.client.IncompleteRead as exc:
                # Backend already accepted the request body; tolerate truncated response body.
                partial_response = True
                payload_bytes = exc.partial or b""
            payload = payload_bytes.decode("utf-8", errors="replace")
            if not payload:
                return {"status": "ok", **({"warning": "incomplete_response"} if partial_response else {})}
            try:
                parsed = json.loads(payload)
            except json.JSONDecodeError:
                parsed = {}
            if isinstance(parsed, dict) and parsed:
                if partial_response:
                    parsed.setdefault("warning", "incomplete_response")
                return parsed
            return {"status": "ok", **({"warning": "incomplete_response"} if partial_response else {})}
    except urllib.error.HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Discovery upload failed ({exc.code}): {message}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Discovery upload failed: {exc}") from exc


def _emit_history_discovery_payload(
    *,
    customer_id: Optional[int],
    customer_number: str,
    customer_name: str,
    source: str,
    subnets: List[str],
    hosts: List[DiscoveredHost],
) -> None:
    now_ms = _now_ms()
    payload_items = []
    for host in hosts:
        payload_items.append(
            {
                "ip": host.ip,
                "hostname": host.hostname,
                "mac": host.mac,
                "protocol": host.protocol,
                "device_type": host.device_type,
                "vendor": host.vendor,
                "confidence": int(host.confidence),
                "evidence": host.evidence[:6],
                "managed": bool(host.managed),
                "seen_at": now_ms,
            }
        )
    payload = {
        "version": 1,
        "generated_at": now_ms,
        "customer_id": customer_id,
        "customer_number": customer_number,
        "customer_name": customer_name,
        "source": source,
        "subnets": [str(item).strip() for item in (subnets or []) if str(item).strip()],
        "count": len(payload_items),
        "items": payload_items,
    }
    # Keep a machine-readable payload in Tactical RMM script history so
    # downstream systems can pull complete discovery inventory even if API
    # ingest is unavailable.
    print("QT_DISCOVERY_JSON_BEGIN")
    print(json.dumps(payload, ensure_ascii=False))
    print("QT_DISCOVERY_JSON_END")


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
    if args.rmm_host and args.rmm_api_key and args.rmm_agent_id:
        derived = _derive_subnets_from_rmm_agent(
            rmm_host=str(args.rmm_host or "").strip(),
            rmm_api_key=str(args.rmm_api_key or "").strip(),
            rmm_api_key_header=str(args.rmm_api_key_header or "X-API-KEY").strip() or "X-API-KEY",
            rmm_agent_id=str(args.rmm_agent_id or "").strip(),
            prefix=max(16, min(30, int(args.derive_prefix or 24))),
        )
        if derived:
            print(f"[INFO] Derived subnets from RMM agent {args.rmm_agent_id}: {', '.join(derived)}")
            subnets.extend(derived)
        else:
            print(f"[WARN] No subnets derived from RMM agent {args.rmm_agent_id}")
    subnets = sorted(set(subnets))
    if not subnets:
        local_subnets = _derive_subnets_from_local_interfaces(
            default_prefix=max(16, min(30, int(args.auto_local_prefix or 24)))
        )
        if local_subnets:
            print(f"[INFO] Derived local subnets from agent interfaces: {', '.join(local_subnets)}")
            subnets.extend(local_subnets)
            subnets = sorted(set(subnets))
        else:
            print("[WARN] Could not derive subnet from local interfaces")
    if not subnets:
        print("[ERROR] Provide at least one --subnet or RMM derivation args (--rmm-host/--rmm-api-key/--rmm-agent-id)")
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
        snmp_walk_oid=str(args.snmp_walk_oid or "1.3.6.1.2.1.1").strip(),
        managed_ips=managed_ips,
    )
    print(f"[INFO] Hosts discovered: {len(discovered)}")
    _emit_history_discovery_payload(
        customer_id=args.customer_id,
        customer_number=str(args.customer_number or "").strip(),
        customer_name=str(args.customer_name or "").strip(),
        source=str(args.source or "rmm_agent_scan").strip() or "rmm_agent_scan",
        subnets=subnets,
        hosts=discovered,
    )

    try:
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
    except Exception as exc:
        print(f"[ERROR] Discovery upload failed: {exc}")
        return 1

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
