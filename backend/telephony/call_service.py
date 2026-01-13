import json
import os
import threading
import time
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .api_client import NfonCtiClient
from .crm_mapping import resolve_customer_name
from .models import TelephonyCall, TelephonySettings


class TelephonyCallStore:
    def __init__(self, session: Session):
        self.session = session

    def _find_value(self, payload: Dict[str, Any], candidates: list[str]) -> Optional[Any]:
        if not payload:
            return None
        for key in candidates:
            if key in payload and payload[key] not in (None, "", []):
                return payload[key]
        normalized = {key.lower(): key for key in payload.keys() if isinstance(key, str)}
        for key in candidates:
            lowered = key.lower()
            if lowered in normalized:
                value = payload.get(normalized[lowered])
                if value not in (None, "", []):
                    return value
        for value in payload.values():
            if isinstance(value, dict):
                found = self._find_value(value, candidates)
                if found not in (None, "", []):
                    return found
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        found = self._find_value(item, candidates)
                        if found not in (None, "", []):
                            return found
        return None

    def _parse_timestamp(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            if value > 1_000_000_000_000:
                return int(value)
            if value > 1_000_000_000:
                return int(value * 1000)
            return int(value)
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return None
            if raw.isdigit():
                return self._parse_timestamp(int(raw))
            if raw.endswith("Z"):
                raw = raw[:-1] + "+00:00"
            tz_index = max(raw.rfind("+"), raw.rfind("-"))
            if tz_index > 10:
                base = raw[:tz_index]
                tz = raw[tz_index:]
            else:
                base = raw
                tz = ""
            if "." in base:
                head, frac = base.split(".", 1)
                if len(frac) > 6:
                    frac = frac[:6]
                base = f"{head}.{frac}"
            raw = f"{base}{tz}"
            try:
                parsed = datetime.fromisoformat(raw)
            except ValueError:
                return None
            return int(parsed.timestamp() * 1000)
        return None

    def _parse_duration(self, value: Any) -> Optional[int]:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            if value > 10_000:
                return int(value / 1000)
            return int(value)
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return None
            if raw.isdigit():
                return self._parse_duration(int(raw))
        return None

    def _extract_answered(self, payload: Dict[str, Any]) -> Optional[bool]:
        value = self._find_value(payload, ["answered", "isAnswered", "isConnected", "connected"])
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.lower()
            if lowered in {"true", "yes", "y", "1"}:
                return True
            if lowered in {"false", "no", "n", "0"}:
                return False
        status = self._find_value(payload, ["status", "callStatus", "state", "disposition"])
        if isinstance(status, str):
            lowered = status.lower()
            if any(token in lowered for token in ["missed", "noanswer", "no_answer", "failed", "busy"]):
                return False
            if any(token in lowered for token in ["answered", "connected", "completed", "active"]):
                return True
        return None

    def _extract_state(self, payload: Dict[str, Any]) -> Optional[str]:
        state = self._find_value(payload, ["state", "callState", "status"])
        if state is None:
            return None
        return str(state).lower()

    def upsert(self, payload: Dict[str, Any]) -> TelephonyCall:
        uuid = payload.get("uuid") or payload.get("id")
        if not uuid:
            raise ValueError("Call event missing uuid")
        call = self.session.query(TelephonyCall).filter_by(uuid=uuid).first()
        if not call:
            call = TelephonyCall(uuid=uuid)
            self.session.add(call)

        from_value = self._find_value(
            payload,
            [
                "from",
                "fromNumber",
                "caller",
                "callerNumber",
                "callingNumber",
                "source",
                "sourceNumber",
                "ani",
                "aNumber",
            ],
        )
        to_value = self._find_value(
            payload,
            [
                "to",
                "toNumber",
                "callee",
                "calledNumber",
                "destination",
                "destinationNumber",
                "dnis",
                "bNumber",
            ],
        )
        direction = self._find_value(payload, ["direction", "callDirection", "directionType", "callType"])
        extension = self._find_value(payload, ["extension", "extensionNumber"])
        state = self._extract_state(payload)
        start_time = self._parse_timestamp(
            self._find_value(
                payload,
                [
                    "startTime",
                    "start",
                    "startTimestamp",
                    "startDate",
                    "startedAt",
                    "timestamp",
                    "time",
                ],
            )
        )
        end_time = self._parse_timestamp(
            self._find_value(payload, ["endTime", "end", "endTimestamp", "endDate", "endedAt", "finishedAt"])
        )
        updated_time = self._parse_timestamp(self._find_value(payload, ["updated"]))
        duration = self._parse_duration(
            self._find_value(payload, ["duration", "durationSeconds", "durationSec", "talkTime", "ringDuration", "length"])
        )
        answered = self._extract_answered(payload)

        if from_value is not None:
            call.from_number = str(from_value)
        if to_value is not None:
            call.to_number = str(to_value)
        if direction is not None:
            call.direction = str(direction)
        elif extension is not None and call.from_number:
            call.direction = "outbound"
        if extension is not None:
            call.extension = str(extension)
        if call.start_time == 0 and start_time is not None:
            call.start_time = start_time
        elif call.start_time == 0 and updated_time is not None and state in {
            "start",
            "caller-dial",
            "caller-ring",
            "caller-answer",
            "dial",
            "ring",
            "answer",
        }:
            call.start_time = updated_time
        if state in {"hangup", "end"}:
            if end_time is not None:
                call.end_time = end_time
            elif updated_time is not None:
                call.end_time = updated_time
            else:
                call.end_time = int(time.time() * 1000)
        if duration is not None:
            call.duration = duration
        elif call.start_time and call.end_time and call.end_time >= call.start_time:
            call.duration = int((call.end_time - call.start_time) / 1000)
        if answered is None:
            if state in {"answer", "caller-answer"}:
                call.answered = True
            elif state in {"hangup", "end"} and call.answered is False and call.duration == 0:
                call.answered = False
            if call.duration and call.duration > 0:
                call.answered = True
        else:
            call.answered = answered
        try:
            call.raw_payload = json.dumps(payload, ensure_ascii=True)
        except (TypeError, ValueError):
            call.raw_payload = json.dumps({"raw": str(payload)}, ensure_ascii=True)
        return call


def process_event(
    session: Session,
    payload: Dict[str, Any],
    crm_mapping: Optional[Dict[str, str]] = None,
) -> TelephonyCall:
    store = TelephonyCallStore(session)
    call = store.upsert(payload)
    if crm_mapping:
        call.customer_name = resolve_customer_name(call.from_number, crm_mapping) or call.customer_name
    session.commit()
    session.refresh(call)
    return call


def start_stream_listener(session_factory, api_client: Optional[NfonCtiClient] = None) -> None:
    env_enabled = os.environ.get("TELEPHONY_STREAM_ENABLED", "").lower() in {"1", "true", "yes"}
    settings_enabled = False
    if not env_enabled:
        with session_factory() as session:
            settings = session.query(TelephonySettings).first()
            settings_enabled = bool(settings and settings.stream_enabled)
        if not settings_enabled:
            return

    client = api_client
    crm_mapping: Dict[str, str] = {}

    def _loop() -> None:
        while True:
            try:
                if client is None:
                    with session_factory() as session:
                        settings = session.query(TelephonySettings).first()
                        if settings:
                            client_config = {
                                "base_url": settings.base_url or None,
                                "username": settings.username or None,
                                "password": settings.password or None,
                                "refresh_token": settings.refresh_token or None,
                            }
                            stream_client = NfonCtiClient(**client_config)
                        else:
                            stream_client = NfonCtiClient()
                else:
                    stream_client = client
                for event in stream_client.stream_calls():
                    with session_factory() as session:
                        process_event(session, event, crm_mapping)
            except Exception:
                time.sleep(5)

    thread = threading.Thread(target=_loop, daemon=True)
    thread.start()
