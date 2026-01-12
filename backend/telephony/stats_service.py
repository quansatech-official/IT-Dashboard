from datetime import datetime, timedelta
from typing import Dict, List

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
    }


def count_all(session: Session) -> int:
    return session.query(func.count(TelephonyCall.id)).scalar() or 0
