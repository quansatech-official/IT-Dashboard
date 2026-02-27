import json
import logging
import os
import re
import random
import threading
import time
import unicodedata
import ipaddress
from typing import Any, Dict, List, Optional, Set, Tuple

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


def _to_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _to_positive_int(value: Any, default: int, minimum: int) -> int:
    try:
        parsed = int(value)
    except Exception:
        return default
    return max(minimum, parsed)


def _to_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


BACKEND_URL = str(os.environ.get("META_HUB_BACKEND_URL") or "http://backend:8000").rstrip("/")
REQUEST_TIMEOUT_SECONDS = float(os.environ.get("META_HUB_TIMEOUT_SECONDS") or "120")
REFRESH_INTERVAL_SECONDS = _to_positive_int(os.environ.get("META_HUB_REFRESH_SECONDS"), default=300, minimum=30)
REFRESH_JITTER_RATIO = max(
    0.0,
    min(
        0.9,
        _to_float(os.environ.get("META_HUB_REFRESH_JITTER_RATIO"), 0.35),
    ),
)
CACHE_FILE = str(os.environ.get("META_HUB_CACHE_FILE") or "/data/customer_development_snapshot.json")
AUTO_REFRESH = _to_bool(os.environ.get("META_HUB_AUTO_REFRESH"), default=True)
SOURCE_INCLUDE_INACTIVE = _to_bool(os.environ.get("META_HUB_SOURCE_INCLUDE_INACTIVE"), default=True)
SOURCE_FULL = _to_bool(os.environ.get("META_HUB_SOURCE_FULL"), default=True)
BYPASS_HEADER_NAME = str(os.environ.get("META_HUB_BYPASS_HEADER") or "X-Meta-Hub-Bypass").strip() or "X-Meta-Hub-Bypass"
BYPASS_HEADER_VALUE = str(os.environ.get("META_HUB_BYPASS_VALUE") or "1").strip() or "1"
INTERNAL_TOKEN = str(os.environ.get("META_HUB_INTERNAL_TOKEN") or "").strip()
INTERNAL_TOKEN_HEADER = str(os.environ.get("META_HUB_INTERNAL_TOKEN_HEADER") or "X-Meta-Hub-Token").strip() or "X-Meta-Hub-Token"
RMM_SNAPSHOT_TIMEOUT_SECONDS = float(os.environ.get("META_HUB_RMM_TIMEOUT_SECONDS") or "30")
MAC_VENDOR_LOOKUP_ENABLED = _to_bool(os.environ.get("META_HUB_MAC_VENDOR_LOOKUP_ENABLED"), default=True)
MAC_VENDOR_API_TEMPLATE = str(
    os.environ.get("META_HUB_MAC_VENDOR_API_TEMPLATE") or "https://api.macvendors.com/{mac}"
).strip()
MAC_VENDOR_TIMEOUT_SECONDS = float(os.environ.get("META_HUB_MAC_VENDOR_TIMEOUT_SECONDS") or "1.8")
MAC_VENDOR_MAX_LOOKUPS_PER_REFRESH = _to_positive_int(
    os.environ.get("META_HUB_MAC_VENDOR_MAX_LOOKUPS_PER_REFRESH"),
    default=30,
    minimum=0,
)
MAC_VENDOR_CACHE_TTL_MS = _to_positive_int(
    os.environ.get("META_HUB_MAC_VENDOR_CACHE_TTL_SECONDS"),
    default=30 * 24 * 60 * 60,
    minimum=60,
) * 1000
AI_PREANALYSIS_ENABLED = _to_bool(os.environ.get("META_HUB_AI_PREANALYSIS_ENABLED"), default=True)
AI_PREANALYSIS_TIMEOUT_SECONDS = float(os.environ.get("META_HUB_AI_TIMEOUT_SECONDS") or "150")
AI_PREANALYSIS_MAX_CUSTOMERS = _to_positive_int(
    os.environ.get("META_HUB_AI_MAX_CUSTOMERS"),
    default=40,
    minimum=1,
)
AI_PREANALYSIS_MAX_JOBS_PER_RUN = _to_positive_int(
    os.environ.get("META_HUB_AI_MAX_JOBS_PER_RUN"),
    default=40,
    minimum=1,
)
AI_PREANALYSIS_TTL_MS = _to_positive_int(
    os.environ.get("META_HUB_AI_TTL_SECONDS"),
    default=6 * 60 * 60,
    minimum=120,
) * 1000
AI_PREANALYSIS_MODES = [
    mode.strip().lower()
    for mode in str(
        os.environ.get("META_HUB_AI_MODES")
        or "summary,analyse,angebot,kundenbericht,mail,leitfaden,aktivierung_mail,aktivierung_call"
    ).split(",")
    if mode.strip()
]

if not logging.getLogger().handlers:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
logger = logging.getLogger("meta_hub")

app = FastAPI(title="Customer Meta Hub", version="1.1.0")
_state_lock = threading.Lock()
_refresh_lock = threading.Lock()
_ai_refresh_lock = threading.Lock()
_stop_event = threading.Event()

_state: Dict[str, Any] = {
    "payload": None,
    "refreshing": False,
    "updatedAt": 0,
    "lastRefreshAt": 0,
    "lastDurationMs": 0,
    "lastError": "",
    "refreshIntervalSeconds": REFRESH_INTERVAL_SECONDS,
    "aiRefreshing": False,
    "aiLastRefreshAt": 0,
    "aiLastDurationMs": 0,
    "aiLastError": "",
}
_mac_vendor_cache: Dict[str, Dict[str, Any]] = {}


class RefreshRequest(BaseModel):
    force: bool = True
    background: bool = False


class SnapshotEnvelope(BaseModel):
    payload: Dict[str, Any]
    cachedAt: int


def _backend_headers(*, include_internal_token: bool = False) -> Dict[str, str]:
    headers = {BYPASS_HEADER_NAME: BYPASS_HEADER_VALUE}
    if include_internal_token and INTERNAL_TOKEN:
        headers[INTERNAL_TOKEN_HEADER] = INTERNAL_TOKEN
    return headers


