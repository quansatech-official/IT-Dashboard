import json
import os
import threading
import time
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from .api_client import NfonCtiClient
from .crm_mapping import resolve_customer_name
from .models import TelephonyCall, TelephonySettings


class TelephonyCallStore:
    def __init__(self, session: Session):
        self.session = session

    def upsert(self, payload: Dict[str, Any]) -> TelephonyCall:
        uuid = payload.get("uuid") or payload.get("id")
        if not uuid:
            raise ValueError("Call event missing uuid")
        call = self.session.query(TelephonyCall).filter_by(uuid=uuid).first()
        if not call:
            call = TelephonyCall(uuid=uuid)
            self.session.add(call)

        call.from_number = payload.get("from") or payload.get("fromNumber")
        call.to_number = payload.get("to") or payload.get("toNumber")
        call.direction = payload.get("direction") or payload.get("callDirection")
        call.start_time = payload.get("startTime") or payload.get("start") or call.start_time
        call.end_time = payload.get("endTime") or payload.get("end") or call.end_time
        call.duration = payload.get("duration") or call.duration
        call.answered = bool(payload.get("answered", call.answered))
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
