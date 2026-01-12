from datetime import datetime
from typing import Dict, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import TelephonyCall


def _start_of_day_ms() -> int:
    now = datetime.now()
    start = datetime(now.year, now.month, now.day)
    return int(start.timestamp() * 1000)


def _bucket_stats(calls: List[TelephonyCall]) -> List[Dict[str, int]]:
    buckets = [{"hour": hour, "answered": 0, "missed": 0} for hour in range(24)]
    for call in calls:
        if not call.start_time:
            continue
        hour = datetime.fromtimestamp(call.start_time / 1000).hour
        if call.answered:
            buckets[hour]["answered"] += 1
        else:
            buckets[hour]["missed"] += 1
    return buckets


def calculate_stats(session: Session) -> Dict:
    start_ms = _start_of_day_ms()
    calls = (
        session.query(TelephonyCall)
        .filter(TelephonyCall.start_time >= start_ms)
        .order_by(TelephonyCall.start_time.desc())
        .all()
    )
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
        "byHour": _bucket_stats(calls),
    }


def count_all(session: Session) -> int:
    return session.query(func.count(TelephonyCall.id)).scalar() or 0
