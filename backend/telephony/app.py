import json
import os
import time
from typing import Dict, List, Optional
from urllib.parse import quote

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from .api_client import NfonCtiClient
from .call_service import start_stream_listener
from .crm_mapping import normalize_phone, resolve_customer_name
from .models import Base, TelephonyCall, TelephonySettings, DATABASE_URL
from .stats_service import calculate_stats

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

Base.metadata.create_all(bind=engine)


def _ensure_refresh_token_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("telephony_settings"):
        return
    columns = {column["name"] for column in inspector.get_columns("telephony_settings")}
    if "refresh_token" in columns:
        return
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE telephony_settings ADD COLUMN refresh_token VARCHAR")
        )


_ensure_refresh_token_column()


def _ensure_numerify_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("telephony_settings"):
        return
    columns = {column["name"] for column in inspector.get_columns("telephony_settings")}
    statements = []
    if "numerify_reverse_url" not in columns:
        statements.append("ALTER TABLE telephony_settings ADD COLUMN numerify_reverse_url VARCHAR")
    if "numerify_api_key" not in columns:
        statements.append("ALTER TABLE telephony_settings ADD COLUMN numerify_api_key VARCHAR")
    if "numerify_api_header" not in columns:
        statements.append("ALTER TABLE telephony_settings ADD COLUMN numerify_api_header VARCHAR")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_ensure_numerify_columns()


def _ensure_call_raw_payload_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("telephony_calls"):
        return
    columns = {column["name"] for column in inspector.get_columns("telephony_calls")}
    if "raw_payload" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE telephony_calls ADD COLUMN raw_payload TEXT"))


_ensure_call_raw_payload_column()


def _ensure_call_extension_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("telephony_calls"):
        return
    columns = {column["name"] for column in inspector.get_columns("telephony_calls")}
    if "extension" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE telephony_calls ADD COLUMN extension VARCHAR"))


_ensure_call_extension_column()


def _ensure_call_callback_resolved_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("telephony_calls"):
        return
    columns = {column["name"] for column in inspector.get_columns("telephony_calls")}
    if "callback_resolved" in columns:
        return
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE telephony_calls ADD COLUMN callback_resolved BOOLEAN DEFAULT FALSE")
        )


_ensure_call_callback_resolved_column()

app = FastAPI(title="Telephony Module")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_reverse_cache: Dict[str, Dict[str, Optional[str]]] = {}
_reverse_cache_ttl = 60 * 60 * 24
_customer_mapping_cache: Dict[str, Dict[str, str] | float] = {"ts": 0.0, "mapping": {}}
_customer_mapping_ttl = 60 * 5


def _load_customer_mapping() -> Dict[str, str]:
    now = time.time()
    cached_ts = float(_customer_mapping_cache.get("ts", 0.0))
    cached_mapping = _customer_mapping_cache.get("mapping")
    if isinstance(cached_mapping, dict) and cached_mapping and now - cached_ts < _customer_mapping_ttl:
        return cached_mapping
    mapping: Dict[str, str] = {}
    try:
        with engine.begin() as connection:
            rows = connection.execute(
                text(
                    "SELECT c.name, p.number "
                    "FROM customers c "
                    "JOIN customer_phones p ON p.customer_id = c.id "
                    "WHERE p.number IS NOT NULL AND p.number <> ''"
                )
            ).fetchall()
        for name, number in rows:
            normalized = normalize_phone(number)
            if normalized and name:
                mapping[normalized] = name
    except Exception:
        mapping = {}
    _customer_mapping_cache["ts"] = now
    _customer_mapping_cache["mapping"] = mapping
    return mapping


def _reverse_lookup(number: str, settings: Optional[TelephonySettings]) -> Optional[str]:
    if not number:
        return None
    now = time.time()
    cached = _reverse_cache.get(number)
    if cached and now - cached["ts"] < _reverse_cache_ttl:
        cached_name = cached.get("name")
        if cached_name:
            return cached_name
    customer_mapping = _load_customer_mapping()
    customer_name = resolve_customer_name(number, customer_mapping)
    if customer_name:
        _reverse_cache[number] = {"name": customer_name, "ts": now}
        return customer_name
    base_url = ""
    api_key = ""
    api_header = ""
    if settings:
        base_url = (settings.numerify_reverse_url or "").strip()
        api_key = (settings.numerify_api_key or "").strip()
        api_header = (settings.numerify_api_header or "").strip()
    if not base_url:
        base_url = os.environ.get("NUMERIFY_REVERSE_URL", "").strip()
    if not api_key:
        api_key = os.environ.get("NUMERIFY_API_KEY", "").strip()
    if not api_header:
        api_header = os.environ.get("NUMERIFY_API_HEADER", "").strip()
    if not base_url:
        return None
    url = base_url.replace("{number}", quote(number))
    headers: Dict[str, str] = {"Accept": "application/json"}
    if api_key:
        header_name = api_header or "X-API-Key"
        headers[header_name] = api_key
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    data = response.json() if response.content else {}
    name = (
        data.get("name")
        or data.get("caller_name")
        or data.get("displayName")
        or data.get("company")
    )
    name = str(name).strip() if name else None
    if name:
        _reverse_cache[number] = {"name": name, "ts": now}
    return name


def _extension_from_raw(call: TelephonyCall) -> str:
    if not call.raw_payload:
        return ""
    try:
        payload = json.loads(call.raw_payload)
    except json.JSONDecodeError:
        return ""
    if isinstance(payload, dict):
        extension = payload.get("extension") or payload.get("extensionNumber")
        if extension:
            return str(extension)
    return ""