def _request_backend_json(
    path: str,
    *,
    params: Optional[Dict[str, Any]] = None,
    timeout_seconds: Optional[float] = None,
    include_internal_token: bool = False,
) -> Dict[str, Any]:
    response = requests.get(
        f"{BACKEND_URL}{path}",
        params=params,
        headers=_backend_headers(include_internal_token=include_internal_token),
        timeout=timeout_seconds or REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError(f"Invalid backend payload for {path}")
    return data


def _request_backend_post_json(
    path: str,
    *,
    body: Optional[Dict[str, Any]] = None,
    timeout_seconds: Optional[float] = None,
) -> Dict[str, Any]:
    response = requests.post(
        f"{BACKEND_URL}{path}",
        json=body or {},
        headers={**_backend_headers(), "Content-Type": "application/json"},
        timeout=timeout_seconds or REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise ValueError(f"Invalid backend payload for POST {path}")
    return data


def _runtime_refresh_interval_seconds() -> int:
    with _state_lock:
        current = _state.get("refreshIntervalSeconds")
    return _to_positive_int(current, default=REFRESH_INTERVAL_SECONDS, minimum=30)


def _next_refresh_delay_seconds() -> int:
    base = _runtime_refresh_interval_seconds()
    if REFRESH_JITTER_RATIO <= 0:
        return base
    jitter = int(round(base * REFRESH_JITTER_RATIO))
    if jitter <= 0:
        return base
    randomized = base + random.randint(-jitter, jitter)
    return max(15, randomized)


def _apply_runtime_config(meta_hub_config: Dict[str, Any]) -> None:
    if not isinstance(meta_hub_config, dict):
        return
    refresh_seconds = meta_hub_config.get("refresh_seconds")
    if refresh_seconds is None:
        return
    interval = _to_positive_int(refresh_seconds, default=REFRESH_INTERVAL_SECONDS, minimum=30)
    with _state_lock:
        _state["refreshIntervalSeconds"] = interval


def _snapshot_meta(contexts: List[Dict[str, Any]]) -> Dict[str, Any]:
    neglected = 0
    high_risk = 0
    contractless = 0
    top_priority: List[Dict[str, Any]] = []
    sorted_rows = sorted(
        contexts,
        key=lambda item: (
            -float(item.get("priority") or 0),
            -float(item.get("riskScore") or 0),
            str(item.get("customerName") or ""),
        ),
    )
    for row in contexts:
        if bool(row.get("contactDue")) or bool(row.get("invoiceActivityDue")):
            neglected += 1
        if float(row.get("riskScore") or 0) >= 70:
            high_risk += 1
        if not bool(row.get("hasMaintenanceContract")) and not bool(row.get("isRegieCustomer")):
            contractless += 1
    for row in sorted_rows[:10]:
        top_priority.append(
            {
                "customerId": row.get("customerId"),
                "customerName": row.get("customerName") or "",
                "priority": float(row.get("priority") or 0),
                "riskScore": float(row.get("riskScore") or 0),
            }
        )
    return {
        "customerCount": len(contexts),
        "neglectedCount": neglected,
        "highRiskCount": high_risk,
        "contractlessCount": contractless,
        "topPriority": top_priority,
    }


def _dev_normalize_text(value: Any) -> str:
    text_value = str(value or "").strip().lower()
    text_value = (
        text_value.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    text_value = unicodedata.normalize("NFKD", text_value).encode("ascii", "ignore").decode("ascii")
    text_value = re.sub(r"[^a-z0-9]+", " ", text_value)
    return re.sub(r"\s+", " ", text_value).strip()


def _normalize_customer_number(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    return re.sub(r"[^A-Za-z0-9]+", "", raw).upper()


def _agent_field_text(agent: Dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = agent.get(key)
        if isinstance(value, dict):
            for nested_key in ("name", "display_name", "displayName", "hostname", "title"):
                nested = value.get(nested_key)
                if nested is not None:
                    text = str(nested).strip()
                    if text:
                        return text
            continue
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return ""


def _extract_agent_id(agent: Dict[str, Any]) -> str:
    return str(
        agent.get("agent_id")
        or agent.get("agentId")
        or agent.get("agentid")
        or agent.get("agentID")
        or agent.get("id")
        or ""
    ).strip()


def _agent_is_online(agent: Dict[str, Any]) -> bool:
    value = str(
        agent.get("status")
        or agent.get("agent_status")
        or agent.get("online")
        or agent.get("is_online")
        or ""
    ).strip().lower()
    return value in {"online", "up", "true", "1", "healthy"}


def _extract_agent_warning_error_counts(agent: Dict[str, Any]) -> Tuple[int, int]:
    warning = 0
    error = 0

    for key in ("warning_count", "warnings", "warningCount"):
        warning = max(warning, _safe_int(agent.get(key), default=0))
    for key in ("error_count", "errors", "errorCount"):
        error = max(error, _safe_int(agent.get(key), default=0))

    failing = agent.get("failing_checks") if isinstance(agent.get("failing_checks"), dict) else {}
    if isinstance(failing, dict):
        warning = max(warning, 1 if bool(failing.get("warning")) else 0)
        error = max(error, 1 if bool(failing.get("error")) else 0)

    return warning, error


def _extract_tactical_site_ref_id(node: Any) -> str:
    if not isinstance(node, dict):
        return ""
    for key in (
        "site_id",
        "siteid",
        "client_id",
        "clientid",
        "customer_id",
        "customerid",
        "id",
        "pk",
        "site",
        "client",
        "customer",
    ):
        value = node.get(key)
        if isinstance(value, dict):
            for nested_key in (
                "site_id",
                "siteid",
                "client_id",
                "clientid",
                "customer_id",
                "customerid",
                "id",
                "pk",
            ):
                nested = value.get(nested_key)
                if nested is None:
                    continue
                text_value = str(nested).strip()
                if text_value:
                    return text_value
            continue
        if isinstance(value, (str, int, float)):
            text_value = str(value).strip()
            if not text_value:
                continue
            if key in {"site", "client", "customer"} and re.search(r"\s", text_value):
                continue
            return text_value
    return ""


def _collect_agent_site_ref_ids(agent: Dict[str, Any]) -> List[str]:
    candidate_ids: List[str] = []
    for key in (
        "site_id",
        "siteid",
        "client_id",
        "clientid",
        "customer_id",
        "customerid",
        "site",
        "client",
        "customer",
    ):
        value = agent.get(key)
        if isinstance(value, dict):
            nested_id = _extract_tactical_site_ref_id(value)
            if nested_id:
                candidate_ids.append(nested_id)
            continue
        if isinstance(value, (str, int, float)):
            text_value = str(value).strip()
            if not text_value:
                continue
            if key in {"site", "client", "customer"} and re.search(r"\s", text_value):
                continue
            candidate_ids.append(text_value)
    unique_ids: List[str] = []
    for candidate in candidate_ids:
        if candidate and candidate not in unique_ids:
            unique_ids.append(candidate)
    return unique_ids


def _flatten_client_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        out.append(row)
        sites = row.get("sites")
        if isinstance(sites, list):
            for site in sites:
                if not isinstance(site, dict):
                    continue
                merged_site = dict(site)
                merged_site.setdefault("client_name", row.get("name") or row.get("client_name") or row.get("client"))
                merged_site.setdefault("client", row.get("id") or row.get("client"))
                if "custom_fields" not in merged_site and isinstance(row.get("custom_fields"), list):
                    merged_site["custom_fields"] = row.get("custom_fields")
                out.append(merged_site)
    return out


def _build_custom_field_def_lookup(rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        field_id = str(row.get("id") or row.get("pk") or "").strip()
        if not field_id:
            continue
        lookup[field_id] = row
        normalized = _normalize_customer_number(field_id)
        if normalized:
            lookup[normalized] = row
    return lookup


def _annotate_custom_fields(payload: Any, custom_field_defs: Dict[str, Dict[str, Any]]) -> Any:
    if not isinstance(custom_field_defs, dict) or not custom_field_defs:
        return payload
    if isinstance(payload, list):
        return [_annotate_custom_fields(item, custom_field_defs) for item in payload]
    if not isinstance(payload, dict):
        return payload

    row = dict(payload)
    field_ref_raw: Any = None
    for key in ("field", "field_id", "fieldId", "custom_field", "customField"):
        value = row.get(key)
        if value is None:
            continue
        if isinstance(value, dict):
            for nested_key in ("id", "pk", "field", "field_id", "fieldId"):
                nested_value = value.get(nested_key)
                if nested_value is None:
                    continue
                nested_text = str(nested_value).strip()
                if nested_text:
                    field_ref_raw = nested_text
                    break
            if field_ref_raw is not None:
                break
            continue
        value_text = str(value).strip()
        if value_text:
            field_ref_raw = value_text
            break

    if field_ref_raw is not None:
        field_ref = str(field_ref_raw).strip()
        field_key = _normalize_customer_number(field_ref)
        field_def = custom_field_defs.get(field_ref) or (custom_field_defs.get(field_key) if field_key else None)
        if isinstance(field_def, dict):
            field_name = str(
                field_def.get("name")
                or field_def.get("label")
                or field_def.get("title")
                or ""
            ).strip()
            if field_name and not _agent_field_text(
                row,
                "name",
                "label",
                "field_name",
                "fieldName",
                "title",
                "custom_field_name",
                "customFieldName",
            ):
                row["name"] = field_name
            if field_name and "field_name" not in row and "fieldName" not in row:
                row["field_name"] = field_name

    for key, value in list(row.items()):
        if isinstance(value, (dict, list)):
            row[key] = _annotate_custom_fields(value, custom_field_defs)
    return row


def _resolve_site_context(
    agent: Dict[str, Any],
    *,
    by_id: Dict[str, Dict[str, Any]],
    by_name: Dict[str, Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    for site_ref in _collect_agent_site_ref_ids(agent):
        normalized_ref = _normalize_customer_number(site_ref)
        if site_ref in by_id:
            return by_id[site_ref]
        if normalized_ref and normalized_ref in by_id:
            return by_id[normalized_ref]
    for value in (
        _agent_field_text(agent, "site_name", "site"),
        _agent_field_text(agent, "client_name", "client", "customer"),
    ):
        normalized_name = _dev_normalize_text(value)
        if normalized_name and normalized_name in by_name:
            return by_name[normalized_name]
    return None


def _enrich_agents_with_site_context(
    agents: List[Dict[str, Any]],
    clients: List[Dict[str, Any]],
    custom_field_defs: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    flat_clients = _flatten_client_rows([row for row in clients if isinstance(row, dict)])

    by_id: Dict[str, Dict[str, Any]] = {}
    by_name: Dict[str, Dict[str, Any]] = {}
    for row in flat_clients:
        site_id = _extract_tactical_site_ref_id(row)
        if site_id:
            by_id[site_id] = row
            normalized_id = _normalize_customer_number(site_id)
            if normalized_id:
                by_id[normalized_id] = row
        normalized_name = _dev_normalize_text(
            _agent_field_text(row, "site_name", "site", "name", "client_name", "client", "customer")
        )
        if normalized_name and normalized_name not in by_name:
            by_name[normalized_name] = row

    enriched: List[Dict[str, Any]] = []
    for agent in [row for row in agents if isinstance(row, dict)]:
        row = _annotate_custom_fields(agent, custom_field_defs)
        if not isinstance(row, dict):
            continue
        site_context = _resolve_site_context(row, by_id=by_id, by_name=by_name)
        if isinstance(site_context, dict):
            row["_site_context"] = site_context
            if not _agent_field_text(row, "site", "site_name"):
                site_name = _agent_field_text(site_context, "site", "site_name", "name")
                if site_name:
                    row["site_name"] = site_name
            if not _agent_field_text(row, "client", "client_name", "customer"):
                client_name = _agent_field_text(site_context, "client", "client_name", "customer", "name")
                if client_name:
                    row["client_name"] = client_name
            for field_key in ("custom_fields", "customFields", "fields", "site_custom_fields"):
                field_value = site_context.get(field_key)
                if isinstance(field_value, (dict, list)):
                    row["site_custom_fields"] = _annotate_custom_fields(field_value, custom_field_defs)
                    break
        enriched.append(row)
    return enriched


def _is_customer_number_label(raw_label: Any, preferred_labels: Optional[Set[str]] = None) -> bool:
    label_text = str(raw_label or "").strip().lower()
    if not label_text:
        return False
    compact = re.sub(r"[^a-z0-9]+", "", label_text)
    spaced = re.sub(r"[^a-z0-9]+", " ", label_text).strip()
    if preferred_labels:
        for preferred in preferred_labels:
            preferred_text = str(preferred or "").strip().lower()
            if not preferred_text:
                continue
            preferred_compact = re.sub(r"[^a-z0-9]+", "", preferred_text)
            preferred_spaced = re.sub(r"[^a-z0-9]+", " ", preferred_text).strip()
            if preferred_compact and (compact == preferred_compact or preferred_compact in compact):
                return True
            if preferred_spaced and (spaced == preferred_spaced or preferred_spaced in spaced):
                return True
    if any(
        token in compact
        for token in (
            "kundennummer",
            "kundennr",
            "kundenummer",
            "customernumber",
            "customernr",
            "clientnumber",
            "clientnr",
        )
    ):
        return True
    for phrase in (
        "customer number",
        "customer nr",
        "client number",
        "client nr",
        "kunden nummer",
        "kunden nr",
        "kunde nummer",
        "kunde nr",
    ):
        if phrase in spaced:
            return True
    return False


def _normalize_candidate_number(raw_value: Any) -> str:
    normalized = _normalize_customer_number(raw_value)
    if not normalized:
        return ""
    if normalized in {"NA", "NONE", "NULL", "UNKNOWN", "UNBEKANNT", "KEINE"}:
        return ""
    return normalized


def _extract_value_candidates(raw_value: Any) -> List[Any]:
    values: List[Any] = []
    if raw_value is None:
        return values
    if isinstance(raw_value, (str, int, float)):
        values.append(raw_value)
        return values
    if isinstance(raw_value, list):
        for item in raw_value:
            values.extend(_extract_value_candidates(item))
        return values
    if isinstance(raw_value, dict):
        for nested_key in (
            "value",
            "val",
            "data",
            "content",
            "text",
            "number",
            "customer_number",
            "customernumber",
            "kundennummer",
            "kunden_nummer",
            "kunden_nr",
            "kundennr",
            "custom_field_value",
            "customFieldValue",
            "raw_value",
            "rawValue",
        ):
            if nested_key in raw_value:
                values.extend(_extract_value_candidates(raw_value.get(nested_key)))
        return values
    return values


def _collect_customer_number_candidates(
    node: Any,
    out: Optional[Set[str]] = None,
    preferred_labels: Optional[Set[str]] = None,
) -> Set[str]:
    if out is None:
        out = set()

    if isinstance(node, dict):
        label_candidates = [
            node.get("name"),
            node.get("field"),
            node.get("label"),
            node.get("key"),
            node.get("title"),
            node.get("custom_field_name"),
            node.get("customFieldName"),
            node.get("field_name"),
            node.get("fieldName"),
        ]
        value_candidates = [
            node.get("value"),
            node.get("val"),
            node.get("data"),
            node.get("content"),
            node.get("values"),
            node.get("text"),
            node.get("custom_field_value"),
            node.get("customFieldValue"),
            node.get("field_value"),
            node.get("fieldValue"),
        ]

        for raw_label in label_candidates:
            if not _is_customer_number_label(raw_label, preferred_labels=preferred_labels):
                continue
            for raw_value in value_candidates:
                for candidate_value in _extract_value_candidates(raw_value):
                    normalized = _normalize_candidate_number(candidate_value)
                    if normalized:
                        out.add(normalized)

        for field_container_key in (
            "customField",
            "custom_field",
            "fieldDefinition",
            "field_definition",
            "fieldDef",
            "definition",
        ):
            field_container = node.get(field_container_key)
            if not isinstance(field_container, dict):
                continue
            nested_labels = [
                field_container.get("name"),
                field_container.get("field"),
                field_container.get("label"),
                field_container.get("key"),
                field_container.get("title"),
            ]
            if not any(
                _is_customer_number_label(item, preferred_labels=preferred_labels) for item in nested_labels
            ):
                continue
            for raw_value in value_candidates:
                for candidate_value in _extract_value_candidates(raw_value):
                    normalized = _normalize_candidate_number(candidate_value)
                    if normalized:
                        out.add(normalized)

        for key, value in node.items():
            key_text = str(key or "").strip().lower()
            if _is_customer_number_label(key_text, preferred_labels=preferred_labels) and value is not None:
                for candidate_value in _extract_value_candidates(value):
                    normalized = _normalize_candidate_number(candidate_value)
                    if normalized:
                        out.add(normalized)
            _collect_customer_number_candidates(value, out, preferred_labels=preferred_labels)
    elif isinstance(node, list):
        for item in node:
            _collect_customer_number_candidates(item, out, preferred_labels=preferred_labels)

    return out


def _agent_matches_customer_number(
    agent: Dict[str, Any],
    customer_number: Any,
    preferred_labels: Optional[Set[str]] = None,
) -> bool:
    customer_number_key = _normalize_customer_number(customer_number)
    if not customer_number_key:
        return False

    customer_number_int: Optional[int] = None
    if customer_number_key.isdigit():
        try:
            customer_number_int = int(customer_number_key)
        except Exception:
            customer_number_int = None

    number_candidates = _collect_customer_number_candidates(agent, preferred_labels=preferred_labels)
    if not number_candidates:
        return False
    if customer_number_key in number_candidates:
        return True

    if customer_number_int is not None:
        for candidate in number_candidates:
            if candidate.isdigit():
                try:
                    if int(candidate) == customer_number_int:
                        return True
                except Exception:
                    continue

    customer_digits = re.sub(r"[^0-9]+", "", customer_number_key)
    for candidate in number_candidates:
        if customer_number_key and customer_number_key in candidate:
            return True
        if customer_digits:
            candidate_digits = re.sub(r"[^0-9]+", "", candidate)
            if candidate_digits and candidate_digits == customer_digits:
                return True
    return False


def _agent_matches_customer_name_only(agent: Dict[str, Any], customer_name: Any) -> bool:
    customer_name_term = _dev_normalize_text(customer_name)
    if not customer_name_term:
        return False
    searchable = " ".join([
        _agent_field_text(agent, "site", "site_name"),
        _agent_field_text(agent, "client", "client_name", "customer"),
    ])
    haystack = _dev_normalize_text(searchable)
    padded = f" {haystack} "
    return f" {customer_name_term} " in padded


def _extract_agent_updates(agent: Dict[str, Any], keys: List[str]) -> int:
    for key in keys:
        value = agent.get(key)
        if value is None:
            continue
        parsed = _safe_int(value, default=0)
        if parsed >= 0:
            return parsed
    return 0


def _agent_to_managed_device(agent: Dict[str, Any]) -> Dict[str, Any]:
    warning_count, error_count = _extract_agent_warning_error_counts(agent)
    windows_updates = _extract_agent_updates(agent, ["windows_updates", "windowsUpdates", "windows_patch_count"])
    thirdparty_updates = _extract_agent_updates(agent, ["third_party_updates", "thirdPartyUpdates", "thirdparty_updates"])
    open_cves = _extract_agent_updates(agent, ["open_cves", "openCves", "cve_count"])
    open_updates = _extract_agent_updates(agent, ["open_updates", "openUpdates", "update_count"])
    if open_updates <= 0:
        open_updates = max(0, windows_updates + thirdparty_updates + open_cves)

    return {
        "source": "tactical_rmm",
        "hostname": _agent_field_text(agent, "hostname", "name"),
        "agentId": _extract_agent_id(agent),
        "site": _agent_field_text(agent, "site", "site_name"),
        "client": _agent_field_text(agent, "client", "client_name", "customer"),
        "online": bool(_agent_is_online(agent)),
        "os": _agent_field_text(agent, "operating_system", "operatingSystem", "plat_name", "plat", "platform", "os"),
        "version": _agent_field_text(agent, "version", "agent_version", "agentVersion"),
        "lastSeen": _agent_field_text(agent, "last_seen", "last_seen_time", "lastseen", "last_checkin", "last_ping"),
        "warningCount": warning_count,
        "errorCount": error_count,
        "openUpdates": open_updates,
        "windowsUpdates": windows_updates,
        "thirdPartyUpdates": thirdparty_updates,
        "openCves": open_cves,
        "lifecycle": agent.get("lifecycle") if isinstance(agent.get("lifecycle"), dict) else {},
    }


DISCOVERY_OUI_VENDOR_MAP: Dict[str, str] = {
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


def _normalize_discovery_mac(value: Any) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    text = text.strip("[](){}<>,;")
    if re.fullmatch(r"[0-9a-f]{2}(?:[:-][0-9a-f]{2}){5}", text):
        return text.replace("-", ":")
    if re.fullmatch(r"[0-9a-f]{4}(?:\\.[0-9a-f]{4}){2}", text):
        compact = text.replace(".", "")
        return ":".join(compact[i : i + 2] for i in range(0, 12, 2))
    compact = re.sub(r"[^0-9a-f]", "", text)
    if len(compact) == 12:
        return ":".join(compact[i : i + 2] for i in range(0, 12, 2))
    return ""


def _normalize_discovery_vendor(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    if _dev_normalize_text(text) in {"n a", "na", "unknown", "unbekannt", "none", "null", "kein"}:
        return ""
    return text


def _mac_oui_prefix(mac: str) -> str:
    compact = "".join(ch for ch in str(mac or "").upper() if ch in "0123456789ABCDEF")
    return compact[:6] if len(compact) >= 6 else ""


def _extract_vendor_from_api_payload(payload: Any) -> str:
    if isinstance(payload, str):
        return _normalize_discovery_vendor(payload)
    if isinstance(payload, list):
        for item in payload:
            vendor = _extract_vendor_from_api_payload(item)
            if vendor:
                return vendor
        return ""
    if not isinstance(payload, dict):
        return ""
    for key in (
        "result",
        "data",
        "vendor",
        "manufacturer",
        "company",
        "organization_name",
        "org",
        "name",
    ):
        if key not in payload:
            continue
        value = payload.get(key)
        if isinstance(value, (dict, list)):
            nested_vendor = _extract_vendor_from_api_payload(value)
            if nested_vendor:
                return nested_vendor
            continue
        vendor = _normalize_discovery_vendor(value)
        if vendor:
            return vendor
    return ""


def _lookup_vendor_from_public_api(mac: str, lookup_state: Optional[Dict[str, int]] = None) -> str:
    if not MAC_VENDOR_LOOKUP_ENABLED:
        return ""
    normalized_mac = _normalize_discovery_mac(mac)
    if not normalized_mac:
        return ""
    oui = _mac_oui_prefix(normalized_mac)
    if not oui:
        return ""

    now_ms = int(time.time() * 1000)
    cache_key = oui
    cached = _mac_vendor_cache.get(cache_key)
    if isinstance(cached, dict):
        cached_at = _safe_int(cached.get("cachedAt"), default=0)
        ttl_ms = _safe_int(cached.get("ttlMs"), default=MAC_VENDOR_CACHE_TTL_MS)
        if cached_at > 0 and ttl_ms > 0 and (now_ms - cached_at) < ttl_ms:
            return _normalize_discovery_vendor(cached.get("vendor"))

    if isinstance(lookup_state, dict):
        calls = _safe_int(lookup_state.get("calls"), default=0)
        limit = _safe_int(lookup_state.get("limit"), default=MAC_VENDOR_MAX_LOOKUPS_PER_REFRESH)
        if limit >= 0 and calls >= limit:
            return ""
        lookup_state["calls"] = calls + 1

    template = str(MAC_VENDOR_API_TEMPLATE or "").strip()
    if not template:
        return ""
    if "{mac}" in template:
        url = template.replace("{mac}", normalized_mac)
    else:
        url = f"{template.rstrip('/')}/{normalized_mac}"

    vendor = ""
    ttl_ms = MAC_VENDOR_CACHE_TTL_MS
    try:
        response = requests.get(
            url,
            timeout=max(0.3, float(MAC_VENDOR_TIMEOUT_SECONDS or 1.8)),
            headers={"User-Agent": "QT-MetaHub/1.0"},
        )
        if response.ok:
            content_type = str(response.headers.get("content-type") or "").lower()
            if "json" in content_type:
                try:
                    payload = response.json()
                except Exception:
                    payload = None
                vendor = _extract_vendor_from_api_payload(payload)
            else:
                vendor = _normalize_discovery_vendor(response.text)
        else:
            ttl_ms = 6 * 60 * 60 * 1000
    except Exception:
        ttl_ms = 60 * 60 * 1000

    _mac_vendor_cache[cache_key] = {
        "cachedAt": now_ms,
        "vendor": vendor,
        "ttlMs": ttl_ms if vendor else min(ttl_ms, 6 * 60 * 60 * 1000),
    }
    return vendor


def _normalize_discovery_device_type(value: Any) -> str:
    normalized = _dev_normalize_text(value).replace(" ", "_")
    if not normalized:
        return "unknown"
    if any(token in normalized for token in ("firewall", "fortigate", "pfsense", "sophos", "utm")):
        return "firewall"
    if "switch" in normalized:
        return "switch"
    if any(token in normalized for token in ("router", "gateway")):
        return "router"
    if any(token in normalized for token in ("access_point", "wlan", "wifi", "hotspot")):
        return "access_point"
    if any(token in normalized for token in ("printer", "drucker", "laserjet", "xerox", "canon", "kyocera", "brother")):
        return "printer"
    if any(token in normalized for token in ("nas", "synology", "qnap")):
        return "nas"
    if any(token in normalized for token in ("server", "dc", "rds", "sql", "esxi", "hyper_v")):
        return "server"
    if any(token in normalized for token in ("workstation", "desktop", "laptop", "notebook", "client", "pc")):
        return "workstation"
    if any(token in normalized for token in ("iot", "camera", "sensor", "door")):
        return "iot"
    return "unknown"


def _normalize_discovery_active(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        normalized = value.strip().lower()
        if not normalized:
            return True
        return normalized not in {"0", "false", "no", "off", "inactive"}
    return bool(value)


def _discovery_text_blob(row: Dict[str, Any]) -> str:
    evidence = row.get("evidence") if isinstance(row.get("evidence"), list) else []
    parts = [
        str(row.get("hostname") or ""),
        str(row.get("deviceType") or ""),
        str(row.get("vendor") or ""),
        str(row.get("protocol") or ""),
        " ".join(str(item or "") for item in evidence),
    ]
    return _dev_normalize_text(" ".join(parts))


def _infer_discovery_vendor(row: Dict[str, Any], lookup_state: Optional[Dict[str, int]] = None) -> str:
    existing_vendor = _normalize_discovery_vendor(row.get("vendor"))
    if existing_vendor:
        return existing_vendor
    mac = _normalize_discovery_mac(row.get("mac"))
    if mac:
        oui = _mac_oui_prefix(mac)
        if oui and oui in DISCOVERY_OUI_VENDOR_MAP:
            return DISCOVERY_OUI_VENDOR_MAP[oui]
        api_vendor = _lookup_vendor_from_public_api(mac, lookup_state=lookup_state)
        if api_vendor:
            return api_vendor
    text = _discovery_text_blob(row)
    vendor_hints = [
        ("fortinet", "Fortinet"),
        ("sophos", "Sophos"),
        ("ubiquiti", "Ubiquiti"),
        ("unifi", "Ubiquiti"),
        ("cisco", "Cisco"),
        ("mikrotik", "MikroTik"),
        ("synology", "Synology"),
        ("qnap", "QNAP"),
        ("hewlett packard", "HPE"),
        ("hpe", "HPE"),
        (" hp", "HP"),
        ("xerox", "Xerox"),
        ("kyocera", "Kyocera"),
        ("canon", "Canon"),
        ("brother", "Brother"),
    ]
    for hint, vendor_name in vendor_hints:
        if hint in text:
            return vendor_name
    hostname = str(row.get("hostname") or "").strip().upper()
    if re.match(r"^HP[0-9A-F]{4,}", hostname):
        return "HP"
    if hostname.startswith("NPI"):
        return "Kyocera"
    return ""


def _infer_discovery_device_type(row: Dict[str, Any]) -> str:
    existing_type = _normalize_discovery_device_type(row.get("deviceType"))
    if existing_type != "unknown":
        return existing_type
    text = _discovery_text_blob(row)
    if any(token in text for token in ("firewall", "fortigate", "pfsense", "sophos", "utm")):
        return "firewall"
    if any(token in text for token in (" switch ", "switch", "core sw", "managed switch")):
        return "switch"
    if any(token in text for token in ("router", "gateway", "mikrotik")):
        return "router"
    if any(token in text for token in ("access point", "wifi", "wlan", "unifi", "uck")):
        return "access_point"
    if any(token in text for token in ("printer", "drucker", "laserjet", "xerox", "canon", "kyocera", "brother", "npi", "km9")):
        return "printer"
    if any(token in text for token in (" nas ", "nas ", "synology", "qnap")):
        return "nas"
    if any(token in text for token in ("server", " dc ", " rds ", " sql ", "esxi", "hyper v")):
        return "server"
    if any(token in text for token in ("workstation", "desktop", "laptop", "notebook", " pc ", "pc ", " win ", " nb ")):
        return "workstation"
    if any(token in text for token in ("camera", "sensor", "door", "iot")):
        return "iot"
    return "unknown"


def _sanitize_discovery_row(row: Dict[str, Any]) -> Dict[str, Any]:
    active_raw = row.get("active")
    if active_raw is None:
        active_raw = row.get("is_active")
    sanitized: Dict[str, Any] = {
        "source": str(row.get("source") or "discovery").strip() or "discovery",
        "hostname": str(row.get("hostname") or "").strip(),
        "ip": str(row.get("ip") or "").strip(),
        "mac": _normalize_discovery_mac(row.get("mac")),
        "protocol": str(row.get("protocol") or "").strip().lower(),
        "deviceType": _normalize_discovery_device_type(row.get("deviceType")),
        "vendor": _normalize_discovery_vendor(row.get("vendor")),
        "confidence": max(0, min(100, _safe_int(row.get("confidence"), default=0))),
        "evidence": [str(item).strip() for item in (row.get("evidence") if isinstance(row.get("evidence"), list) else []) if str(item).strip()],
        "managed": bool(row.get("managed")),
        "active": _normalize_discovery_active(active_raw),
        "lastSeenAt": max(0, _safe_int(row.get("lastSeenAt"), default=0)),
    }
    return sanitized


def _merge_discovery_rows(existing: Dict[str, Any], incoming: Dict[str, Any]) -> Dict[str, Any]:
    merged = dict(existing)
    incoming_seen = max(0, _safe_int(incoming.get("lastSeenAt"), default=0))
    existing_seen = max(0, _safe_int(existing.get("lastSeenAt"), default=0))
    is_newer = incoming_seen >= existing_seen

    def _pick_text(key: str) -> None:
        current = str(merged.get(key) or "").strip()
        candidate = str(incoming.get(key) or "").strip()
        if not candidate:
            return
        if not current or (is_newer and len(candidate) >= len(current)):
            merged[key] = candidate

    for key in ("hostname", "ip", "mac", "vendor", "source"):
        _pick_text(key)
    protocol_priority = {"snmp": 3, "wmi": 2, "icmp": 1, "ping": 1, "": 0}
    current_proto = str(merged.get("protocol") or "").strip().lower()
    candidate_proto = str(incoming.get("protocol") or "").strip().lower()
    if protocol_priority.get(candidate_proto, 0) > protocol_priority.get(current_proto, 0):
        merged["protocol"] = candidate_proto

    current_type = _normalize_discovery_device_type(merged.get("deviceType"))
    candidate_type = _normalize_discovery_device_type(incoming.get("deviceType"))
    if current_type == "unknown" and candidate_type != "unknown":
        merged["deviceType"] = candidate_type

    merged["managed"] = bool(merged.get("managed")) or bool(incoming.get("managed"))
    current_active = _normalize_discovery_active(merged.get("active"))
    incoming_active = _normalize_discovery_active(incoming.get("active"))
    if incoming_seen > existing_seen:
        merged["active"] = incoming_active
    elif incoming_seen < existing_seen:
        merged["active"] = current_active
    else:
        merged["active"] = current_active and incoming_active
    merged["confidence"] = max(
        max(0, min(100, _safe_int(merged.get("confidence"), default=0))),
        max(0, min(100, _safe_int(incoming.get("confidence"), default=0))),
    )
    merged["lastSeenAt"] = max(existing_seen, incoming_seen)

    evidence_values: List[str] = []
    for evidence_set in (merged.get("evidence"), incoming.get("evidence")):
        if not isinstance(evidence_set, list):
            continue
        for item in evidence_set:
            text = str(item or "").strip()
            if text and text not in evidence_values:
                evidence_values.append(text)
    merged["evidence"] = evidence_values[:8]
    return merged


def _key_for_discovery_row(row: Dict[str, Any]) -> str:
    ip = str(row.get("ip") or "").strip().lower()
    mac = _normalize_discovery_mac(row.get("mac"))
    host = _dev_normalize_text(row.get("hostname"))
    if mac:
        return f"mac:{mac}"
    if ip:
        return f"ip:{ip}"
    if host:
        return f"host:{host}"
    return ""


def _history_discovery_items_for_agent(
    rmm_snapshot: Dict[str, Any],
    agent_id: str,
) -> List[Dict[str, Any]]:
    if not isinstance(rmm_snapshot, dict):
        return []
    payload_map = rmm_snapshot.get("discoveryPayloadByAgent")
    if not isinstance(payload_map, dict):
        return []
    node = payload_map.get(str(agent_id).strip())
    if not isinstance(node, dict):
        return []
    payload = node.get("payload")
    if not isinstance(payload, dict):
        return []
    items = payload.get("items")
    if not isinstance(items, list):
        return []
    out: List[Dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "source": str(item.get("source") or payload.get("source") or "rmm_history_scan").strip() or "rmm_history_scan",
                "hostname": str(item.get("hostname") or "").strip(),
                "ip": str(item.get("ip") or "").strip(),
                "mac": str(item.get("mac") or "").strip(),
                "protocol": str(item.get("protocol") or "").strip(),
                "deviceType": str(item.get("device_type") or item.get("deviceType") or "").strip(),
                "vendor": str(item.get("vendor") or "").strip(),
                "confidence": _safe_int(item.get("confidence"), default=0),
                "evidence": item.get("evidence") if isinstance(item.get("evidence"), list) else [],
                "managed": bool(item.get("managed")),
                "active": True,
                "lastSeenAt": _safe_int(item.get("seen_at"), default=0),
            }
        )
    return out


def _merge_discovered_devices(
    base: List[Dict[str, Any]],
    incoming: List[Dict[str, Any]],
    *,
    lookup_state: Optional[Dict[str, int]] = None,
) -> List[Dict[str, Any]]:
    merged_by_key: Dict[str, Dict[str, Any]] = {}
    fallback_index = 0
    for raw_row in list(base or []) + list(incoming or []):
        if not isinstance(raw_row, dict):
            continue
        row = _sanitize_discovery_row(raw_row)
        key = _key_for_discovery_row(row)
        if not key:
            fallback_index += 1
            key = f"row:{fallback_index}"
        existing = merged_by_key.get(key)
        if existing is None:
            merged_by_key[key] = row
        else:
            merged_by_key[key] = _merge_discovery_rows(existing, row)

    out: List[Dict[str, Any]] = []
    for row in merged_by_key.values():
        enriched = dict(row)
        enriched["vendor"] = _infer_discovery_vendor(enriched, lookup_state=lookup_state)
        enriched["deviceType"] = _infer_discovery_device_type(enriched)
        confidence = max(0, min(100, _safe_int(enriched.get("confidence"), default=0)))
        if enriched["deviceType"] != "unknown":
            confidence = max(confidence, 55)
        if enriched["vendor"]:
            confidence = max(confidence, 45)
        enriched["confidence"] = confidence
        out.append(enriched)

    def _sort_key(row: Dict[str, Any]) -> Tuple[int, int, int, str, str]:
        ip_text = str(row.get("ip") or "").strip()
        active_rank = 0 if _normalize_discovery_active(row.get("active")) else 1
        try:
            ip_value = int(ipaddress.ip_address(ip_text))
            return (active_rank, 0, ip_value, str(row.get("hostname") or "").lower(), str(row.get("mac") or "").lower())
        except Exception:
            return (active_rank, 1, 0, str(row.get("hostname") or "").lower(), str(row.get("mac") or "").lower())

    out.sort(key=_sort_key)
    return out


def _enrich_payload_with_rmm(raw: Dict[str, Any], rmm_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    payload = dict(raw)
    contexts = payload.get("contexts")
    if not isinstance(contexts, list):
        return payload

    agents = rmm_snapshot.get("agents") if isinstance(rmm_snapshot.get("agents"), list) else []
    clients = rmm_snapshot.get("clients") if isinstance(rmm_snapshot.get("clients"), list) else []
    custom_fields = rmm_snapshot.get("customFields") if isinstance(rmm_snapshot.get("customFields"), list) else []
    connected = bool(rmm_snapshot.get("connected"))
    meta_hub_config = rmm_snapshot.get("metaHubConfig") if isinstance(rmm_snapshot.get("metaHubConfig"), dict) else {}
    rmm_enabled = bool(meta_hub_config.get("rmm_enabled", True))
    preferred_customer_field_name = str(meta_hub_config.get("rmm_customer_field_name") or "").strip()
    preferred_labels = {preferred_customer_field_name} if preferred_customer_field_name else set()

    custom_field_defs = _build_custom_field_def_lookup([row for row in custom_fields if isinstance(row, dict)])
    enriched_agents = (
        _enrich_agents_with_site_context(
            [row for row in agents if isinstance(row, dict)],
            [row for row in clients if isinstance(row, dict)],
            custom_field_defs,
        )
        if rmm_enabled
        else []
    )

    patched_contexts: List[Dict[str, Any]] = []
    total_matched_agents = 0
    vendor_lookup_state: Dict[str, int] = {
        "calls": 0,
        "limit": max(0, int(MAC_VENDOR_MAX_LOOKUPS_PER_REFRESH)),
    }
    for context in contexts:
        if not isinstance(context, dict):
            continue
        row = dict(context)
        customer_number = row.get("customerNumber")
        customer_name = row.get("customerName")

        matched_agents: List[Dict[str, Any]] = []
        name_only_candidates: List[Dict[str, Any]] = []
        if rmm_enabled:
            matched_agents = [
                agent
                for agent in enriched_agents
                if _agent_matches_customer_number(
                    agent,
                    customer_number,
                    preferred_labels=preferred_labels,
                )
            ]
            if not matched_agents:
                name_only_candidates = [
                    agent for agent in enriched_agents if _agent_matches_customer_name_only(agent, customer_name)
                ]

        managed_devices = [_agent_to_managed_device(agent) for agent in matched_agents]
        managed_count = len(managed_devices)
        total_matched_agents += managed_count

        discovered_devices = row.get("discoveredInfrastructureDevices")
        if not isinstance(discovered_devices, list):
            discovered_devices = []
        history_discovery: List[Dict[str, Any]] = []
        for agent in matched_agents:
            agent_id = _extract_agent_id(agent)
            if not agent_id:
                continue
            history_discovery.extend(_history_discovery_items_for_agent(rmm_snapshot, agent_id))
        discovered_devices = _merge_discovered_devices(
            discovered_devices,
            history_discovery,
            lookup_state=vendor_lookup_state,
        )
        active_discovered_devices = [item for item in discovered_devices if _normalize_discovery_active((item or {}).get("active"))]
        discovered_unmanaged = sum(1 for item in active_discovered_devices if not bool((item or {}).get("managed")))
        discovered_total = len(active_discovered_devices) if active_discovered_devices else managed_count
        coverage_ratio = round((managed_count / discovered_total), 2) if discovered_total > 0 else 0.0
        unmanaged_count = max(discovered_total - managed_count, 0) + discovered_unmanaged

        offline_count = sum(1 for item in managed_devices if not bool(item.get("online")))
        offline_rate = round((offline_count / managed_count), 2) if managed_count else 0.0
        warning_count = sum(_safe_int(item.get("warningCount"), default=0) for item in managed_devices)
        error_count = sum(_safe_int(item.get("errorCount"), default=0) for item in managed_devices)
        open_updates = sum(_safe_int(item.get("openUpdates"), default=0) for item in managed_devices)
        windows_updates = sum(_safe_int(item.get("windowsUpdates"), default=0) for item in managed_devices)
        thirdparty_updates = sum(_safe_int(item.get("thirdPartyUpdates"), default=0) for item in managed_devices)
        open_cves = sum(_safe_int(item.get("openCves"), default=0) for item in managed_devices)

        infra = row.get("infra") if isinstance(row.get("infra"), dict) else {}
        infra = dict(infra)
        infra.update(
            {
                "managedAssets": managed_count,
                "discoveredAssets": discovered_total,
                "coverageRatio": coverage_ratio,
                "offlineRate": offline_rate,
                "unmanagedCount": unmanaged_count,
                "warningCount": warning_count,
                "errorCount": error_count,
                "openUpdates": open_updates,
                "windowsUpdates": windows_updates,
                "thirdPartyUpdates": thirdparty_updates,
                "openCves": open_cves,
                "nameOnlyCandidateCount": len(name_only_candidates),
            }
        )
        if managed_count == 0:
            if not rmm_enabled:
                infra["rmmMappingHint"] = "RMM Quelle im Meta-Hub ist deaktiviert."
            elif _normalize_customer_number(customer_number) and name_only_candidates:
                infra["rmmMappingHint"] = (
                    "RMM-Agenten gefunden, aber ohne passende Kundennummer-Zuordnung. "
                    "Bitte Kundennummer im RMM (Client/Site/Agent-Felder) hinterlegen."
                )
            else:
                infra["rmmMappingHint"] = "Keine zugeordneten RMM-Agenten für diesen Kunden gefunden."
        else:
            infra["rmmMappingHint"] = ""

        row["infra"] = infra
        row["managedInfrastructureDevices"] = managed_devices
        row["discoveredInfrastructureDevices"] = discovered_devices
        row["infrastructureDevices"] = managed_devices + discovered_devices

        source = row.get("source") if isinstance(row.get("source"), dict) else {}
        source = dict(source)
        source["tacticalRmm"] = bool(rmm_enabled and (connected or managed_count > 0 or name_only_candidates))
        row["source"] = source

        patched_contexts.append(row)

    payload["contexts"] = patched_contexts
    payload["count"] = len(patched_contexts)
    payload_sources = payload.get("sources") if isinstance(payload.get("sources"), dict) else {}
    payload_sources = dict(payload_sources)
    payload_sources["tacticalRmm"] = bool(rmm_enabled and connected)
    payload_sources["metaHubRmm"] = bool(rmm_enabled and connected)
    payload_sources["metaHubEmail"] = bool(meta_hub_config.get("email_enabled"))
    payload["sources"] = payload_sources
    payload["metaHubRmm"] = {
        "enabled": bool(rmm_enabled),
        "connected": bool(connected),
        "agents": len(enriched_agents),
        "clients": len(clients),
        "customFields": len(custom_fields),
        "matchedAgents": total_matched_agents,
        "generatedAt": int(time.time() * 1000),
        "error": str(rmm_snapshot.get("error") or ""),
        "customerFieldName": preferred_customer_field_name or "Kundennummer",
        "mailboxCount": int(meta_hub_config.get("mailbox_count") or 0),
    }
    return payload


def _fetch_development_payload(force_refresh: bool) -> Dict[str, Any]:
    params = {
        "include_inactive": "1" if SOURCE_INCLUDE_INACTIVE else "0",
        "full": "1" if SOURCE_FULL else "0",
        "refresh": "1" if force_refresh else "0",
    }
    try:
        return _request_backend_json("/api/customer_development", params=params)
    except Exception as exc:
        if not force_refresh:
            raise
        logger.warning(
            "Forced backend refresh failed (%s). Retrying without refresh=1 to use cached payload.",
            exc,
        )
        fallback_params = dict(params)
        fallback_params["refresh"] = "0"
        return _request_backend_json("/api/customer_development", params=fallback_params)


def _fetch_rmm_snapshot() -> Dict[str, Any]:
    if not INTERNAL_TOKEN:
        raise RuntimeError("META_HUB_INTERNAL_TOKEN missing")
    return _request_backend_json(
        "/api/internal/customer_development/rmm_snapshot",
        timeout_seconds=RMM_SNAPSHOT_TIMEOUT_SECONDS,
        include_internal_token=True,
    )


def _fetch_from_backend(force_refresh: bool) -> Dict[str, Any]:
    data = _fetch_development_payload(force_refresh)
    try:
        rmm_snapshot = _fetch_rmm_snapshot()
        runtime_config = rmm_snapshot.get("metaHubConfig") if isinstance(rmm_snapshot.get("metaHubConfig"), dict) else {}
        _apply_runtime_config(runtime_config)
        data = _enrich_payload_with_rmm(data, rmm_snapshot)
    except Exception as exc:
        logger.warning("RMM enrichment skipped: %s", exc)
    if not isinstance(data, dict):
        raise ValueError("Backend payload is not an object")
    return data


def _prepare_payload(raw: Dict[str, Any]) -> Dict[str, Any]:
    now_ms = int(time.time() * 1000)
    contexts_raw = raw.get("contexts") if isinstance(raw, dict) else []
    contexts = [item for item in (contexts_raw or []) if isinstance(item, dict)]
    prepared = {
        "generatedAt": int(raw.get("generatedAt") or now_ms),
        "count": len(contexts),
        "contexts": contexts,
        "sources": raw.get("sources") if isinstance(raw.get("sources"), dict) else {},
        "fromCache": True,
    }
    if isinstance(raw.get("metaHubRmm"), dict):
        prepared["metaHubRmm"] = raw.get("metaHubRmm")
    prepared["metaHub"] = {
        "preparedAt": now_ms,
        "source": "customer-development",
        "sourceIncludeInactive": SOURCE_INCLUDE_INACTIVE,
        "sourceFull": SOURCE_FULL,
        **_snapshot_meta(contexts),
    }
    return prepared


def _copy_existing_ai_preanalysis(target_payload: Dict[str, Any], previous_payload: Optional[Dict[str, Any]]) -> None:
    previous_contexts = previous_payload.get("contexts") if isinstance(previous_payload, dict) else []
    previous_map: Dict[int, Dict[str, Any]] = {}
    for row in previous_contexts or []:
        if not isinstance(row, dict):
            continue
        customer_id = _safe_int(row.get("customerId"))
        if customer_id <= 0:
            continue
        cached = row.get("aiPreanalysis")
        if isinstance(cached, dict) and cached:
            previous_map[customer_id] = dict(cached)
    if not previous_map:
        return
    for row in target_payload.get("contexts") or []:
        if not isinstance(row, dict):
            continue
        customer_id = _safe_int(row.get("customerId"))
        if customer_id <= 0:
            continue
        if customer_id in previous_map and not isinstance(row.get("aiPreanalysis"), dict):
            row["aiPreanalysis"] = dict(previous_map[customer_id])


def _context_priority(context: Dict[str, Any]) -> Tuple[float, float, str]:
    return (
        -float(context.get("priority") or 0),
        -float(context.get("riskScore") or 0),
        str(context.get("customerName") or ""),
    )


def _queue_ai_preanalysis_jobs(payload: Dict[str, Any]) -> List[Tuple[int, str]]:
    if not AI_PREANALYSIS_ENABLED or not AI_PREANALYSIS_MODES:
        return []
    contexts = payload.get("contexts") if isinstance(payload, dict) else []
    ranked = [row for row in (contexts or []) if isinstance(row, dict)]
    ranked.sort(key=_context_priority)
    ranked = ranked[:AI_PREANALYSIS_MAX_CUSTOMERS]

    now_ms = int(time.time() * 1000)
    jobs: List[Tuple[int, str]] = []
    for row in ranked:
        customer_id = _safe_int(row.get("customerId"))
        if customer_id <= 0:
            continue
        per_customer = row.get("aiPreanalysis") if isinstance(row.get("aiPreanalysis"), dict) else {}
        for mode in AI_PREANALYSIS_MODES:
            cached_entry = per_customer.get(mode) if isinstance(per_customer, dict) else None
            cached_at = _safe_int((cached_entry or {}).get("generatedAt"))
            if cached_at > 0 and now_ms - cached_at <= AI_PREANALYSIS_TTL_MS:
                continue
            jobs.append((customer_id, mode))
            if len(jobs) >= AI_PREANALYSIS_MAX_JOBS_PER_RUN:
                return jobs
    return jobs


def _apply_ai_preanalysis_results(results: List[Tuple[int, str, Dict[str, Any]]]) -> None:
    if not results:
        return
    payload_to_save: Optional[Dict[str, Any]] = None
    with _state_lock:
        payload = _state.get("payload")
        if not isinstance(payload, dict):
            return
        contexts = payload.get("contexts") if isinstance(payload.get("contexts"), list) else []
        index_map: Dict[int, Dict[str, Any]] = {}
        for row in contexts:
            if not isinstance(row, dict):
                continue
            customer_id = _safe_int(row.get("customerId"))
            if customer_id > 0:
                index_map[customer_id] = row
        changed = False
        for customer_id, mode, entry in results:
            target = index_map.get(customer_id)
            if not isinstance(target, dict):
                continue
            current = target.get("aiPreanalysis")
            if not isinstance(current, dict):
                current = {}
            next_map = dict(current)
            next_map[mode] = entry
            target["aiPreanalysis"] = next_map
            changed = True
        if not changed:
            return
        meta_hub = payload.get("metaHub") if isinstance(payload.get("metaHub"), dict) else {}
        generated_entries = 0
        for row in contexts:
            if not isinstance(row, dict):
                continue
            cached = row.get("aiPreanalysis")
            if isinstance(cached, dict):
                generated_entries += len(cached)
        payload["metaHub"] = {
            **meta_hub,
            "aiPreanalysisGeneratedAt": int(time.time() * 1000),
            "aiPreanalysisEntries": int(generated_entries),
            "aiPreanalysisModes": list(AI_PREANALYSIS_MODES),
        }
        _state["payload"] = payload
        payload_to_save = payload
    if payload_to_save is not None:
        _save_snapshot(payload_to_save)


def _refresh_ai_preanalysis() -> bool:
    if not AI_PREANALYSIS_ENABLED or not AI_PREANALYSIS_MODES:
        return False
    if not _ai_refresh_lock.acquire(blocking=False):
        return False
    start_ms = int(time.time() * 1000)
    with _state_lock:
        _state["aiRefreshing"] = True
    try:
        with _state_lock:
            payload = _state.get("payload")
            jobs = _queue_ai_preanalysis_jobs(payload if isinstance(payload, dict) else {})
        if not jobs:
            with _state_lock:
                _state["aiLastRefreshAt"] = int(time.time() * 1000)
                _state["aiLastDurationMs"] = max(0, int(time.time() * 1000) - start_ms)
                _state["aiLastError"] = ""
            return True
        results: List[Tuple[int, str, Dict[str, Any]]] = []
        failed_jobs = 0
        last_job_error = ""
        backend_unreachable = False
        for idx, (customer_id, mode) in enumerate(jobs):
            try:
                data = _request_backend_post_json(
                    "/api/customer_development/ai_assist",
                    body={"customer_id": int(customer_id), "mode": str(mode)},
                    timeout_seconds=AI_PREANALYSIS_TIMEOUT_SECONDS,
                )
                text = str(data.get("text") or "").strip()
                if not text:
                    continue
                sources = data.get("sources") if isinstance(data.get("sources"), dict) else {}
                generated_at = _safe_int(data.get("generated_at"), default=int(time.time() * 1000))
                results.append(
                    (
                        int(customer_id),
                        str(mode),
                        {
                            "text": text,
                            "sources": sources,
                            "generatedAt": generated_at,
                            "tone": str(data.get("tone") or "sachlich"),
                        },
                    )
                )
            except Exception as exc:
                failed_jobs += 1
                last_job_error = str(exc)
                if isinstance(exc, requests.RequestException):
                    if not backend_unreachable:
                        logger.warning(
                            "AI preanalysis skipped: backend unreachable (%s). pending_jobs=%s",
                            exc,
                            max(0, len(jobs) - idx),
                        )
                    backend_unreachable = True
                    break
                logger.warning("AI preanalysis failed for customer=%s mode=%s: %s", customer_id, mode, exc)
        _apply_ai_preanalysis_results(results)
        with _state_lock:
            _state["aiLastRefreshAt"] = int(time.time() * 1000)
            _state["aiLastDurationMs"] = max(0, int(time.time() * 1000) - start_ms)
            _state["aiLastError"] = (
                f"{failed_jobs} jobs failed: {last_job_error}" if failed_jobs > 0 else ""
            )
        return True
    except Exception as exc:
        with _state_lock:
            _state["aiLastRefreshAt"] = int(time.time() * 1000)
            _state["aiLastDurationMs"] = max(0, int(time.time() * 1000) - start_ms)
            _state["aiLastError"] = str(exc)
        logger.warning("Meta-hub AI preanalysis refresh failed: %s", exc)
        return False
    finally:
        with _state_lock:
            _state["aiRefreshing"] = False
        _ai_refresh_lock.release()


def _refresh_ai_in_background() -> None:
    threading.Thread(target=_refresh_ai_preanalysis, daemon=True).start()


def _save_snapshot(payload: Dict[str, Any]) -> None:
    target = str(CACHE_FILE or "").strip()
    if not target:
        return
    folder = os.path.dirname(target)
    if folder:
        os.makedirs(folder, exist_ok=True)
    wrapper = SnapshotEnvelope(payload=payload, cachedAt=int(time.time() * 1000)).dict()
    temp_path = f"{target}.tmp"
    with open(temp_path, "w", encoding="utf-8") as handle:
        json.dump(wrapper, handle, ensure_ascii=False)
    os.replace(temp_path, target)


def _load_snapshot() -> None:
    target = str(CACHE_FILE or "").strip()
    if not target or not os.path.exists(target):
        return
    try:
        with open(target, "r", encoding="utf-8") as handle:
            loaded = json.load(handle)
    except Exception as exc:
        logger.warning("Could not load cached snapshot: %s", exc)
        return
    if not isinstance(loaded, dict):
        return
    payload = loaded.get("payload")
    cached_at = int(loaded.get("cachedAt") or 0)
    if not isinstance(payload, dict):
        return
    with _state_lock:
        _state["payload"] = payload
        _state["updatedAt"] = cached_at
        _state["lastRefreshAt"] = cached_at
        _state["lastDurationMs"] = 0
        _state["lastError"] = ""


def _refresh_snapshot(force: bool = True) -> bool:
    if not _refresh_lock.acquire(blocking=False):
        return False
    start_ms = int(time.time() * 1000)
    with _state_lock:
        _state["refreshing"] = True
    try:
        raw = _fetch_from_backend(force_refresh=force)
        prepared = _prepare_payload(raw)
        with _state_lock:
            previous_payload = _state.get("payload")
        _copy_existing_ai_preanalysis(prepared, previous_payload if isinstance(previous_payload, dict) else None)
        now_ms = int(time.time() * 1000)
        with _state_lock:
            _state["payload"] = prepared
            _state["updatedAt"] = now_ms
            _state["lastRefreshAt"] = now_ms
            _state["lastDurationMs"] = max(0, now_ms - start_ms)
            _state["lastError"] = ""
        _save_snapshot(prepared)
        _refresh_ai_in_background()
        return True
    except Exception as exc:
        with _state_lock:
            _state["lastRefreshAt"] = int(time.time() * 1000)
            _state["lastDurationMs"] = max(0, int(time.time() * 1000) - start_ms)
            _state["lastError"] = str(exc)
        logger.warning("Meta-hub refresh failed: %s", exc)
        return False
    finally:
        with _state_lock:
            _state["refreshing"] = False
        _refresh_lock.release()


def _refresh_in_background(force: bool = True) -> None:
    threading.Thread(target=_refresh_snapshot, kwargs={"force": force}, daemon=True).start()


def _background_loop() -> None:
    while True:
        if _stop_event.wait(_next_refresh_delay_seconds()):
            return
        _refresh_snapshot(force=False)


def _filter_payload(payload: Dict[str, Any], include_inactive: bool, customer_id: Optional[int]) -> Dict[str, Any]:
    contexts = payload.get("contexts") if isinstance(payload, dict) else []
    contexts = [item for item in (contexts or []) if isinstance(item, dict)]
    if customer_id is not None:
        contexts = [item for item in contexts if int(item.get("customerId") or 0) == int(customer_id)]
    if not include_inactive:
        contexts = [item for item in contexts if str(item.get("status") or "active").lower() != "inactive"]
    contexts.sort(key=lambda item: (-(item.get("priority") or 0), -(item.get("riskScore") or 0)))

    out = dict(payload)
    out["contexts"] = contexts
    out["count"] = len(contexts)
    current_meta = out.get("metaHub") if isinstance(out.get("metaHub"), dict) else {}
    out["metaHub"] = {
        **current_meta,
        "filteredAt": int(time.time() * 1000),
        "filteredCount": len(contexts),
        "filter": {
            "includeInactive": bool(include_inactive),
            "customerId": int(customer_id) if customer_id is not None else None,
        },
    }
    out["fromCache"] = True
    return out


@app.on_event("startup")
def startup_event() -> None:
    _load_snapshot()
    _refresh_in_background(force=False)
    _refresh_ai_in_background()
    if AUTO_REFRESH:
        threading.Thread(target=_background_loop, daemon=True).start()


@app.on_event("shutdown")
def shutdown_event() -> None:
    _stop_event.set()


@app.get("/health")
def get_health() -> Dict[str, Any]:
    with _state_lock:
        payload = _state.get("payload")
        return {
            "ok": bool(payload),
            "backendUrl": BACKEND_URL,
            "refreshing": bool(_state.get("refreshing")),
            "refreshIntervalSeconds": _to_positive_int(
                _state.get("refreshIntervalSeconds"),
                default=REFRESH_INTERVAL_SECONDS,
                minimum=30,
            ),
            "refreshJitterRatio": float(REFRESH_JITTER_RATIO),
            "updatedAt": int(_state.get("updatedAt") or 0),
            "lastRefreshAt": int(_state.get("lastRefreshAt") or 0),
            "lastDurationMs": int(_state.get("lastDurationMs") or 0),
            "lastError": str(_state.get("lastError") or ""),
            "aiPreanalysisEnabled": bool(AI_PREANALYSIS_ENABLED),
            "aiPreanalysisRefreshing": bool(_state.get("aiRefreshing")),
            "aiPreanalysisLastRefreshAt": int(_state.get("aiLastRefreshAt") or 0),
            "aiPreanalysisLastDurationMs": int(_state.get("aiLastDurationMs") or 0),
            "aiPreanalysisLastError": str(_state.get("aiLastError") or ""),
            "aiPreanalysisModes": list(AI_PREANALYSIS_MODES),
            "count": int((payload or {}).get("count") or 0) if isinstance(payload, dict) else 0,
        }


@app.get("/snapshot")
def get_snapshot(include_inactive: bool = True, customer_id: Optional[int] = None) -> Dict[str, Any]:
    with _state_lock:
        payload = _state.get("payload")
    if not isinstance(payload, dict):
        raise HTTPException(status_code=503, detail="Snapshot not available yet")
    return _filter_payload(payload, include_inactive=include_inactive, customer_id=customer_id)


@app.get("/snapshot/customer/{customer_id}")
def get_snapshot_customer(customer_id: int) -> Dict[str, Any]:
    payload = get_snapshot(include_inactive=True, customer_id=customer_id)
    contexts = payload.get("contexts") or []
    if not contexts:
        raise HTTPException(status_code=404, detail="Customer not found in snapshot")
    return contexts[0]


@app.post("/refresh")
def post_refresh(req: RefreshRequest) -> Dict[str, Any]:
    if req.background:
        _refresh_in_background(force=bool(req.force))
        return {
            "status": "queued",
            "force": bool(req.force),
        }
    success = _refresh_snapshot(force=bool(req.force))
    with _state_lock:
        payload = _state.get("payload")
        return {
            "status": "ok" if success else "running_or_failed",
            "force": bool(req.force),
            "updatedAt": int(_state.get("updatedAt") or 0),
            "count": int((payload or {}).get("count") or 0) if isinstance(payload, dict) else 0,
            "lastError": str(_state.get("lastError") or ""),
        }
