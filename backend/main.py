from fastapi import FastAPI, HTTPException, Response, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy import (
    create_engine, Column, Integer, String,
    Boolean, BigInteger, ForeignKey, inspect, text, func, or_
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os
import time
import uuid
import json
import hashlib
import hmac
import base64
import requests

# ================= DATABASE =================
DATABASE_URL = os.environ.get("DATABASE_URL") or (
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL") or "http://ollama:11434"
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or "llama3.1"
_geo_cache: Dict[str, Optional[tuple[float, float]]] = {}
GEO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
ROUTE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

# ================= MODELS ===================
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    creditor_number = Column(String, default="")
    short_code = Column(String, default="")
    email = Column(String, default="")
    time_tracking_enabled = Column(Boolean, default=False)
    street = Column(String, default="")
    postal_code = Column(String, default="")
    city = Column(String, default="")
    country = Column(String, default="")

    phones = relationship(
        "CustomerPhone",
        back_populates="customer",
        cascade="all, delete-orphan"
    )


class DayTask(Base):
    __tablename__ = "day_tasks"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    customer = Column(String, default="")
    customer_number = Column(String, default="")
    status = Column(String, default="todo")
    task_id = Column(Integer, nullable=True)
    group_id = Column(Integer, nullable=True)
    locked = Column(Boolean, default=False)
    signature_base64 = Column(String, default="")
    time_enabled = Column(Boolean, default=False)
    erledigt = Column(Boolean, default=False)
    aberechnet = Column(Boolean, default=False)
    kulant = Column(Boolean, default=False)
    randzeit = Column(Boolean, default=False)
    details = Column(String, default="")
    arrival_time = Column(String, default="")
    departure_time = Column(String, default="")
    deadline = Column(String, default="")
    elapsed = Column(BigInteger, default=0)      # ms
    running = Column(Boolean, default=False)
    startTime = Column("starttime", BigInteger, default=0)    # ms timestamp
    completed_at = Column(BigInteger, default=0)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class DayTaskGroup(Base):
    __tablename__ = "day_task_groups"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    column = Column(String, default="todo")
    position = Column(Integer, default=0)
    pinned = Column(Boolean, default=False)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class CustomerPhone(Base):
    __tablename__ = "customer_phones"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"))
    label = Column(String, default="")
    number = Column(String, default="")

    customer = relationship("Customer", back_populates="phones")


class GeoCache(Base):
    __tablename__ = "geo_cache"

    id = Column(Integer, primary_key=True)
    address = Column(String, unique=True, nullable=False)
    lat = Column(String, default="")
    lon = Column(String, default="")
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class RouteCache(Base):
    __tablename__ = "route_cache"

    id = Column(Integer, primary_key=True)
    origin_lat = Column(String, default="")
    origin_lon = Column(String, default="")
    dest_lat = Column(String, default="")
    dest_lon = Column(String, default="")
    distance_km = Column(String, default="")
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class PinNote(Base):
    __tablename__ = "pin_notes"

    id = Column(Integer, primary_key=True)
    content = Column(String, default="")

class ReportCatalogItem(Base):
    __tablename__ = "report_catalog"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    group = Column(String, default="")
    system = Column(String, default="")
    why_text = Column(String, default="")
    impact = Column(String, default="")
    duration = Column(String, default="")
    cost = Column(String, default="")
    priority = Column(String, default="Planbar")

class CustomerActionSuggestion(Base):
    __tablename__ = "report_customer_actions"

    id = Column(Integer, primary_key=True)
    text = Column(String, nullable=False)


class ReportSummarySuggestion(Base):
    __tablename__ = "report_summaries"

    id = Column(Integer, primary_key=True)
    text = Column(String, nullable=False)

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True)
    guid = Column(String, default=lambda: str(uuid.uuid4()))
    customer = Column(String, nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    period = Column(String, default="")
    status = Column(String, default="")
    summary = Column(String, default="")
    customer_action_text = Column(String, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    sent_at = Column(BigInteger, default=0)
    sent_via = Column(String, default="")
    sent_to = Column(String, default="")
    opened_at = Column(BigInteger, default=0)
    opened_count = Column(Integer, default=0)
    customer_status = Column(String, default="")

    items = relationship(
        "ReportItem",
        back_populates="report",
        cascade="all, delete-orphan"
    )


class ReportItem(Base):
    __tablename__ = "report_items"

    id = Column(Integer, primary_key=True)
    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"))

    priority = Column(String, default="Planbar")
    title = Column(String, default="")
    system = Column(String, default="")
    why_text = Column(String, default="")
    impact = Column(String, default="")
    duration = Column(String, default="")
    cost = Column(String, default="")

    report = relationship("Report", back_populates="items")


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True)
    guid = Column(String, default=lambda: str(uuid.uuid4()))
    reference = Column(String, default="")
    customer = Column(String, default="")
    status = Column(String, default="offen")
    data_json = Column(String, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    confirmed_at = Column(BigInteger, default=0)
    customer_name = Column(String, default="")
    customer_email = Column(String, default="")
    customer_note = Column(String, default="")

class IntegrationSettings(Base):
    __tablename__ = "integration_settings"

    id = Column(Integer, primary_key=True)
    rmm_host = Column(String, default="")
    rmm_user = Column(String, default="")
    rmm_password = Column(String, default="")
    pbx_base_url = Column(String, default="")
    pbx_username = Column(String, default="")
    pbx_password = Column(String, default="")
    pbx_refresh_token = Column(String, default="")
    pbx_api_key_id = Column(String, default="")
    pbx_api_key_secret = Column(String, default="")
    pbx_customer_account = Column(String, default="")


class SmtpSettings(Base):
    __tablename__ = "smtp_settings"

    id = Column(Integer, primary_key=True)
    host = Column(String, default="")
    port = Column(Integer, default=587)
    username = Column(String, default="")
    password = Column(String, default="")
    sender_name = Column(String, default="")
    sender_email = Column(String, default="")
    use_tls = Column(Boolean, default=True)
    use_ssl = Column(Boolean, default=False)
    beacon_base_url = Column(String, default="")


class OfferSettings(Base):
    __tablename__ = "offer_settings"

    id = Column(Integer, primary_key=True)
    offer_number_format = Column(String, default="AN-XXXX")

class PbxPhonebookEntry(Base):
    __tablename__ = "pbx_phonebook_entries"

    id = Column(Integer, primary_key=True)
    name = Column(String, default="")
    number = Column(String, default="")
    is_global = Column(Boolean, default=False)
    company = Column(String, default="")
    email = Column(String, default="")
    note = Column(String, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class CustomerMetricsSettings(Base):
    __tablename__ = "customer_metrics_settings"

    id = Column(Integer, primary_key=True)
    office_address = Column(String, default="Steyrtalstraße 88, 4523 Neuzeug")
    km_rate_eur = Column(String, default="0.8")
    min_distance_km = Column(String, default="15")
    min_fee_eur = Column(String, default="15")
    hourly_rate_eur = Column(String, default="0")

Base.metadata.create_all(bind=engine)

def _ensure_integration_settings_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("integration_settings"):
        return
    columns = {column["name"] for column in inspector.get_columns("integration_settings")}
    statements = []
    if "pbx_base_url" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_base_url VARCHAR DEFAULT ''")
    if "pbx_username" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_username VARCHAR DEFAULT ''")
    if "pbx_password" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_password VARCHAR DEFAULT ''")
    if "pbx_refresh_token" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_refresh_token VARCHAR DEFAULT ''")
    if "pbx_api_key_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_api_key_id VARCHAR DEFAULT ''")
    if "pbx_api_key_secret" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_api_key_secret VARCHAR DEFAULT ''")
    if "pbx_customer_account" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_customer_account VARCHAR DEFAULT ''")
    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

_ensure_integration_settings_columns()

def _ensure_pbx_phonebook_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("pbx_phonebook_entries"):
        return
    columns = {column["name"] for column in inspector.get_columns("pbx_phonebook_entries")}
    if "is_global" in columns:
        return
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE pbx_phonebook_entries ADD COLUMN is_global BOOLEAN DEFAULT FALSE")
        )

_ensure_pbx_phonebook_columns()


def _ensure_customer_metrics_settings_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("customer_metrics_settings"):
        return
    columns = {column["name"] for column in inspector.get_columns("customer_metrics_settings")}
    if "hourly_rate_eur" in columns:
        return
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE customer_metrics_settings ADD COLUMN hourly_rate_eur VARCHAR DEFAULT '0'")
        )


_ensure_customer_metrics_settings_columns()


def _ensure_report_sent_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("reports"):
        return
    columns = {column["name"] for column in inspector.get_columns("reports")}
    if "sent_at" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE reports ADD COLUMN sent_at BIGINT DEFAULT 0"))


_ensure_report_sent_column()


def _ensure_report_opened_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("reports"):
        return
    columns = {column["name"] for column in inspector.get_columns("reports")}
    statements = []
    if "guid" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN guid VARCHAR")
    if "customer_id" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN customer_id INTEGER")
    if "opened_at" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN opened_at BIGINT DEFAULT 0")
    if "opened_count" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN opened_count INTEGER DEFAULT 0")
    if "sent_via" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN sent_via VARCHAR")
    if "sent_to" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN sent_to VARCHAR")
    if "customer_status" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN customer_status VARCHAR DEFAULT ''")
    if not statements:
        return
    has_customer_id = "customer_id" in columns or any(
        "customer_id" in statement for statement in statements
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if has_customer_id:
            connection.execute(
                text(
                    "UPDATE reports r SET customer_id = c.id "
                    "FROM customers c "
                    "WHERE r.customer_id IS NULL "
                    "AND LOWER(r.customer) = LOWER(c.name)"
                )
            )


_ensure_report_opened_columns()


def _ensure_report_catalog_group_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("report_catalog"):
        return
    columns = {column["name"] for column in inspector.get_columns("report_catalog")}
    if "group" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE report_catalog ADD COLUMN \"group\" VARCHAR"))


_ensure_report_catalog_group_column()


