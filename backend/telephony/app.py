from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

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

app = FastAPI(title="Telephony Module")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _serialize_call(call: TelephonyCall) -> Dict:
    return {
        "uuid": call.uuid,
        "from": call.from_number,
        "to": call.to_number,
        "direction": call.direction,
        "startTime": call.start_time,
        "endTime": call.end_time,
        "duration": call.duration,
        "answered": call.answered,
        "customerName": call.customer_name,
    }


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


class SettingsUpdate(BaseModel):
    baseUrl: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    refreshToken: Optional[str] = None
    streamEnabled: Optional[bool] = None


@app.on_event("startup")
def _startup() -> None:
    start_stream_listener(SessionLocal)


@app.get("/telephony/calls")
@app.get("/api/telephony/calls")
def list_calls(limit: int = 200) -> List[Dict]:
    with SessionLocal() as session:
        calls = (
            session.query(TelephonyCall)
            .order_by(TelephonyCall.start_time.desc())
            .limit(limit)
            .all()
        )
    return [_serialize_call(call) for call in calls]


@app.get("/telephony/stats")
@app.get("/api/telephony/stats")
def stats() -> Dict:
    with SessionLocal() as session:
        return calculate_stats(session)


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
