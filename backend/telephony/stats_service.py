import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import TelephonyCall


def _start_of_day_ms() -> int:
    now = datetime.now()
    start = datetime(now.year, now.month, now.day)
    return int(start.timestamp() * 1000)


def _since_ms(delta: timedelta) -> int:
    now = datetime.now()
    return int((now - delta).timestamp() * 1000)


def _stats_for_calls(calls: List[TelephonyCall]) -> Dict[str, int]:
    total = len(calls)
    answered = sum(1 for c in calls if c.answered)
    missed = total - answered
    avg_duration = 0
    if total:
        avg_duration = int(sum(c.duration or 0 for c in calls) / total)
    return {
        "total": total,
        "answered": answered,
        "missed": missed,
        "avgDuration": avg_duration,
    }


def _parse_payload(call: TelephonyCall) -> Dict[str, Any]:
    if not call.raw_payload:
        return {}
    try:
        payload = json.loads(call.raw_payload)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _find_value(payload: Dict[str, Any], candidates: List[str]) -> Optional[str]:
    if not payload:
        return None
    for key in candidates:
        if key in payload and payload[key] not in (None, "", []):
            return str(payload[key])
    normalized = {key.lower(): key for key in payload.keys() if isinstance(key, str)}
    for key in candidates:
        lowered = key.lower()
        if lowered in normalized:
            value = payload.get(normalized[lowered])
            if value not in (None, "", []):
                return str(value)
    for value in payload.values():
        if isinstance(value, dict):
            found = _find_value(value, candidates)
            if found:
                return found
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    found = _find_value(item, candidates)
                    if found:
                        return found
    return None


def _extract_extension(call: TelephonyCall) -> Optional[str]:
    payload = _parse_payload(call)
    candidates = [
        "extension",
        "extensionId",
        "extensionNumber",
        "extensionNo",
        "userExtension",
        "agentExtension",
        "internalNumber",
        "internal",
    ]
    return _find_value(payload, candidates)


def _extract_queue(call: TelephonyCall) -> Optional[str]:
    payload = _parse_payload(call)
    candidates = [
        "queue",
        "queueId",
        "queueNumber",
        "queueName",
        "callQueue",
        "queue_id",
    ]
    return _find_value(payload, candidates)


def _grouped_stats(calls: List[TelephonyCall], selector) -> List[Dict[str, Any]]:
    buckets: Dict[str, List[TelephonyCall]] = {}
    for call in calls:
        key = selector(call)
        if not key:
            continue
        buckets.setdefault(key, []).append(call)
    results = []
    for key, bucket in buckets.items():
        stats = _stats_for_calls(bucket)
        results.append({"key": key, **stats})
    return sorted(results, key=lambda item: item["total"], reverse=True)


def calculate_stats(session: Session) -> Dict:
    today_calls = (
        session.query(TelephonyCall)
        .filter(TelephonyCall.start_time >= _start_of_day_ms())
        .all()
    )
    last_24h_calls = (
        session.query(TelephonyCall)
        .filter(TelephonyCall.start_time >= _since_ms(timedelta(hours=24)))
        .all()
    )
    last_7d_calls = (
        session.query(TelephonyCall)
        .filter(TelephonyCall.start_time >= _since_ms(timedelta(days=7)))
        .all()
    )

    return {
        "today": _stats_for_calls(today_calls),
        "last24h": _stats_for_calls(last_24h_calls),
        "last7d": _stats_for_calls(last_7d_calls),
        "byExtension": _grouped_stats(last_7d_calls, _extract_extension),
        "byQueue": _grouped_stats(last_7d_calls, _extract_queue),
    }


def count_all(session: Session) -> int:
    return session.query(func.count(TelephonyCall.id)).scalar() or 0
