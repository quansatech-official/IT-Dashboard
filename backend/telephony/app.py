import json
from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from .api_client import NfonCtiClient
from .call_service import start_stream_listener
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

app = FastAPI(title="Telephony Module")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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


class ClickToDialRequest(BaseModel):
    extension: str
    number: str
    callee_context: Optional[str] = "global"


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
        session.commit()
        session.refresh(settings)
        return _serialize_settings(settings)


@app.get("/telephony/health")
@app.get("/api/telephony/health")
def health() -> Dict:
    return {"status": "ok"}