def _ensure_smtp_settings_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("smtp_settings"):
        return
    columns = {column["name"] for column in inspector.get_columns("smtp_settings")}
    if "beacon_base_url" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE smtp_settings ADD COLUMN beacon_base_url VARCHAR"))


_ensure_smtp_settings_columns()


def _ensure_customer_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("customers"):
        return
    columns = {column["name"] for column in inspector.get_columns("customers")}
    statements = []
    if "creditor_number" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN creditor_number VARCHAR DEFAULT ''")
    if "short_code" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN short_code VARCHAR DEFAULT ''")
    if "email" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN email VARCHAR DEFAULT ''")
    if "time_tracking_enabled" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN time_tracking_enabled BOOLEAN DEFAULT FALSE")
    if "street" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN street VARCHAR DEFAULT ''")
    if "postal_code" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN postal_code VARCHAR DEFAULT ''")
    if "city" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN city VARCHAR DEFAULT ''")
    if "country" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN country VARCHAR DEFAULT ''")
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        if "time_tracking_enabled" in columns:
            connection.execute(
                text(
                    "UPDATE customers SET time_tracking_enabled = TRUE "
                    "WHERE time_tracking_enabled = FALSE "
                    "AND id IN (SELECT DISTINCT customer_id FROM tasks)"
                )
            )


_ensure_customer_columns()


def _ensure_day_tasks_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("day_tasks"):
        return
    columns = {column["name"] for column in inspector.get_columns("day_tasks")}
    statements = []
    if "customer_number" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN customer_number VARCHAR DEFAULT ''")
    if "task_id" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN task_id INTEGER")
    if "group_id" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN group_id INTEGER")
    if "locked" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN locked BOOLEAN DEFAULT FALSE")
    if "signature_base64" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN signature_base64 VARCHAR DEFAULT ''")
    if "time_enabled" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN time_enabled BOOLEAN DEFAULT FALSE")
    if "erledigt" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN erledigt BOOLEAN DEFAULT FALSE")
    if "aberechnet" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN aberechnet BOOLEAN DEFAULT FALSE")
    if "kulant" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN kulant BOOLEAN DEFAULT FALSE")
    if "randzeit" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN randzeit BOOLEAN DEFAULT FALSE")
    if "details" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN details VARCHAR DEFAULT ''")
    if "arrival_time" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN arrival_time VARCHAR DEFAULT ''")
    if "departure_time" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN departure_time VARCHAR DEFAULT ''")
    if "deadline" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN deadline VARCHAR DEFAULT ''")
    if "elapsed" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN elapsed BIGINT DEFAULT 0")
    if "running" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN running BOOLEAN DEFAULT FALSE")
    if "starttime" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN starttime BIGINT DEFAULT 0")
    if "completed_at" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN completed_at BIGINT DEFAULT 0")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_ensure_day_tasks_columns()


def _ensure_day_task_groups_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("day_task_groups"):
        return
    columns = {column["name"] for column in inspector.get_columns("day_task_groups")}
    if "pinned" in columns:
        return
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE day_task_groups ADD COLUMN pinned BOOLEAN DEFAULT FALSE")
        )


_ensure_day_task_groups_columns()

# ================= SCHEMAS ==================
class CustomerPhoneSchema(BaseModel):
    id: Optional[int] = None
    label: Optional[str] = ""
    number: Optional[str] = ""


class CustomerCreate(BaseModel):
    name: str
    creditor_number: Optional[str] = ""
    short_code: Optional[str] = ""
    email: Optional[str] = ""
    time_tracking_enabled: Optional[bool] = None
    street: Optional[str] = ""
    postal_code: Optional[str] = ""
    city: Optional[str] = ""
    country: Optional[str] = ""
    phones: Optional[List[CustomerPhoneSchema]] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    creditor_number: Optional[str] = None
    short_code: Optional[str] = None
    email: Optional[str] = None
    time_tracking_enabled: Optional[bool] = None
    street: Optional[str] = None
    postal_code: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    phones: Optional[List[CustomerPhoneSchema]] = None


class DayTaskCreate(BaseModel):
    title: str
    customer: Optional[str] = ""
    customer_number: Optional[str] = ""
    status: Optional[str] = "todo"
    group_id: Optional[int] = None
    locked: Optional[bool] = False
    signature_base64: Optional[str] = ""
    time_enabled: Optional[bool] = False
    erledigt: Optional[bool] = False
    aberechnet: Optional[bool] = False
    kulant: Optional[bool] = False
    randzeit: Optional[bool] = False
    details: Optional[str] = ""
    arrival_time: Optional[str] = ""
    departure_time: Optional[str] = ""
    deadline: Optional[str] = ""
    elapsed: Optional[int] = 0
    running: Optional[bool] = False
    startTime: Optional[int] = 0
    completed_at: Optional[int] = 0


class DayTaskUpdate(BaseModel):
    title: Optional[str] = None
    customer: Optional[str] = None
    customer_number: Optional[str] = None
    status: Optional[str] = None
    task_id: Optional[int] = None
    group_id: Optional[int] = None
    locked: Optional[bool] = None
    signature_base64: Optional[str] = None
    time_enabled: Optional[bool] = None
    erledigt: Optional[bool] = None
    aberechnet: Optional[bool] = None
    kulant: Optional[bool] = None
    randzeit: Optional[bool] = None
    details: Optional[str] = None
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    deadline: Optional[str] = None
    elapsed: Optional[int] = None
    running: Optional[bool] = None
    startTime: Optional[int] = None
    completed_at: Optional[int] = None


class DayTaskGroupCreate(BaseModel):
    title: str
    column: Optional[str] = "todo"
    position: Optional[int] = None
    pinned: Optional[bool] = None


class DayTaskGroupUpdate(BaseModel):
    title: Optional[str] = None
    column: Optional[str] = None
    position: Optional[int] = None
    pinned: Optional[bool] = None


class PinNoteUpdate(BaseModel):
    content: str

class ReportCatalogItemBase(BaseModel):
    title: str
    group: Optional[str] = ""
    system: Optional[str] = ""
    why_text: Optional[str] = ""
    impact: Optional[str] = ""
    duration: Optional[str] = ""
    cost: Optional[str] = ""
    priority: Optional[str] = "Planbar"

class ReportCatalogItemCreate(ReportCatalogItemBase):
    pass

class ReportCatalogItemUpdate(BaseModel):
    title: Optional[str] = None
    group: Optional[str] = None
    system: Optional[str] = None
    why_text: Optional[str] = None
    impact: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[str] = None
    priority: Optional[str] = None

class CustomerActionSuggestionBase(BaseModel):
    text: str

class CustomerActionSuggestionCreate(CustomerActionSuggestionBase):
    pass

class CustomerActionSuggestionUpdate(BaseModel):
    text: Optional[str] = None


class ReportSummarySuggestionBase(BaseModel):
    text: str


class ReportSummarySuggestionCreate(ReportSummarySuggestionBase):
    pass


class ReportSummarySuggestionUpdate(BaseModel):
    text: Optional[str] = None

class ReportItemSchema(BaseModel):
    priority: Optional[str] = "Planbar"
    title: Optional[str] = ""
    system: Optional[str] = ""
    why_text: Optional[str] = ""
    impact: Optional[str] = ""
    duration: Optional[str] = ""
    cost: Optional[str] = ""

class ReportCreate(BaseModel):
    customer: str
    customer_id: Optional[int] = None
    period: Optional[str] = ""
    status: Optional[str] = ""
    summary: Optional[str] = ""
    customer_action_text: Optional[str] = ""
    customer_status: Optional[str] = ""
    items: List[ReportItemSchema] = []


class ReportUpdate(BaseModel):
    sent: Optional[bool] = None
    sent_via: Optional[str] = None
    sent_to: Optional[str] = None


class ReportEdit(BaseModel):
    customer: Optional[str] = None
    customer_id: Optional[int] = None
    period: Optional[str] = None
    status: Optional[str] = None
    summary: Optional[str] = None
    customer_action_text: Optional[str] = None
    customer_status: Optional[str] = None
    items: Optional[List[ReportItemSchema]] = None

class IntegrationSettingsUpdate(BaseModel):
    rmm_host: Optional[str] = None
    rmm_user: Optional[str] = None
    rmm_password: Optional[str] = None
    pbx_base_url: Optional[str] = None
    pbx_username: Optional[str] = None
    pbx_password: Optional[str] = None
    pbx_refresh_token: Optional[str] = None
    pbx_api_key_id: Optional[str] = None
    pbx_api_key_secret: Optional[str] = None
    pbx_customer_account: Optional[str] = None