def _serialize_call(call: TelephonyCall, include_raw: bool = False) -> Dict:
    extension = call.extension or _extension_from_raw(call)
    payload = {
        "uuid": call.uuid,
        "from": call.from_number,
        "to": call.to_number,
        "direction": call.direction,
        "extension": extension,
        "startTime": call.start_time,
        "endTime": call.end_time,
        "duration": call.duration,
        "answered": call.answered,
        "customerName": call.customer_name,
        "callbackResolved": bool(call.callback_resolved),
    }
    if include_raw:
        payload["rawPayload"] = call.raw_payload
    return payload


def _get_settings(session) -> TelephonySettings:
    settings = session.query(TelephonySettings).first()
    if not settings:
        settings = TelephonySettings()
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings


def _serialize_settings(settings: TelephonySettings) -> Dict:
    return {
        "baseUrl": settings.base_url,
        "username": settings.username,
        "hasPassword": bool(settings.password),
        "hasRefreshToken": bool(settings.refresh_token),
        "streamEnabled": settings.stream_enabled,
        "numerifyReverseUrl": settings.numerify_reverse_url,
        "numerifyApiHeader": settings.numerify_api_header,
        "hasNumerifyApiKey": bool(settings.numerify_api_key),
    }


def _build_client(session) -> NfonCtiClient:
    settings = _get_settings(session)
    return NfonCtiClient(
        base_url=settings.base_url or None,
        username=settings.username or None,
        password=settings.password or None,
        refresh_token=settings.refresh_token or None,
    )


class SettingsUpdate(BaseModel):
    baseUrl: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    refreshToken: Optional[str] = None
    streamEnabled: Optional[bool] = None
    numerifyReverseUrl: Optional[str] = None
    numerifyApiHeader: Optional[str] = None
    numerifyApiKey: Optional[str] = None


class ClickToDialRequest(BaseModel):
    extension: str
    number: str
    callee_context: Optional[str] = "global"


class CallbackResolvedRequest(BaseModel):
    resolved: bool = True


@app.on_event("startup")
def _startup() -> None:
    start_stream_listener(SessionLocal)


@app.get("/telephony/calls")
@app.get("/api/telephony/calls")
def list_calls(limit: int = 200, include_raw: bool = False) -> List[Dict]:
    with SessionLocal() as session:
        calls = (
            session.query(TelephonyCall)
            .order_by(TelephonyCall.start_time.desc())
            .limit(limit)
            .all()
        )
    return [_serialize_call(call, include_raw=include_raw) for call in calls]


@app.get("/telephony/reverse")
@app.get("/api/telephony/reverse")
def reverse_lookup(number: str) -> Dict:
    with SessionLocal() as session:
        settings = _get_settings(session)
        name = _reverse_lookup(number, settings)
    return {"number": number, "name": name}


@app.post("/telephony/calls")
@app.post("/api/telephony/calls")
def click_to_dial(payload: ClickToDialRequest) -> Dict:
    with SessionLocal() as session:
        client = _build_client(session)
        result = client.originate_call(
            {
                "caller": payload.extension,
                "callee": payload.number,
                "callee_context": payload.callee_context or "global",
                "extension": payload.extension,
            }
        )
        return result


@app.patch("/telephony/calls/{call_uuid}/callback_resolved")
@app.patch("/api/telephony/calls/{call_uuid}/callback_resolved")
def resolve_callback(call_uuid: str, payload: CallbackResolvedRequest) -> Dict:
    with SessionLocal() as session:
        call = session.query(TelephonyCall).filter(TelephonyCall.uuid == call_uuid).first()
        if not call:
            raise HTTPException(404, "Call not found")
        call.callback_resolved = bool(payload.resolved)
        session.commit()
        session.refresh(call)
        return _serialize_call(call)


@app.get("/telephony/stats")
@app.get("/api/telephony/stats")
def stats() -> Dict:
    with SessionLocal() as session:
        return calculate_stats(session)


@app.get("/telephony/extensions")
@app.get("/api/telephony/extensions")
def list_extensions() -> List[Dict]:
    with SessionLocal() as session:
        client = _build_client(session)
        return client.get_extensions()


@app.get("/telephony/settings")
@app.get("/api/telephony/settings")
def get_settings() -> Dict:
    with SessionLocal() as session:
        settings = _get_settings(session)
        return _serialize_settings(settings)


@app.put("/telephony/settings")
@app.put("/api/telephony/settings")
def update_settings(payload: SettingsUpdate) -> Dict:
    with SessionLocal() as session:
        settings = _get_settings(session)
        if payload.baseUrl is not None:
            settings.base_url = payload.baseUrl
        if payload.username is not None:
            settings.username = payload.username
        if payload.password is not None and payload.password != "":
            settings.password = payload.password
        if payload.refreshToken is not None and payload.refreshToken != "":
            settings.refresh_token = payload.refreshToken
        if payload.streamEnabled is not None:
            settings.stream_enabled = payload.streamEnabled
        if payload.numerifyReverseUrl is not None:
            settings.numerify_reverse_url = payload.numerifyReverseUrl
        if payload.numerifyApiHeader is not None:
            settings.numerify_api_header = payload.numerifyApiHeader
        if payload.numerifyApiKey is not None and payload.numerifyApiKey != "":
            settings.numerify_api_key = payload.numerifyApiKey
        session.commit()
        session.refresh(settings)
        return _serialize_settings(settings)


@app.get("/telephony/health")
@app.get("/api/telephony/health")
def health() -> Dict:
    return {"status": "ok"}