class SmtpSettingsUpdate(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    use_tls: Optional[bool] = None
    use_ssl: Optional[bool] = None
    beacon_base_url: Optional[str] = None


class CustomerMetricsSettingsUpdate(BaseModel):
    office_address: Optional[str] = None
    km_rate_eur: Optional[str] = None
    min_distance_km: Optional[str] = None
    min_fee_eur: Optional[str] = None
    hourly_rate_eur: Optional[str] = None


class OfferSettingsUpdate(BaseModel):
    offer_number_format: Optional[str] = None


class ReportSendRequest(BaseModel):
    to: str
    subject: Optional[str] = None
    html: str
    text: Optional[str] = None

class OfferSendRequest(BaseModel):
    to: str
    subject: Optional[str] = None
    html: str
    text: Optional[str] = None


class OfferSaveRequest(BaseModel):
    reference: Optional[str] = ""
    customer: Optional[str] = ""
    status: Optional[str] = ""
    data: Dict[str, Any]


class OfferSaveResponse(BaseModel):
    id: int
    guid: str
    confirm_url: str


class OfferCustomerConfirm(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    note: Optional[str] = ""

class PbxPhonebookCreate(BaseModel):
    name: Optional[str] = ""
    number: Optional[str] = ""
    is_global: Optional[bool] = False
    company: Optional[str] = ""
    email: Optional[str] = ""
    note: Optional[str] = ""

class PbxPhonebookUpdate(BaseModel):
    name: Optional[str] = None
    number: Optional[str] = None
    is_global: Optional[bool] = None
    company: Optional[str] = None
    email: Optional[str] = None
    note: Optional[str] = None

class ActionAiRequest(BaseModel):
    text: str

class OfferAiRequest(BaseModel):
    mode: str
    current_text: Optional[str] = ""
    context: Optional[str] = ""


class DebugClearRequest(BaseModel):
    table: str

# ================= APP ======================
app = FastAPI(title="QT-Workbench Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= HELPERS ==================
def serialize_day_task(t: DayTask) -> Dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "customer": t.customer,
        "customer_number": t.customer_number,
        "status": t.status,
        "task_id": t.task_id,
        "group_id": t.group_id,
        "locked": t.locked,
        "signature_base64": t.signature_base64,
        "time_enabled": t.time_enabled,
        "erledigt": t.erledigt,
        "aberechnet": t.aberechnet,
        "kulant": t.kulant,
        "randzeit": t.randzeit,
        "details": t.details,
        "arrival_time": t.arrival_time,
        "departure_time": t.departure_time,
        "deadline": t.deadline,
        "elapsed": t.elapsed,
        "running": t.running,
        "startTime": t.startTime,
        "completed_at": t.completed_at,
        "created_at": t.created_at,
    }


def serialize_day_task_group(g: DayTaskGroup) -> Dict[str, Any]:
    return {
        "id": g.id,
        "title": g.title,
        "column": g.column,
        "position": g.position,
        "pinned": g.pinned,
        "created_at": g.created_at,
    }


def serialize_customer(c: Customer) -> Dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "creditor_number": c.creditor_number,
        "short_code": c.short_code,
        "email": c.email,
        "time_tracking_enabled": c.time_tracking_enabled,
        "street": c.street,
        "postal_code": c.postal_code,
        "city": c.city,
        "country": c.country,
        "phones": [serialize_customer_phone(p) for p in c.phones],
    }


def serialize_customer_phone(p: CustomerPhone) -> Dict[str, Any]:
    return {
        "id": p.id,
        "label": p.label,
        "number": p.number,
    }


def _normalize_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = "".join(ch for ch in str(phone) if ch.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = "43" + digits[1:]
    return digits


def _normalize_phone_for_store(phone: Optional[str]) -> str:
    normalized = _normalize_phone(phone)
    if not normalized:
        return str(phone or "").strip()
    return f"+{normalized}"


def _geocode(address: str) -> Optional[tuple[float, float]]:
    key = address.strip()
    if not key:
        return None
    if key in _geo_cache:
        return _geo_cache[key]
    now_ms = int(time.time() * 1000)
    with SessionLocal() as db:
        cached = db.query(GeoCache).filter(GeoCache.address == key).first()
        if cached and cached.updated_at and now_ms - cached.updated_at < GEO_CACHE_TTL_MS:
            if cached.lat and cached.lon:
                coords = (float(cached.lat), float(cached.lon))
                _geo_cache[key] = coords
                return coords
            _geo_cache[key] = None
            return None
    try:
        res = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": key, "format": "json", "limit": 1},
            headers={"User-Agent": "QT-Workbench/1.0"},
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        if not data:
            with SessionLocal() as db:
                entry = db.query(GeoCache).filter(GeoCache.address == key).first()
                if not entry:
                    entry = GeoCache(address=key)
                    db.add(entry)
                entry.lat = ""
                entry.lon = ""
                entry.updated_at = now_ms
                db.commit()
            _geo_cache[key] = None
            return None
        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
        with SessionLocal() as db:
            entry = db.query(GeoCache).filter(GeoCache.address == key).first()
            if not entry:
                entry = GeoCache(address=key)
                db.add(entry)
            entry.lat = str(lat)
            entry.lon = str(lon)
            entry.updated_at = now_ms
            db.commit()
        _geo_cache[key] = (lat, lon)
        return lat, lon
    except requests.RequestException:
        _geo_cache[key] = None
        return None


def _route_distance_km(origin: tuple[float, float], dest: tuple[float, float]) -> Optional[float]:
    now_ms = int(time.time() * 1000)
    origin_lat = f"{origin[0]:.6f}"
    origin_lon = f"{origin[1]:.6f}"
    dest_lat = f"{dest[0]:.6f}"
    dest_lon = f"{dest[1]:.6f}"
    with SessionLocal() as db:
        cached = (
            db.query(RouteCache)
            .filter(
                RouteCache.origin_lat == origin_lat,
                RouteCache.origin_lon == origin_lon,
                RouteCache.dest_lat == dest_lat,
                RouteCache.dest_lon == dest_lon,
            )
            .first()
        )
        if cached and cached.updated_at and now_ms - cached.updated_at < ROUTE_CACHE_TTL_MS:
            if cached.distance_km:
                return float(cached.distance_km)
            return None
    try:
        url = (
            "https://router.project-osrm.org/route/v1/driving/"
            f"{origin[1]},{origin[0]};{dest[1]},{dest[0]}"
        )
        res = requests.get(url, params={"overview": "false"}, timeout=10)
        res.raise_for_status()
        data = res.json()
        routes = data.get("routes") or []
        if not routes:
            return None
        distance_m = routes[0].get("distance")
        if distance_m is None:
            return None
        distance_km = round(float(distance_m) / 1000, 1)
        with SessionLocal() as db:
            entry = (
                db.query(RouteCache)
                .filter(
                    RouteCache.origin_lat == origin_lat,
                    RouteCache.origin_lon == origin_lon,
                    RouteCache.dest_lat == dest_lat,
                    RouteCache.dest_lon == dest_lon,
                )
                .first()
            )
            if not entry:
                entry = RouteCache(
                    origin_lat=origin_lat,
                    origin_lon=origin_lon,
                    dest_lat=dest_lat,
                    dest_lon=dest_lon,
                )
                db.add(entry)
            entry.distance_km = str(distance_km)
            entry.updated_at = now_ms
            db.commit()
        return distance_km
    except requests.RequestException:
        return None

def serialize_catalog_item(item: ReportCatalogItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "group": item.group,
        "system": item.system,
        "why_text": item.why_text,
        "impact": item.impact,
        "duration": item.duration,
        "cost": item.cost,
        "priority": item.priority,
    }

def serialize_customer_action(item: CustomerActionSuggestion) -> Dict[str, Any]:
    return {
        "id": item.id,
        "text": item.text,
    }

def serialize_report_summary(item: ReportSummarySuggestion) -> Dict[str, Any]:
    return {
        "id": item.id,
        "text": item.text,
    }

def serialize_report_item(item: ReportItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "priority": item.priority,
        "title": item.title,
        "system": item.system,
        "why_text": item.why_text,
        "impact": item.impact,
        "duration": item.duration,
        "cost": item.cost,
    }

def serialize_report(report: Report) -> Dict[str, Any]:
    return {
        "id": report.id,
        "guid": report.guid,
        "customer": report.customer,
        "customer_id": report.customer_id,
        "period": report.period,
        "status": report.status,
        "summary": report.summary,
        "customer_action_text": report.customer_action_text,
        "customer_status": report.customer_status,
        "created_at": report.created_at,
        "sent_at": report.sent_at,
        "sent_via": report.sent_via,
        "sent_to": report.sent_to,
        "opened_at": report.opened_at,
        "opened_count": report.opened_count,
        "items": [serialize_report_item(i) for i in report.items],
    }

def serialize_integration_settings(settings: IntegrationSettings) -> Dict[str, Any]:
    return {
        "id": settings.id,
        "rmm_host": settings.rmm_host,
        "rmm_user": settings.rmm_user,
        "rmm_password": settings.rmm_password,
        "pbx_base_url": settings.pbx_base_url,
        "pbx_username": settings.pbx_username,
        "has_pbx_password": bool(settings.pbx_password),
        "has_pbx_refresh_token": bool(settings.pbx_refresh_token),
        "pbx_api_key_id": settings.pbx_api_key_id,
        "pbx_customer_account": settings.pbx_customer_account,
        "has_pbx_api_key_secret": bool(settings.pbx_api_key_secret),
    }


def serialize_smtp_settings(settings: SmtpSettings) -> Dict[str, Any]:
    return {
        "id": settings.id,
        "host": settings.host,
        "port": settings.port,
        "username": settings.username,
        "sender_name": settings.sender_name,
        "sender_email": settings.sender_email,
        "use_tls": settings.use_tls,
        "use_ssl": settings.use_ssl,
        "beacon_base_url": settings.beacon_base_url,
        "has_password": bool(settings.password),
    }


def serialize_offer_settings(settings: OfferSettings) -> Dict[str, Any]:
    return {
        "id": settings.id,
        "offer_number_format": settings.offer_number_format,
    }

def serialize_pbx_phonebook_entry(entry: PbxPhonebookEntry) -> Dict[str, Any]:
    return {
        "id": entry.id,
        "name": entry.name,
        "number": entry.number,
        "is_global": entry.is_global,
        "company": entry.company,
        "email": entry.email,
        "note": entry.note,
        "created_at": entry.created_at,
    }

def _normalize_phonebook_entry(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(item, dict):
        return None
    name = ""
    number = ""
    company = item.get("company") or ""
    email = item.get("email") or ""
    note = item.get("note") or ""
    is_global = item.get("isGlobal") or item.get("is_global") or False
    data = item.get("data")
    if isinstance(data, list):
        for entry in data:
            if not isinstance(entry, dict):
                continue
            key = entry.get("name")
            value = entry.get("value")
            if key == "displayName" and value:
                name = value
            elif key == "displayNumber" and value:
                number = value
    name = name or item.get("displayName") or item.get("name") or ""
    number = number or item.get("displayNumber") or item.get("number") or item.get("phoneNumber") or ""
    remote_id = item.get("id") or item.get("phoneBookId") or item.get("identifier") or ""
    return {
        "id": remote_id or item.get("uuid") or item.get("key") or "",
        "name": name,
        "number": number,
        "is_global": bool(is_global),
        "company": company,
        "email": email,
        "note": note,
    }

def _extract_phonebook_entries(payload: Any) -> List[Dict[str, Any]]:
    items: List[Any] = []
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        for key in ["items", "data", "entries", "phoneBooks", "phonebooks", "results", "content"]:
            value = payload.get(key)
            if isinstance(value, list):
                items = value
                break
    entries: List[Dict[str, Any]] = []
    for item in items:
        normalized = _normalize_phonebook_entry(item)
        if normalized and (normalized.get("name") or normalized.get("number")):
            entries.append(normalized)
    return entries

def _get_pbx_credentials(session: SessionLocal) -> Tuple[str, str, str, str]:
    settings = _get_settings(session)
    base_url = (settings.pbx_base_url or "").strip()
    api_key_id = (settings.pbx_api_key_id or "").strip()
    api_key_secret = (settings.pbx_api_key_secret or "").strip()
    customer_account = (settings.pbx_customer_account or "").strip()
    if not base_url or not api_key_id or not api_key_secret or not customer_account:
        raise HTTPException(400, "PBX API credentials missing")
    return base_url, api_key_id, api_key_secret, customer_account

def _nfon_request(
    method: str,
    base_url: str,
    api_key_id: str,
    api_key_secret: str,
    path: str,
    body_obj: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    body = json.dumps(body_obj) if body_obj is not None else ""
    content_md5 = hashlib.md5(body.encode("utf-8")).hexdigest() if body else ""
    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    content_type = "application/json" if body else ""
    string_to_sign = f"{method}\\n{content_md5}\\n{content_type}\\n{date}\\n{path}"
    signature = hmac.new(api_key_secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1)
    signature_b64 = base64.b64encode(signature.digest()).decode("utf-8")
    headers = {
        "Authorization": f"NFON-API {api_key_id}:{signature_b64}",
        "x-nfon-date": date,
    }
    if body:
        headers["Content-Type"] = content_type
        headers["Content-MD5"] = content_md5
    response = requests.request(
        method,
        f"{base_url}{path}",
        headers=headers,
        data=body if body else None,
        timeout=20,
    )
    if not response.ok:
        raise HTTPException(response.status_code, response.text)
    try:
        return response.json()
    except ValueError:
        return {"raw": response.text}


def _build_offer_confirm_url(request: Request, guid: str) -> str:
    base = (os.environ.get("OFFER_CONFIRM_BASE_URL") or "").strip()
    if not base:
        base = str(request.base_url).rstrip("/")
    return f"{base}/offers/confirm/{guid}"


def serialize_customer_metrics_settings(settings: CustomerMetricsSettings) -> Dict[str, Any]:
    return {
        "id": settings.id,
        "office_address": settings.office_address,
        "km_rate_eur": settings.km_rate_eur,
        "min_distance_km": settings.min_distance_km,
        "min_fee_eur": settings.min_fee_eur,
        "hourly_rate_eur": settings.hourly_rate_eur,
    }


def _get_smtp_settings(db) -> SmtpSettings:
    settings = db.query(SmtpSettings).first()
    if not settings:
        settings = SmtpSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _get_offer_settings(db) -> OfferSettings:
    settings = db.query(OfferSettings).first()
    if not settings:
        settings = OfferSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _get_customer_metrics_settings(db) -> CustomerMetricsSettings:
    settings = db.query(CustomerMetricsSettings).first()
    if not settings:
        settings = CustomerMetricsSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def coerce_action_fields(payload: Dict[str, Any]) -> Dict[str, str]:
    fields = ["title", "system", "why_text", "impact", "duration", "cost", "priority"]
    normalized = {field: str(payload.get(field) or "") for field in fields}
    impact_options = {"Keine Unterbrechung", "Kurzunterbrechung", "Wartungsfenster"}
    if normalized["impact"] not in impact_options:
        normalized["impact"] = "Keine Unterbrechung"
    duration_range = None
    duration = normalized["duration"].strip()
    if duration:
        lower = duration.lower()
        is_minutes = "min" in lower

        def parse_number(raw: str) -> Optional[float]:
            cleaned = "".join(ch for ch in raw if ch.isdigit() or ch in {",", "."})
            if not cleaned:
                return None
            return float(cleaned.replace(",", "."))

        def round_quarter(value: float) -> float:
            return round(value * 4) / 4

        def fmt_hours(value: float) -> str:
            rounded = round_quarter(value)
            if rounded.is_integer():
                return f"{int(rounded)}"
            text = f"{rounded:.2f}".rstrip("0").rstrip(".")
            return text.replace(".", ",")

        if "-" in duration:
            parts = [p for p in duration.split("-") if p.strip()]
            if len(parts) >= 2:
                start = parse_number(parts[0])
                end = parse_number(parts[1])
                if start is not None and end is not None:
                    if is_minutes:
                        start /= 60
                        end /= 60
                    if end < start:
                        start, end = end, start
                    duration_range = (start, end)
                    normalized["duration"] = f"{fmt_hours(start)}-{fmt_hours(end)} h"
                else:
                    normalized["duration"] = ""
            else:
                normalized["duration"] = ""
        else:
            value = parse_number(duration)
            if value is None:
                normalized["duration"] = ""
            else:
                if is_minutes:
                    value /= 60
                duration_range = (value, value)
                normalized["duration"] = f"{fmt_hours(value)} h"
    cost = normalized["cost"]
    if cost:
        cleaned = (
            cost.replace("€", "")
            .replace("EUR", "")
            .replace("eur", "")
            .replace("ca.", "")
            .replace("ca", "")
            .replace("etwa", "")
        )
        cleaned = "".join(ch for ch in cleaned if ch.isdigit() or ch in {",", ".", "-"})
        digits = "".join(ch for ch in cleaned if ch.isdigit())
        if digits:
            value = int(digits)
            low = value
            high = value
            if "-" in cleaned:
                parts = [p for p in cleaned.split("-") if p.strip()]
                if len(parts) >= 2:
                    try:
                        low = int("".join(ch for ch in parts[0] if ch.isdigit()))
                        high = int("".join(ch for ch in parts[1] if ch.isdigit()))
                    except ValueError:
                        low = value
                        high = value
            if high < low:
                low, high = high, low
            normalized["cost"] = f"{low}-{high} €"
        else:
            normalized["cost"] = ""
    if not normalized["cost"]:
        if duration_range:
            low = int(round(duration_range[0] * 120))
            high = int(round(duration_range[1] * 120))
            if high < low:
                low, high = high, low
            normalized["cost"] = f"{low}-{high} €"
        else:
            normalized["cost"] = "0-0 €"
    return normalized


def parse_action_json(raw: Any) -> Optional[Dict[str, str]]:
    if isinstance(raw, dict):
        return coerce_action_fields(raw)
    if not raw or not isinstance(raw, str):
        return None
    try:
        return coerce_action_fields(json.loads(raw))
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            return coerce_action_fields(json.loads(raw[start : end + 1]))
        except json.JSONDecodeError:
            return None

# ================= CUSTOMERS =================
@app.get("/api/customers")
def get_customers():
    with SessionLocal() as db:
        customers = db.query(Customer).all()
        return [serialize_customer(c) for c in customers]


# ============ REPORT CUSTOMERS (DUMMY) ============
@app.get("/api/report_customers")
def get_report_customers():
    return []


@app.post("/api/customers")
def create_customer(data: CustomerCreate):
    with SessionLocal() as db:
        customer = Customer(
            name=data.name,
            creditor_number=data.creditor_number or "",
            short_code=data.short_code or "",
            email=data.email or "",
            time_tracking_enabled=bool(data.time_tracking_enabled),
            street=data.street or "",
            postal_code=data.postal_code or "",
            city=data.city or "",
            country=data.country or "",
        )
        db.add(customer)
        db.flush()
        if data.phones:
            for phone in data.phones:
                normalized_number = _normalize_phone_for_store(phone.number)
                customer.phones.append(
                    CustomerPhone(
                        label=phone.label or "",
                        number=normalized_number or ""
                    )
                )
        db.commit()
        return serialize_customer(customer)


@app.patch("/api/customers/{customer_id}")
def update_customer(customer_id: int, data: CustomerUpdate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")

        for field, value in data.dict(exclude_unset=True, exclude={"phones"}).items():
            setattr(customer, field, value)

        if data.phones is not None:
            existing = {phone.id: phone for phone in customer.phones}
            keep_ids = set()
            for phone in data.phones:
                normalized_number = _normalize_phone_for_store(phone.number)
                if phone.id and phone.id in existing:
                    entry = existing[phone.id]
                    entry.label = phone.label or ""
                    entry.number = normalized_number or ""
                    keep_ids.add(phone.id)
                else:
                    entry = CustomerPhone(
                        label=phone.label or "",
                        number=normalized_number or ""
                    )
                    customer.phones.append(entry)
                    db.flush()
                    if entry.id:
                        keep_ids.add(entry.id)
            customer.phones = [phone for phone in customer.phones if phone.id in keep_ids]

        db.commit()
        db.refresh(customer)
        return serialize_customer(customer)


@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")

        db.delete(customer)
        db.commit()
        return {"status": "deleted"}


@app.get("/api/customers/{customer_id}/metrics")
def get_customer_metrics(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        now_ms = int(time.time() * 1000)
        customer_name = (customer.name or "").strip().lower()
        customer_number = (customer.creditor_number or "").strip()
        day_task_filters = []
        if customer_name:
            day_task_filters.append(
                func.lower(func.trim(DayTask.customer)) == customer_name
            )
        if customer_number:
            day_task_filters.append(func.trim(DayTask.customer_number) == customer_number)
        open_time_tasks = 0
        open_time_ms = 0
        if day_task_filters:
            task_query = (
                db.query(DayTask)
                .filter(or_(*day_task_filters))
                .filter(DayTask.time_enabled == True)
            )
            for task in task_query.all():
                if task.status == "done":
                    continue
                open_time_tasks += 1
                elapsed = task.elapsed or 0
                if task.running and task.startTime:
                    elapsed += max(0, now_ms - task.startTime)
                open_time_ms += elapsed
        open_day_tasks = 0
        if day_task_filters:
            open_day_tasks = (
                db.query(DayTask)
                .filter(DayTask.status != "done")
                .filter(DayTask.time_enabled == False)
                .filter(or_(*day_task_filters))
                .count()
            )
        open_tasks = open_time_tasks + open_day_tasks
        address_parts = [customer.street, customer.postal_code, customer.city, customer.country]
        address = ", ".join([part for part in address_parts if part])
        phone_numbers = [phone.number for phone in customer.phones]

    with SessionLocal() as db:
        metrics_settings = _get_customer_metrics_settings(db)
    office_coords = _geocode(metrics_settings.office_address)
    customer_coords = _geocode(address) if address else None
    distance_km = None
    if office_coords and customer_coords:
        distance_km = _route_distance_km(office_coords, customer_coords)

    phone_digits = []
    for phone in phone_numbers:
        normalized = _normalize_phone(phone)
        if normalized and normalized not in phone_digits:
            phone_digits.append(normalized)

    start_ms = int(time.time() * 1000) - 30 * 24 * 60 * 60 * 1000
    missed_calls = 0
    total_seconds = 0
    if phone_digits:
        conditions = []
        params = {"since": start_ms}
        for idx, digits in enumerate(phone_digits):
            params[f"p{idx}"] = f"%{digits}"
            conditions.append(
                f"(regexp_replace(from_number, '\\\\D', '', 'g') LIKE :p{idx} "
                f"OR regexp_replace(to_number, '\\\\D', '', 'g') LIKE :p{idx})"
            )
        where_clause = " OR ".join(conditions)
        sql = (
            "SELECT COALESCE(SUM(duration), 0) AS total_seconds, "
            "COALESCE(SUM(CASE WHEN answered = false THEN 1 ELSE 0 END), 0) AS missed_calls "
            "FROM telephony_calls "
            "WHERE start_time >= :since AND (" + where_clause + ")"
        )
        try:
            with engine.begin() as connection:
                row = connection.execute(text(sql), params).mappings().first()
                if row:
                    total_seconds = int(row.get("total_seconds") or 0)
                    missed_calls = int(row.get("missed_calls") or 0)
        except Exception:
            total_seconds = 0
            missed_calls = 0

    total_minutes = round(total_seconds / 60, 1) if total_seconds else 0
    try:
        km_rate = float(metrics_settings.km_rate_eur or 0)
        min_distance_km = float(metrics_settings.min_distance_km or 0)
        min_fee_eur = float(metrics_settings.min_fee_eur or 0)
        hourly_rate = float(metrics_settings.hourly_rate_eur or 0)
    except ValueError:
        km_rate = 0.0
        min_distance_km = 0.0
        min_fee_eur = 0.0
        hourly_rate = 0.0
    mileage_eur = None
    if distance_km is not None:
        round_trip_km = distance_km * 2
        if min_distance_km and round_trip_km < min_distance_km and min_fee_eur:
            mileage_eur = round(min_fee_eur, 2)
        else:
            mileage_eur = round(round_trip_km * km_rate, 2)
    open_time_minutes = round(open_time_ms / 60000, 1) if open_time_ms else 0
    open_time_hours = round(open_time_ms / 3600000, 2) if open_time_ms else 0
    estimated_revenue = round(open_time_hours * hourly_rate, 2) if hourly_rate else 0

    return {
        "openTasks": open_tasks,
        "openTimeTasks": open_time_tasks,
        "openDayTasks": open_day_tasks,
        "openTimeMinutes": open_time_minutes,
        "estimatedRevenueEur": estimated_revenue,
        "distanceKm": distance_km,
        "mileageEur": mileage_eur,
        "missedCalls": missed_calls,
        "totalMinutes": total_minutes
    }


# ================= DAY PLAN TASKS =================
@app.get("/api/day_tasks")
def get_day_tasks():
    with SessionLocal() as db:
        tasks = db.query(DayTask).order_by(DayTask.created_at.desc()).all()
        return [serialize_day_task(t) for t in tasks]


@app.get("/api/day_task_groups")
def get_day_task_groups():
    with SessionLocal() as db:
        groups = (
            db.query(DayTaskGroup)
            .order_by(DayTaskGroup.column.asc(), DayTaskGroup.position.asc(), DayTaskGroup.created_at.asc())
            .all()
        )
        return [serialize_day_task_group(g) for g in groups]


@app.post("/api/day_task_groups")
def create_day_task_group(data: DayTaskGroupCreate):
    with SessionLocal() as db:
        column = data.column or "todo"
        if data.position is None:
            max_position = (
                db.query(func.max(DayTaskGroup.position))
                .filter(DayTaskGroup.column == column)
                .scalar()
            )
            position = int(max_position or 0)
            if max_position is not None:
                position += 1
        else:
            position = int(data.position)
        group = DayTaskGroup(
            title=data.title,
            column=column,
            position=position,
            pinned=bool(data.pinned),
        )
        db.add(group)
        db.commit()
        db.refresh(group)
        return serialize_day_task_group(group)


@app.patch("/api/day_task_groups/{group_id}")
def update_day_task_group(group_id: int, data: DayTaskGroupUpdate):
    with SessionLocal() as db:
        group = db.query(DayTaskGroup).get(group_id)
        if not group:
            raise HTTPException(404, "Group not found")
        if data.title is not None:
            group.title = data.title
        if data.column is not None:
            group.column = data.column
        if data.position is not None:
            group.position = int(data.position)
        if data.pinned is not None:
            group.pinned = bool(data.pinned)
        db.commit()
        db.refresh(group)
        return serialize_day_task_group(group)


@app.delete("/api/day_task_groups/{group_id}")
def delete_day_task_group(group_id: int):
    with SessionLocal() as db:
        group = db.query(DayTaskGroup).get(group_id)
        if not group:
            raise HTTPException(404, "Group not found")
        db.query(DayTask).filter(DayTask.group_id == group_id).update({DayTask.group_id: None})
        db.delete(group)
        db.commit()
        return {"status": "deleted"}


@app.post("/api/day_tasks")
def create_day_task(data: DayTaskCreate):
    with SessionLocal() as db:
        now_ms = int(time.time() * 1000)
        status = data.status or "todo"
        erledigt = bool(data.erledigt) or status == "done"
        task = DayTask(
            title=data.title,
            customer=data.customer or "",
            customer_number=data.customer_number or "",
            status=status,
            group_id=data.group_id,
            locked=bool(data.locked),
            signature_base64=data.signature_base64 or "",
            time_enabled=bool(data.time_enabled),
            erledigt=erledigt,
            aberechnet=bool(data.aberechnet),
            kulant=bool(data.kulant),
            details=data.details or "",
            arrival_time=data.arrival_time or "",
            departure_time=data.departure_time or "",
            deadline=data.deadline or "",
            elapsed=int(data.elapsed or 0),
            running=bool(data.running),
            startTime=int(data.startTime or 0),
            completed_at=now_ms if erledigt else 0,
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        return serialize_day_task(task)


@app.patch("/api/day_tasks/{task_id}")
def update_day_task(task_id: int, data: DayTaskUpdate):
    with SessionLocal() as db:
        task = db.query(DayTask).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        now_ms = int(time.time() * 1000)
        string_fields = {
            "title",
            "customer",
            "customer_number",
            "status",
            "signature_base64",
            "details",
            "arrival_time",
            "departure_time",
            "deadline",
        }
        for field, value in data.dict(exclude_unset=True).items():
            if value is None and field in string_fields:
                setattr(task, field, "")
            else:
                setattr(task, field, value)
        if data.erledigt is not None and data.status is None:
            task.status = "done" if data.erledigt else "todo"
        if data.status is not None or data.erledigt is not None:
            is_done = task.status == "done"
            task.erledigt = is_done
            task.completed_at = now_ms if is_done else 0
        db.commit()
        db.refresh(task)
        return serialize_day_task(task)


@app.delete("/api/day_tasks/{task_id}")
def delete_day_task(task_id: int):
    with SessionLocal() as db:
        task = db.query(DayTask).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        db.delete(task)
        db.commit()
        return {"status": "deleted"}


@app.patch("/api/day_tasks/{task_id}/toggle_timer")
def toggle_day_task_timer(task_id: int):
    now = int(time.time() * 1000)
    with SessionLocal() as db:
        task = db.query(DayTask).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        task.time_enabled = True
        if task.running:
            task.elapsed += max(0, now - (task.startTime or 0))
            task.running = False
            task.startTime = 0
        else:
            task.running = True
            task.startTime = now
        db.commit()
        db.refresh(task)
        return serialize_day_task(task)

# ================= PINBOARD =================
@app.get("/api/pinboard")
def get_pinboard():
    with SessionLocal() as db:
        note = db.query(PinNote).first()
        if not note:
            note = PinNote(content="")
            db.add(note)
            db.commit()
        return {"id": note.id, "content": note.content}


@app.patch("/api/pinboard/{note_id}")
def update_pinboard(note_id: int, data: PinNoteUpdate):
    with SessionLocal() as db:
        note = db.query(PinNote).get(note_id)
        if not note:
            raise HTTPException(404, "Pinboard not found")

        note.content = data.content
        db.commit()
        return {"id": note.id, "content": note.content}

# ============ INTEGRATION SETTINGS ============
@app.get("/api/integrations")
def get_integrations():
    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
        return serialize_integration_settings(settings)


@app.put("/api/integrations")
def update_integrations(data: IntegrationSettingsUpdate):
    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.flush()

        sensitive_fields = {"rmm_password", "pbx_password", "pbx_refresh_token", "pbx_api_key_secret"}
        for field, value in data.dict(exclude_unset=True).items():
            if field in sensitive_fields and value in (None, ""):
                continue
            setattr(settings, field, value)

        db.commit()
        return serialize_integration_settings(settings)

# ============ PBX PHONEBOOK ============
@app.get("/api/pbx_phonebook")
def list_pbx_phonebook():
    with SessionLocal() as db:
        entries = (
            db.query(PbxPhonebookEntry)
            .order_by(PbxPhonebookEntry.name.asc(), PbxPhonebookEntry.id.asc())
            .all()
        )
        return [serialize_pbx_phonebook_entry(entry) for entry in entries]


@app.post("/api/pbx_phonebook")
def create_pbx_phonebook(data: PbxPhonebookCreate):
    with SessionLocal() as db:
        entry = PbxPhonebookEntry(
            name=data.name or "",
            number=data.number or "",
            is_global=bool(data.is_global),
            company=data.company or "",
            email=data.email or "",
            note=data.note or "",
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return serialize_pbx_phonebook_entry(entry)


@app.patch("/api/pbx_phonebook/{entry_id}")
def update_pbx_phonebook(entry_id: int, data: PbxPhonebookUpdate):
    with SessionLocal() as db:
        entry = db.query(PbxPhonebookEntry).get(entry_id)
        if not entry:
            raise HTTPException(404, "Entry not found")
        for field, value in data.dict(exclude_unset=True).items():
            if field == "is_global":
                setattr(entry, field, bool(value))
            else:
                setattr(entry, field, value if value is not None else "")
        db.commit()
        db.refresh(entry)
        return serialize_pbx_phonebook_entry(entry)


@app.delete("/api/pbx_phonebook/{entry_id}")
def delete_pbx_phonebook(entry_id: int):
    with SessionLocal() as db:
        entry = db.query(PbxPhonebookEntry).get(entry_id)
        if not entry:
            raise HTTPException(404, "Entry not found")
        db.delete(entry)
        db.commit()
        return {"status": "deleted"}


@app.get("/api/pbx_phonebook/remote")
def list_remote_pbx_phonebook(pagesize: int = 100, offset: int = 0, q: Optional[str] = None):
    with SessionLocal() as db:
        base_url, api_key_id, api_key_secret, customer_account = _get_pbx_credentials(db)
    query = []
    if pagesize:
        query.append(f"_pagesize={pagesize}")
    if offset:
        query.append(f"_offset={offset}")
    if q:
        query.append(f"_q={q}")
    query_string = f"?{'&'.join(query)}" if query else ""
    path = f"/api/customers/{customer_account}/phone-books{query_string}"
    payload = _nfon_request("GET", base_url, api_key_id, api_key_secret, path)
    return _extract_phonebook_entries(payload)


@app.post("/api/pbx_phonebook/remote")
def create_remote_pbx_phonebook(data: PbxPhonebookCreate):
    with SessionLocal() as db:
        base_url, api_key_id, api_key_secret, customer_account = _get_pbx_credentials(db)
    body = {
        "data": [
            {"name": "displayName", "value": data.name or ""},
            {"name": "displayNumber", "value": data.number or ""},
        ]
    }
    path = f"/api/customers/{customer_account}/phone-books"
    payload = _nfon_request("POST", base_url, api_key_id, api_key_secret, path, body_obj=body)
    entries = _extract_phonebook_entries(payload)
    if entries:
        return entries[0]
    return {"name": data.name or "", "number": data.number or ""}


@app.get("/api/pbx_phonebook/health")
def pbx_phonebook_health():
    with SessionLocal() as db:
        try:
            base_url, api_key_id, api_key_secret, customer_account = _get_pbx_credentials(db)
        except HTTPException as exc:
            return {
                "ok": False,
                "status_code": exc.status_code,
                "error": exc.detail,
                "entry_count": 0,
                "base_url": "",
                "customer_account": "",
                "response_preview": "",
            }
    path = f"/api/customers/{customer_account}/phone-books?_pagesize=1"
    date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    string_to_sign = f"GET\n\n\n{date}\n{path}"
    signature = hmac.new(api_key_secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1)
    signature_b64 = base64.b64encode(signature.digest()).decode("utf-8")
    headers = {
        "Authorization": f"NFON-API {api_key_id}:{signature_b64}",
        "x-nfon-date": date,
    }
    try:
        response = requests.request("GET", f"{base_url}{path}", headers=headers, timeout=20)
    except Exception as exc:
        return {
            "ok": False,
            "status_code": None,
            "error": str(exc),
            "entry_count": 0,
            "base_url": base_url,
            "customer_account": customer_account,
            "response_preview": "",
        }
    text = response.text or ""
    entries = []
    try:
        entries = _extract_phonebook_entries(response.json())
    except ValueError:
        entries = []
    return {
        "ok": response.ok,
        "status_code": response.status_code,
        "error": "" if response.ok else text[:300],
        "entry_count": len(entries),
        "base_url": base_url,
        "customer_account": customer_account,
        "response_preview": text[:300],
    }

# ============== OLLAMA AI =================
@app.post("/api/ai_action")
def generate_action(data: ActionAiRequest):
    text = (data.text or "").strip()
    if not text:
        raise HTTPException(400, "Text required")

    prompt = (
        "Du bist ein Assistent fuer IT-Kundenberichte. "
        "Erzeuge aus dem Text eine konkrete Massnahme als JSON. "
        "Antworte ausschliesslich mit JSON und den Schluesseln: "
        "title, system, why_text, impact, duration, cost, priority. "
        "Nutze deutsche Begriffe und einfache, klare Sprache, "
        "die Kunden ohne IT-Kenntnisse verstehen. "
        "Alle Felder muessen befuellt sein (keine leeren Strings). "
        "Wenn Informationen fehlen, setze plausible Standardwerte. "
        "Fuelle fehlende Details aktiv auf, statt den Text nur zu wiederholen. "
        "Die Antwort darf etwas ausfuehrlicher sein: "
        "why_text 1-2 Saetze, title kurz und klar, system konkret. "
        "priority ist Dringend, Planbar oder Hinweis.\n\n"
        "Heuristiken: "
        "Systeme: Server, Client, Netzwerk, Firewall, Backup, M365/Exchange, WLAN, Storage, Drucker, Allgemein. "
        "Leite system anhand des Texts ab, sonst \"Allgemein\". "
        "Impact abschaetzen: "
        "Updates/Reboots/Firewall/Netzwerk -> \"Kurzunterbrechung\" oder \"Wartungsfenster\"; "
        "Pruefungen/Monitoring/Reports -> \"Keine Unterbrechung\". "
        "Dauer immer in 0,25h Schritten (z. B. \"0,5-1,0 h\" oder \"0,75 h\"). "
        "Dauer fuer Updates: \"0,5-1,0 h\" (sonst \"0,5 h\"). "
        "Kosten: 120 EUR pro Stunde; rechne passend zur Dauer. "
        "Gib Kosten immer als zwei Werte mit Euro (z. B. \"60-120 €\").\n\n"
        "Beispiel fuer Kurztext 'test': "
        "{\"title\":\"Kurze Systempruefung\","
        "\"system\":\"Allgemein\","
        "\"why_text\":\"Kurzer Schnellcheck, um Auffaelligkeiten zu erkennen.\","
        "\"impact\":\"Keine Unterbrechung\","
        "\"duration\":\"0,25 h\","
        "\"cost\":\"30-30 €\","
        "\"priority\":\"Planbar\"}\n\n"
        f"Text: {text}"
    )

    try:
        res = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "format": "json",
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=60,
        )
        res.raise_for_status()
        payload = res.json()
    except requests.RequestException as exc:
        raise HTTPException(502, "Ollama request failed") from exc

    action = parse_action_json(payload.get("response"))
    if not action:
        raise HTTPException(502, "Invalid AI response")


@app.post("/api/offer_ai_text")
def generate_offer_text(data: OfferAiRequest):
    mode = (data.mode or "").strip().lower()
    current_text = (data.current_text or "").strip()
    context = (data.context or "").strip()
    if not mode:
        raise HTTPException(400, "Mode required")

    mode_instructions = {
        "cover_intro": "Schreibe einen kurzen Deckblatt-Introtext (2-4 Saetze).",
        "overview": "Schreibe einen kurzen Ueberblick fuer den Kunden (2-4 Saetze oder kurze Stichpunkte).",
        "calculation": "Schreibe kurze Hinweise zur Kalkulation (1-3 Saetze).",
        "position_text": "Schreibe einen klaren Positionstext fuer eine Dienstleistung (3-6 Saetze).",
        "device_description": "Schreibe eine kurze Produktbeschreibung fuer Material (3-6 Saetze).",
    }
    instruction = mode_instructions.get(mode, "Schreibe einen kurzen, passenden Text.")

    prompt = (
        "Du bist ein Assistent fuer Angebots-Texte. "
        "Schreibe auf Deutsch, sachlich und klar. "
        "Nutze die Informationen im Kontext. "
        "Wenn bereits Text vorhanden ist, verbessere und ergaenze ihn, "
        "ohne den Inhalt zu wiederholen. "
        "Gib nur den Text zurueck, keine Markdown- oder JSON-Formatierung.\n\n"
        f"Aufgabe: {instruction}\n\n"
        f"Kontext:\n{context if context else 'n/a'}\n\n"
        f"Bereits vorhandener Text:\n{current_text if current_text else 'n/a'}\n"
    )

    try:
        res = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=60,
        )
        res.raise_for_status()
        payload = res.json()
    except requests.RequestException as exc:
        raise HTTPException(502, "Ollama request failed") from exc

    text = (payload.get("response") or "").strip()
    if not text:
        raise HTTPException(502, "Invalid AI response")
    return {"text": text}
    return {"action": action}

# ============== REPORT CATALOG =============
@app.get("/api/report_catalog")
def get_report_catalog():
    with SessionLocal() as db:
        items = db.query(ReportCatalogItem).all()
        return [serialize_catalog_item(i) for i in items]


@app.post("/api/report_catalog")
def create_report_catalog_item(data: ReportCatalogItemCreate):
    with SessionLocal() as db:
        item = ReportCatalogItem(**data.dict())
        db.add(item)
        db.commit()
        return serialize_catalog_item(item)


@app.patch("/api/report_catalog/{item_id}")
def update_report_catalog_item(item_id: int, data: ReportCatalogItemUpdate):
    with SessionLocal() as db:
        item = db.query(ReportCatalogItem).get(item_id)
        if not item:
            raise HTTPException(404, "Catalog item not found")
        for field, value in data.dict(exclude_unset=True).items():
            setattr(item, field, value)
        db.commit()
        return serialize_catalog_item(item)


@app.delete("/api/report_catalog/{item_id}")
def delete_report_catalog_item(item_id: int):
    with SessionLocal() as db:
        item = db.query(ReportCatalogItem).get(item_id)
        if not item:
            raise HTTPException(404, "Catalog item not found")
        db.delete(item)
        db.commit()
        return {"status": "deleted"}

# ============== CUSTOMER ACTIONS =============
@app.get("/api/report_customer_actions")
def get_report_customer_actions():
    with SessionLocal() as db:
        items = db.query(CustomerActionSuggestion).all()
        return [serialize_customer_action(i) for i in items]


@app.post("/api/report_customer_actions")
def create_report_customer_action(data: CustomerActionSuggestionCreate):
    with SessionLocal() as db:
        item = CustomerActionSuggestion(**data.dict())
        db.add(item)
        db.commit()
        return serialize_customer_action(item)


@app.patch("/api/report_customer_actions/{item_id}")
def update_report_customer_action(item_id: int, data: CustomerActionSuggestionUpdate):
    with SessionLocal() as db:
        item = db.query(CustomerActionSuggestion).get(item_id)
        if not item:
            raise HTTPException(404, "Customer action not found")
        for field, value in data.dict(exclude_unset=True).items():
            setattr(item, field, value)
        db.commit()
        return serialize_customer_action(item)


@app.delete("/api/report_customer_actions/{item_id}")
def delete_report_customer_action(item_id: int):
    with SessionLocal() as db:
        item = db.query(CustomerActionSuggestion).get(item_id)
        if not item:
            raise HTTPException(404, "Customer action not found")
        db.delete(item)
        db.commit()
        return {"status": "deleted"}


@app.get("/api/report_summaries")
def get_report_summaries():
    with SessionLocal() as db:
        items = db.query(ReportSummarySuggestion).all()
        return [serialize_report_summary(item) for item in items]


@app.post("/api/report_summaries")
def create_report_summary(data: ReportSummarySuggestionCreate):
    with SessionLocal() as db:
        item = ReportSummarySuggestion(text=data.text)
        db.add(item)
        db.commit()
        db.refresh(item)
        return serialize_report_summary(item)


@app.patch("/api/report_summaries/{item_id}")
def update_report_summary(item_id: int, data: ReportSummarySuggestionUpdate):
    with SessionLocal() as db:
        item = db.query(ReportSummarySuggestion).get(item_id)
        if not item:
            raise HTTPException(404, "Summary not found")
        for field, value in data.dict(exclude_unset=True).items():
            setattr(item, field, value)
        db.commit()
        return serialize_report_summary(item)


@app.delete("/api/report_summaries/{item_id}")
def delete_report_summary(item_id: int):
    with SessionLocal() as db:
        item = db.query(ReportSummarySuggestion).get(item_id)
        if not item:
            raise HTTPException(404, "Summary not found")
        db.delete(item)
        db.commit()
        return {"status": "deleted"}

# ================== REPORTS =================
@app.get("/api/reports")
def get_reports(customer: Optional[str] = None, customer_id: Optional[int] = None):
    with SessionLocal() as db:
        query = db.query(Report)
        if customer_id is not None:
            query = query.filter(Report.customer_id == customer_id)
        elif customer:
            query = query.filter(func.lower(Report.customer) == customer.strip().lower())
        reports = query.all()
        return [serialize_report(r) for r in reports]


@app.get("/api/reports/{report_id}")
def get_report(report_id: int):
    with SessionLocal() as db:
        report = db.query(Report).get(report_id)
        if not report:
            raise HTTPException(404, "Report not found")
        return serialize_report(report)


@app.post("/api/reports")
def create_report(data: ReportCreate):
    with SessionLocal() as db:
        customer_id = data.customer_id
        if not customer_id and data.customer:
            customer = (
                db.query(Customer)
                .filter(func.lower(Customer.name) == data.customer.strip().lower())
                .first()
            )
            customer_id = customer.id if customer else None
        report = Report(
            guid=str(uuid.uuid4()),
            customer=data.customer,
            customer_id=customer_id,
            period=data.period or "",
            status=data.status or "",
            summary=data.summary or "",
            customer_action_text=data.customer_action_text or "",
            customer_status=data.customer_status or "",
        )
        db.add(report)
        db.flush()

        for item in data.items:
            report_item = ReportItem(
                report_id=report.id,
                priority=item.priority or "Planbar",
                title=item.title or "",
                system=item.system or "",
                why_text=item.why_text or "",
                impact=item.impact or "",
                duration=item.duration or "",
                cost=item.cost or "",
            )
            db.add(report_item)

        db.commit()
        db.refresh(report)
        return serialize_report(report)


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int):
    with SessionLocal() as db:
        report = db.query(Report).get(report_id)
        if not report:
            raise HTTPException(404, "Report not found")
        db.delete(report)
        db.commit()
        return {"status": "deleted"}


@app.get("/api/reports/open")
def report_open(guid: str):
    with SessionLocal() as db:
        report = db.query(Report).filter(Report.guid == guid).first()
        if report:
            report.opened_at = int(time.time() * 1000)
            report.opened_count = (report.opened_count or 0) + 1
            db.commit()
    pixel = (
        b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
        b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
        b"\x00\x02\x02D\x01\x00;"
    )
    return Response(content=pixel, media_type="image/gif")


@app.get("/api/smtp_settings")
def get_smtp_settings():
    with SessionLocal() as db:
        settings = _get_smtp_settings(db)
        return serialize_smtp_settings(settings)


@app.put("/api/smtp_settings")
def update_smtp_settings(data: SmtpSettingsUpdate):
    with SessionLocal() as db:
        settings = _get_smtp_settings(db)
        for field, value in data.dict(exclude_unset=True).items():
            if field == "password" and (value is None or value == ""):
                continue
            setattr(settings, field, value)
        db.commit()
        db.refresh(settings)
        return serialize_smtp_settings(settings)


@app.get("/api/offer_settings")
def get_offer_settings():
    with SessionLocal() as db:
        settings = _get_offer_settings(db)
        return serialize_offer_settings(settings)


@app.put("/api/offer_settings")
def update_offer_settings(data: OfferSettingsUpdate):
    with SessionLocal() as db:
        settings = _get_offer_settings(db)
        for field, value in data.dict(exclude_unset=True).items():
            if value is None:
                continue
            setattr(settings, field, value)
        db.commit()
        db.refresh(settings)
        return serialize_offer_settings(settings)


@app.post("/api/offers", response_model=OfferSaveResponse)
def create_offer(data: OfferSaveRequest, request: Request):
    with SessionLocal() as db:
        now_ms = int(time.time() * 1000)
        offer = Offer(
            guid=str(uuid.uuid4()),
            reference=data.reference or "",
            customer=data.customer or "",
            status=data.status or "offen",
            data_json=json.dumps(data.data or {}),
            created_at=now_ms,
            updated_at=now_ms,
        )
        db.add(offer)
        db.commit()
        db.refresh(offer)
        return OfferSaveResponse(
            id=offer.id,
            guid=offer.guid,
            confirm_url=_build_offer_confirm_url(request, offer.guid),
        )


@app.put("/api/offers/{offer_id}", response_model=OfferSaveResponse)
def update_offer(offer_id: int, data: OfferSaveRequest, request: Request):
    with SessionLocal() as db:
        offer = db.query(Offer).get(offer_id)
        if not offer:
            raise HTTPException(404, "Offer not found")
        offer.reference = data.reference or offer.reference
        offer.customer = data.customer or offer.customer
        if data.status is not None:
            offer.status = data.status or offer.status
        offer.data_json = json.dumps(data.data or {})
        offer.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(offer)
        return OfferSaveResponse(
            id=offer.id,
            guid=offer.guid,
            confirm_url=_build_offer_confirm_url(request, offer.guid),
        )


@app.get("/api/customer_metrics_settings")
def get_customer_metrics_settings():
    with SessionLocal() as db:
        settings = _get_customer_metrics_settings(db)
        return serialize_customer_metrics_settings(settings)


@app.put("/api/customer_metrics_settings")
def update_customer_metrics_settings(data: CustomerMetricsSettingsUpdate):
    with SessionLocal() as db:
        settings = _get_customer_metrics_settings(db)
        for field, value in data.dict(exclude_unset=True).items():
            if value is None:
                continue
            setattr(settings, field, value)
        db.commit()
        db.refresh(settings)
        return serialize_customer_metrics_settings(settings)


@app.get("/api/company_stats")
def get_company_stats(days: int = 30):
    safe_days = max(1, min(int(days or 30), 365))
    now_ms = int(time.time() * 1000)
    start_ms = now_ms - safe_days * 24 * 60 * 60 * 1000
    with SessionLocal() as db:
        day_tasks_total = db.query(DayTask).count()
        day_tasks_open = db.query(DayTask).filter(DayTask.status != "done").count()
        day_tasks_done = db.query(DayTask).filter(DayTask.status == "done").count()

        total_time_ms = 0
        open_time_ms = 0
        total_time_tasks = 0
        open_time_tasks = 0
        for task in db.query(DayTask).filter(DayTask.time_enabled == True).all():
            total_time_tasks += 1
            elapsed = task.elapsed or 0
            if task.running and task.startTime:
                elapsed += max(0, now_ms - task.startTime)
            total_time_ms += elapsed
            if task.status != "done":
                open_time_tasks += 1
                open_time_ms += elapsed

        reports_total = db.query(Report).count()
        reports_confirmed = (
            db.query(Report).filter(Report.customer_status == "Bestätigt").count()
        )
        reports_opened = db.query(Report).filter(Report.opened_count > 0).count()
        reports_unread = db.query(Report).filter(Report.opened_count == 0).count()
        reports_sent = db.query(Report).filter(Report.sent_at > 0).count()

        settings = _get_customer_metrics_settings(db)
        try:
            hourly_rate = float(settings.hourly_rate_eur or 0)
        except ValueError:
            hourly_rate = 0.0

    telephony_minutes = 0
    telephony_missed = 0
    try:
        sql = (
            "SELECT COALESCE(SUM(duration), 0) AS total_seconds, "
            "COALESCE(SUM(CASE WHEN answered = false THEN 1 ELSE 0 END), 0) AS missed_calls "
            "FROM telephony_calls "
            "WHERE start_time >= :since"
        )
        with engine.begin() as connection:
            row = connection.execute(text(sql), {"since": start_ms}).mappings().first()
            if row:
                total_seconds = int(row.get("total_seconds") or 0)
                telephony_minutes = round(total_seconds / 60, 1) if total_seconds else 0
                telephony_missed = int(row.get("missed_calls") or 0)
    except Exception:
        telephony_minutes = 0
        telephony_missed = 0

    total_time_hours = round(total_time_ms / 3600000, 2) if total_time_ms else 0
    open_time_hours = round(open_time_ms / 3600000, 2) if open_time_ms else 0
    open_time_minutes = round(open_time_ms / 60000, 1) if open_time_ms else 0
    revenue_estimate = round(open_time_hours * hourly_rate, 2) if hourly_rate else 0

    return {
        "dayTasks": {
            "total": day_tasks_total,
            "open": day_tasks_open,
            "done": day_tasks_done,
        },
        "timeTracking": {
            "totalTasks": total_time_tasks,
            "openTasks": open_time_tasks,
            "totalHours": total_time_hours,
            "openHours": open_time_hours,
            "openMinutes": open_time_minutes,
        },
        "telephony": {
            "minutes": telephony_minutes,
            "missed": telephony_missed,
        },
        "reports": {
            "total": reports_total,
            "sent": reports_sent,
            "opened": reports_opened,
            "unread": reports_unread,
            "confirmed": reports_confirmed,
        },
        "revenueEstimateEur": revenue_estimate,
        "hourlyRateEur": hourly_rate,
    }


@app.post("/api/reports/{report_id}/send")
def send_report(report_id: int, data: ReportSendRequest):
    with SessionLocal() as db:
        report = db.query(Report).get(report_id)
        if not report:
            raise HTTPException(404, "Report not found")
        settings = _get_smtp_settings(db)
        if not settings.host or not settings.sender_email:
            raise HTTPException(400, "SMTP settings missing")
        if not report.guid:
            report.guid = str(uuid.uuid4())
        subject = data.subject or f"IT-Kundenbericht – {report.customer} ({report.period or 'ohne Zeitraum'})"

        from_addr = settings.sender_email
        if settings.sender_name:
            from_addr = f"{settings.sender_name} <{settings.sender_email}>"

        import smtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = data.to
        msg.set_content(data.text or "Bitte verwenden Sie ein E-Mail-Programm mit HTML-Unterstuetzung.")
        msg.add_alternative(data.html, subtype="html")

        if settings.use_ssl:
            server = smtplib.SMTP_SSL(settings.host, settings.port or 465, timeout=20)
        else:
            server = smtplib.SMTP(settings.host, settings.port or 587, timeout=20)
        try:
            if settings.use_tls and not settings.use_ssl:
                server.starttls()
            if settings.username:
                server.login(settings.username, settings.password or "")
            server.send_message(msg)
        finally:
            server.quit()

        report.sent_at = int(time.time() * 1000)
        report.sent_via = "smtp"
        report.sent_to = data.to
        db.commit()
        db.refresh(report)
        return serialize_report(report)


@app.post("/api/offers/send")
def send_offer(data: OfferSendRequest):
    with SessionLocal() as db:
        settings = _get_smtp_settings(db)
        if not settings.host or not settings.sender_email:
            raise HTTPException(400, "SMTP settings missing")

        subject = data.subject or "Angebot"
        from_addr = settings.sender_email
        if settings.sender_name:
            from_addr = f"{settings.sender_name} <{settings.sender_email}>"

        tracking_guid = ""
        html = data.html or ""
        if settings.beacon_base_url:
            tracking_guid = str(uuid.uuid4())
            if "{guid}" in settings.beacon_base_url:
                pixel_url = settings.beacon_base_url.replace("{guid}", tracking_guid)
            else:
                separator = "&" if "?" in settings.beacon_base_url else "?"
                pixel_url = f"{settings.beacon_base_url}{separator}guid={tracking_guid}"
            html += f'<img src="{pixel_url}" alt="" width="1" height="1" style="display:none;" />'

        import smtplib
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = data.to
        msg.set_content(data.text or "Bitte verwenden Sie ein E-Mail-Programm mit HTML-Unterstuetzung.")
        msg.add_alternative(html, subtype="html")

        if settings.use_ssl:
            server = smtplib.SMTP_SSL(settings.host, settings.port or 465, timeout=20)
        else:
            server = smtplib.SMTP(settings.host, settings.port or 587, timeout=20)
        try:
            if settings.use_tls and not settings.use_ssl:
                server.starttls()
            if settings.username:
                server.login(settings.username, settings.password or "")
            server.send_message(msg)
        finally:
            server.quit()

        return {"status": "sent", "tracking_guid": tracking_guid}


@app.get("/offers/confirm/{guid}", response_class=HTMLResponse)
def offer_confirm_page(guid: str):
    with SessionLocal() as db:
        offer = db.query(Offer).filter(Offer.guid == guid).first()
    if not offer:
        return HTMLResponse(
            content="<h2>Angebot nicht gefunden</h2><p>Bitte prüfen Sie den Link.</p>",
            status_code=404,
        )
    title = offer.reference or "Angebot"
    customer = offer.customer or "Kunde"
    return HTMLResponse(
        content=f"""
        <!doctype html>
        <html lang="de">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Angebot bestätigen</title>
            <style>
              body {{ font-family: Arial, sans-serif; background:#f8f5ef; color:#1f2937; padding:24px; }}
              .card {{ max-width:620px; margin:0 auto; background:#fff; border-radius:18px; padding:24px; box-shadow:0 8px 24px rgba(15,23,42,0.08); }}
              label {{ display:block; font-size:12px; text-transform:uppercase; letter-spacing:0.2em; color:#6b7280; margin-top:14px; }}
              input, textarea {{ width:100%; padding:10px 12px; border-radius:12px; border:1px solid #e2e8f0; margin-top:6px; font-size:14px; }}
              button {{ margin-top:18px; background:#111827; color:#fff; border:none; padding:10px 16px; border-radius:999px; cursor:pointer; text-transform:uppercase; font-size:12px; letter-spacing:0.2em; }}
            </style>
          </head>
          <body>
            <div class="card">
              <p style="font-size:11px; text-transform:uppercase; letter-spacing:0.3em; color:#9ca3af;">Angebot</p>
              <h2 style="margin:6px 0 4px;">{title}</h2>
              <p style="color:#6b7280; margin:0 0 14px;">{customer}</p>
              <form method="post">
                <label for="name">Name</label>
                <input id="name" name="name" placeholder="Vor- und Nachname" />
                <label for="email">E-Mail</label>
                <input id="email" name="email" type="email" placeholder="name@firma.at" />
                <label for="note">Anmerkungen</label>
                <textarea id="note" name="note" rows="5" placeholder="Optionale Hinweise oder Wünsche"></textarea>
                <button type="submit">Angebot bestätigen</button>
              </form>
            </div>
          </body>
        </html>
        """,
        status_code=200,
    )


@app.post("/offers/confirm/{guid}", response_class=HTMLResponse)
def offer_confirm_submit(
    guid: str,
    name: str = Form(default=""),
    email: str = Form(default=""),
    note: str = Form(default=""),
):
    with SessionLocal() as db:
        offer = db.query(Offer).filter(Offer.guid == guid).first()
        if not offer:
            return HTMLResponse(
                content="<h2>Angebot nicht gefunden</h2><p>Bitte prüfen Sie den Link.</p>",
                status_code=404,
            )
        offer.status = "angenommen"
        offer.confirmed_at = int(time.time() * 1000)
        offer.customer_name = name or offer.customer_name
        offer.customer_email = email or offer.customer_email
        offer.customer_note = note or offer.customer_note
        offer.updated_at = int(time.time() * 1000)
        db.commit()
    return HTMLResponse(
        content="""
        <h2>Vielen Dank!</h2>
        <p>Ihre Angebotsbestätigung ist eingegangen.</p>
        """,
        status_code=200,
    )


@app.patch("/api/reports/{report_id}")
def update_report(report_id: int, data: ReportUpdate):
    with SessionLocal() as db:
        report = db.query(Report).get(report_id)
        if not report:
            raise HTTPException(404, "Report not found")
        if data.sent is not None:
            report.sent_at = int(time.time() * 1000) if data.sent else 0
            if not data.sent:
                report.sent_via = ""
                report.sent_to = ""
        if data.sent_via is not None:
            report.sent_via = data.sent_via
        if data.sent_to is not None:
            report.sent_to = data.sent_to
        db.commit()
        db.refresh(report)
        return serialize_report(report)


@app.put("/api/reports/{report_id}")
def edit_report(report_id: int, data: ReportEdit):
    with SessionLocal() as db:
        report = db.query(Report).get(report_id)
        if not report:
            raise HTTPException(404, "Report not found")
        payload = data.dict(exclude_unset=True, exclude={"items", "customer_id"})
        for field, value in payload.items():
            setattr(report, field, value if value is not None else "")
        if data.customer_id is not None:
            report.customer_id = data.customer_id
        elif data.customer:
            customer = (
                db.query(Customer)
                .filter(func.lower(Customer.name) == data.customer.strip().lower())
                .first()
            )
            if customer:
                report.customer_id = customer.id
        if data.items is not None:
            report.items.clear()
            for item in data.items:
                report_item = ReportItem(
                    report_id=report.id,
                    priority=item.priority or "Planbar",
                    title=item.title or "",
                    system=item.system or "",
                    why_text=item.why_text or "",
                    impact=item.impact or "",
                    duration=item.duration or "",
                    cost=item.cost or "",
                )
                report.items.append(report_item)
        db.commit()
        db.refresh(report)
        return serialize_report(report)


# ================= DEBUG ====================
@app.get("/api/debug/tables")
def list_debug_tables():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    return {"tables": sorted(tables)}


@app.post("/api/debug/clear_table")
def clear_debug_table(data: DebugClearRequest):
    allowed_tables = {"day_tasks", "day_task_groups"}
    table = (data.table or "").strip()
    if not table or table not in allowed_tables:
        raise HTTPException(400, "Table not allowed")
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        raise HTTPException(404, "Table not found")
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.execute(
                text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE')
            )
        else:
            connection.execute(text(f'DELETE FROM "{table}"'))
    return {"status": "cleared", "table": table}
