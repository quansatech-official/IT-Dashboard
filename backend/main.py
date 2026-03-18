from fastapi import FastAPI, HTTPException, Response, Request, Form, Header
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Tuple, Set, Callable
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from sqlalchemy import (
    create_engine, Column, Integer, String, Text,
    Boolean, BigInteger, ForeignKey, Float, inspect, text, func, or_
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session
import os
import math
import time
import uuid
import threading
import json
import json as jsonlib
import re
import difflib
import unicodedata
import hashlib
import hmac
import base64
import gzip
import imaplib
import ssl
from html import escape
from html import unescape
from email import policy
from email.parser import Parser
from email.utils import formataddr, formatdate, make_msgid, parseaddr, parsedate_to_datetime
import requests
from urllib.parse import quote, urlparse
from datetime import datetime, timedelta, timezone
import logging
import xml.etree.ElementTree as ET

from sevdesk_service import SevdeskClient, SevdeskConfig, SevdeskError
# ================= DATABASE =================
DATABASE_URL = os.environ.get("DATABASE_URL") or (
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL") or "http://ollama:11434"
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or "qwen3:8b"
OLLAMA_TIMEOUT_SECONDS = int(os.environ.get("OLLAMA_TIMEOUT_SECONDS") or "180")
OLLAMA_CONNECT_TIMEOUT_SECONDS = max(1, int(os.environ.get("OLLAMA_CONNECT_TIMEOUT_SECONDS") or "6"))
OLLAMA_REQUEST_KEEP_ALIVE = (
    str(
        os.environ.get("OLLAMA_REQUEST_KEEP_ALIVE")
        or os.environ.get("OLLAMA_KEEP_ALIVE")
        or "30m"
    )
    .strip()
)
OLLAMA_STREAM_ENABLED = str(os.environ.get("OLLAMA_STREAM_ENABLED") or "").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
OLLAMA_NUM_CTX = max(256, int(os.environ.get("OLLAMA_NUM_CTX") or "2048"))
OLLAMA_NUM_THREAD = max(
    1,
    int(
        os.environ.get("OLLAMA_NUM_THREAD")
        or min(8, max(1, int(os.cpu_count() or 1)))
    ),
)
OLLAMA_PROMPT_MAX_CHARS = max(
    2000,
    int(os.environ.get("OLLAMA_PROMPT_MAX_CHARS") or "12000"),
)
OLLAMA_MAX_TOKENS_HARD_LIMIT = max(
    64,
    int(os.environ.get("OLLAMA_MAX_TOKENS_HARD_LIMIT") or "320"),
)
INTERNAL_AI_MAX_TOKENS = max(
    128,
    int(os.environ.get("INTERNAL_AI_MAX_TOKENS") or "1200"),
)
INTERNAL_AI_TOOL_MAX_TOKENS = max(
    128,
    min(
        int(os.environ.get("INTERNAL_AI_TOOL_MAX_TOKENS") or "480"),
        int(INTERNAL_AI_MAX_TOKENS),
    ),
)
INTERNAL_AI_TOOL_TIMEOUT_SECONDS = max(
    6,
    int(os.environ.get("INTERNAL_AI_TOOL_TIMEOUT_SECONDS") or "18"),
)
OLLAMA_SLOW_REQUEST_MS = max(
    500,
    int(os.environ.get("OLLAMA_SLOW_REQUEST_MS") or "25000"),
)
OLLAMA_RESPONSE_CACHE_TTL_SECONDS = max(
    0,
    int(os.environ.get("OLLAMA_RESPONSE_CACHE_TTL_SECONDS") or "180"),
)
OLLAMA_RESPONSE_CACHE_MAX_ENTRIES = max(
    32,
    int(os.environ.get("OLLAMA_RESPONSE_CACHE_MAX_ENTRIES") or "400"),
)
OLLAMA_MISSING_MODEL_TTL_SECONDS = max(
    0,
    int(os.environ.get("OLLAMA_MISSING_MODEL_TTL_SECONDS") or "600"),
)
OLLAMA_PROMPT_TOKEN_MARGIN = max(
    64,
    int(os.environ.get("OLLAMA_PROMPT_TOKEN_MARGIN") or "96"),
)
CUSTOMER_DEVELOPMENT_AI_TIMEOUT_SECONDS = max(
    5,
    int(os.environ.get("CUSTOMER_DEVELOPMENT_AI_TIMEOUT_SECONDS") or "35"),
)
CUSTOMER_DEVELOPMENT_AI_INTERNAL_TIMEOUT_SECONDS = max(
    3,
    int(os.environ.get("CUSTOMER_DEVELOPMENT_AI_INTERNAL_TIMEOUT_SECONDS") or "20"),
)
TASK_SCOPE_AI_TIMEOUT_SECONDS = max(
    5,
    int(os.environ.get("TASK_SCOPE_AI_TIMEOUT_SECONDS") or "12"),
)
INTERNAL_AI_STREAM_TIMEOUT_SECONDS = max(
    30,
    int(os.environ.get("INTERNAL_AI_STREAM_TIMEOUT_SECONDS") or "300"),
)
DB_STARTUP_RETRY_ATTEMPTS = max(
    1,
    int(os.environ.get("DB_STARTUP_RETRY_ATTEMPTS") or "30"),
)
DB_STARTUP_RETRY_DELAY_SECONDS = max(
    0.5,
    float(os.environ.get("DB_STARTUP_RETRY_DELAY_SECONDS") or "2"),
)
CUSTOMER_META_HUB_URL = str(os.environ.get("CUSTOMER_META_HUB_URL") or "").strip().rstrip("/")
CUSTOMER_META_HUB_ENABLED = str(os.environ.get("CUSTOMER_META_HUB_ENABLED") or "").strip().lower() not in {
    "",
    "0",
    "false",
    "no",
    "off",
}
CUSTOMER_META_HUB_TIMEOUT_SECONDS = max(2, int(os.environ.get("CUSTOMER_META_HUB_TIMEOUT_SECONDS") or "8"))
META_HUB_MAILBOX_TEST_TIMEOUT_SECONDS = max(
    3,
    int(os.environ.get("META_HUB_MAILBOX_TEST_TIMEOUT_SECONDS") or "15"),
)
CUSTOMER_META_HUB_BYPASS_HEADER = "x-meta-hub-bypass"
META_HUB_INTERNAL_TOKEN = str(os.environ.get("META_HUB_INTERNAL_TOKEN") or "").strip()
META_HUB_INTERNAL_TOKEN_HEADER = "x-meta-hub-token"
_geo_cache: Dict[str, Optional[tuple[float, float]]] = {}
GEO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
ROUTE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
SEVDESK_CONTACT_CACHE_TTL_MS = 24 * 60 * 60 * 1000
_sevdesk_contact_cache: Dict[str, Tuple[int, str]] = {}
CUSTOMER_DEVELOPMENT_CACHE_TTL_MS = 5 * 60 * 1000
CUSTOMER_CVE_CACHE_TTL_MS = 30 * 60 * 1000
CUSTOMER_CVE_EMPTY_CACHE_TTL_MS = 3 * 60 * 1000
RECENT_WORK_SUMMARY_CACHE_TTL_MS = 15 * 60 * 1000
NVD_LOOKUP_CACHE_TTL_MS = 12 * 60 * 60 * 1000
OSV_LOOKUP_CACHE_TTL_MS = 12 * 60 * 60 * 1000
TRACKING_STATUS_CACHE_TTL_MS = max(
    60 * 1000,
    int(os.environ.get("TRACKING_STATUS_CACHE_TTL_MS") or str(15 * 60 * 1000)),
)
CVE_LOOKUP_BUDGET_SECONDS = max(5, int(os.environ.get("CVE_LOOKUP_BUDGET_SECONDS") or "45"))
CVE_LOOKUP_MAX_UNIQUE = max(20, int(os.environ.get("CVE_LOOKUP_MAX_UNIQUE") or "120"))
CVE_LOOKUP_MAX_WORKERS = max(2, min(16, int(os.environ.get("CVE_LOOKUP_MAX_WORKERS") or "8")))
_customer_development_cache: Dict[str, Dict[str, Any]] = {}
_customer_cve_cache: Dict[int, Dict[str, Any]] = {}
_recent_work_summary_cache: Dict[str, Dict[str, Any]] = {}
TACTICAL_SITE_CACHE_TTL_MS = 5 * 60 * 1000
TACTICAL_SOFTWARE_ENDPOINT_CACHE_TTL_MS = 60 * 60 * 1000
_tactical_site_lookup_cache: Dict[str, Dict[str, Any]] = {}
_tactical_software_endpoint_cache: Dict[str, Dict[str, Any]] = {}
_nvd_lookup_cache: Dict[str, Dict[str, Any]] = {}
_osv_lookup_cache: Dict[str, Dict[str, Any]] = {}
_tracking_status_cache: Dict[str, Dict[str, Any]] = {}
_nvd_lookup_lock = threading.Lock()
_osv_lookup_lock = threading.Lock()
_tactical_software_endpoint_lock = threading.Lock()
_tracking_status_cache_lock = threading.Lock()

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
logger = logging.getLogger("it_dashboard")
_ollama_http = requests.Session()
_ollama_http.mount(
    "http://",
    requests.adapters.HTTPAdapter(pool_connections=16, pool_maxsize=32, max_retries=0),
)
_ollama_http.mount(
    "https://",
    requests.adapters.HTTPAdapter(pool_connections=16, pool_maxsize=32, max_retries=0),
)
_ollama_response_cache: Dict[str, Dict[str, Any]] = {}
_ollama_response_cache_lock = threading.Lock()
_ollama_missing_model_until_ms: Dict[str, int] = {}
_ollama_missing_model_lock = threading.Lock()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        if isinstance(value, bool):
            return int(value)
        text_value = str(value).strip()
        if not text_value:
            return default
        return int(float(text_value))
    except (TypeError, ValueError):
        return default


MODEL_PREF_CUSTOMER_RANKING = os.environ.get("OLLAMA_MODEL_PREF_CUSTOMER_RANKING") or OLLAMA_MODEL
MODEL_PREF_CUSTOMER_DEVELOPMENT = os.environ.get("OLLAMA_MODEL_PREF_CUSTOMER_DEVELOPMENT") or OLLAMA_MODEL
MODEL_PREF_TASK_DRAFT = os.environ.get("OLLAMA_MODEL_PREF_TASK_DRAFT") or OLLAMA_MODEL
MODEL_PREF_ACTION = os.environ.get("OLLAMA_MODEL_PREF_ACTION") or OLLAMA_MODEL
MODEL_PREF_OFFER_TEXT = os.environ.get("OLLAMA_MODEL_PREF_OFFER_TEXT") or OLLAMA_MODEL
MODEL_PREF_INVOICE_SUMMARY = os.environ.get("OLLAMA_MODEL_PREF_INVOICE_SUMMARY") or OLLAMA_MODEL
MODEL_PREF_INTERNAL_AI = os.environ.get("OLLAMA_MODEL_PREF_INTERNAL_AI") or MODEL_PREF_ACTION or OLLAMA_MODEL
AI_PROVIDER_OLLAMA = "ollama"
AI_PROVIDER_OPENAI_COMPATIBLE = "openai_compatible"
AI_PROVIDER_ENV = os.environ.get("AI_PROVIDER") or ""
AI_BASE_URL_ENV = os.environ.get("AI_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or ""
AI_API_KEY_ENV = os.environ.get("AI_API_KEY") or os.environ.get("OPENAI_API_KEY") or ""
AI_DEFAULT_MODEL_ENV = os.environ.get("AI_MODEL") or os.environ.get("OPENAI_MODEL") or OLLAMA_MODEL
AI_MODEL_SETTINGS_FIELDS = {
    "internal_ai": "ai_internal_model",
    "action": "ai_action_model",
    "task_draft": "ai_task_model",
    "customer_ranking": "ai_customer_ranking_model",
    "customer_development": "ai_customer_development_model",
    "offer_text": "ai_offer_model",
    "invoice_summary": "ai_invoice_model",
}
AI_MODEL_ENV_DEFAULTS = {
    "internal_ai": MODEL_PREF_INTERNAL_AI,
    "action": MODEL_PREF_ACTION,
    "task_draft": MODEL_PREF_TASK_DRAFT,
    "customer_ranking": MODEL_PREF_CUSTOMER_RANKING,
    "customer_development": MODEL_PREF_CUSTOMER_DEVELOPMENT,
    "offer_text": MODEL_PREF_OFFER_TEXT,
    "invoice_summary": MODEL_PREF_INVOICE_SUMMARY,
}
FREE_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "yahoo.com",
    "gmx.at",
    "gmx.de",
    "web.de",
    "aol.com",
    "proton.me",
    "protonmail.com",
}
NAME_STOPWORDS = {
    "gmbh",
    "mbh",
    "ag",
    "kg",
    "co",
    "company",
    "inc",
    "ltd",
    "the",
    "und",
    "u",
    "ue",
    "eu",
    "og",
    "gesmbh",
}
COMPANY_SUFFIX_PATTERN = (
    r"(gmbh(?:\s*&\s*co\.\s*kg)?|ag|kg|og|eg|gbr|e\.?k\.?|inc\.?|ltd\.?|llc|s\.?r\.?o\.?|s\.?a\.?)"
)

# ================= MODELS ===================
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    creditor_number = Column(String, default="")
    short_code = Column(String, default="")
    email = Column(String, default="")
    newsletter_email = Column(String, default="")
    billing_email = Column(String, default="")
    time_tracking_enabled = Column(Boolean, default=False)
    customer_report = Column(Boolean, default=True)
    newsletter = Column(Boolean, default=True)
    status = Column(String, default="active")
    maintenance_contract = Column(Boolean, default=False)
    contract_flags = Column(Text, default="[]")
    street = Column(String, default="")
    postal_code = Column(String, default="")
    city = Column(String, default="")
    country = Column(String, default="")
    billing_street = Column(String, default="")
    billing_postal_code = Column(String, default="")
    billing_city = Column(String, default="")
    billing_country = Column(String, default="")

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
    wartungsvertrag = Column(Boolean, default=False)
    randzeit = Column(Boolean, default=False)
    details = Column(String, default="")
    arrival_time = Column(String, default="")
    departure_time = Column(String, default="")
    deadline = Column(String, default="")
    urgency_flag = Column(String, default="")
    billing_note = Column(String, default="")
    billing_min_hours = Column(Float, default=0.0)
    employee_id = Column(Integer, nullable=True)
    elapsed = Column(BigInteger, default=0)      # ms
    running = Column(Boolean, default=False)
    startTime = Column("starttime", BigInteger, default=0)    # ms timestamp
    completed_at = Column(BigInteger, default=0)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    short_code = Column(String, default="")
    color = Column(String, default="#111827")
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


class NewsletterGroup(Base):
    __tablename__ = "newsletter_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

    members = relationship(
        "NewsletterGroupMember",
        back_populates="group",
        cascade="all, delete-orphan",
    )


class NewsletterGroupMember(Base):
    __tablename__ = "newsletter_group_members"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("newsletter_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

    group = relationship("NewsletterGroup", back_populates="members")
    customer = relationship("Customer")


class Newsletter(Base):
    __tablename__ = "newsletters"

    id = Column(Integer, primary_key=True)
    guid = Column(String, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="")
    subject = Column(String, nullable=False)
    preheader = Column(String, default="")
    intro_html = Column(Text, default="")
    body_html = Column(Text, default="")
    cta_label = Column(String, default="")
    cta_url = Column(String, default="")
    closing_html = Column(Text, default="")
    audience_json = Column(Text, default="{}")
    recipient_emails_json = Column(Text, default="[]")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    sent_at = Column(BigInteger, default=0)
    sent_via = Column(String, default="")
    sent_to = Column(Text, default="[]")
    recipient_count = Column(Integer, default=0)


class NewsletterRssFeed(Base):
    __tablename__ = "newsletter_rss_feeds"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    url = Column(Text, nullable=False)
    description = Column(Text, default="")
    enabled = Column(Boolean, default=True)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class DeliveryNote(Base):
    __tablename__ = "delivery_notes"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    note = Column(String, default="")
    signature_base64 = Column(String, default="")
    time_from = Column(String, default="")
    time_to = Column(String, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

    customer = relationship("Customer")


class CustomerInventoryEvent(Base):
    __tablename__ = "customer_inventory_events"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    device_label = Column(String, default="")
    event_type = Column(String, default="wartung")
    event_date = Column(String, default="")
    cancellation_date = Column(String, default="")
    provider = Column(String, default="")
    billing_cycle = Column(String, default="monthly")
    reminder_days = Column(Integer, default=60)
    is_external = Column(Boolean, default=False)
    is_recurring = Column(Boolean, default=False)
    cost_category = Column(String, default="other")
    monthly_cost_eur = Column(Float, default=0.0)
    tags_json = Column(Text, default="[]")
    note = Column(Text, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

    customer = relationship("Customer")


class CustomerInventoryDeviceState(Base):
    __tablename__ = "customer_inventory_device_states"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String, default="")
    device_key = Column(String, default="")
    device_label = Column(String, default="")
    retired = Column(Boolean, default=False)
    note = Column(Text, default="")
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

    customer = relationship("Customer")


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
    third_party_payload = Column(String, default="")
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
    action_type = Column(String, default="standard")
    custom_html = Column(Text, default="")
    custom_text = Column(Text, default="")
    custom_data = Column(Text, default="")

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
    opened_at = Column(BigInteger, default=0)
    opened_count = Column(Integer, default=0)
    sent_at = Column(BigInteger, default=0)
    sent_via = Column(String, default="")
    sent_to = Column(String, default="")
    customer_name = Column(String, default="")
    customer_email = Column(String, default="")
    customer_note = Column(String, default="")

class IntegrationSettings(Base):
    __tablename__ = "integration_settings"

    id = Column(Integer, primary_key=True)
    rmm_host = Column(String, default="")
    rmm_user = Column(String, default="")
    rmm_password = Column(String, default="")
    rmm_api_key = Column(String, default="")
    rmm_api_key_header = Column(String, default="X-API-KEY")
    pbx_base_url = Column(String, default="")
    pbx_username = Column(String, default="")
    pbx_password = Column(String, default="")
    pbx_refresh_token = Column(String, default="")
    pbx_api_key_id = Column(String, default="")
    pbx_api_key_secret = Column(String, default="")
    pbx_customer_account = Column(String, default="")
    marketplace_import_url = Column(String, default="")
    td_synnex_base_url = Column(String, default="")
    td_synnex_token_url = Column(String, default="")
    td_synnex_client_id = Column(String, default="")
    td_synnex_client_secret = Column(String, default="")
    td_synnex_account_id = Column(String, default="")
    also_sftp_host = Column(String, default="")
    also_sftp_port = Column(String, default="")
    also_sftp_user = Column(String, default="")
    also_sftp_password = Column(String, default="")
    also_sftp_dir = Column(String, default="")
    also_sftp_filename = Column(String, default="")
    sevdesk_base_url = Column(String, default="")
    sevdesk_api_token = Column(String, default="")
    sevdesk_contact_person_id = Column(String, default="")
    sevdesk_address_country_id = Column(String, default="")
    sevdesk_tax_type = Column(String, default="default")
    sevdesk_tax_rule_id = Column(String, default="1")
    sevdesk_tax_text = Column(String, default="zzgl. Umsatzsteuer")
    sevdesk_currency = Column(String, default="EUR")
    sevdesk_invoice_type = Column(String, default="RE")
    sevdesk_default_tax_rate = Column(String, default="19")
    sevdesk_unity_id = Column(String, default="")
    sevdesk_service_unity_id = Column(String, default="")
    sevdesk_device_unity_id = Column(String, default="")
    sevdesk_hourly_rate_eur = Column(String, default="")
    icecat_api_token = Column(String, default="")
    icecat_enabled = Column(Boolean, default=False)
    meta_hub_rmm_enabled = Column(Boolean, default=True)
    meta_hub_rmm_customer_field_name = Column(String, default="Kundennummer")
    meta_hub_email_enabled = Column(Boolean, default=False)
    meta_hub_refresh_seconds = Column(Integer, default=300)
    meta_hub_mailboxes_json = Column(Text, default="[]")
    ai_provider = Column(String, default="ollama")
    ai_base_url = Column(String, default="")
    ai_api_key = Column(String, default="")
    ai_default_model = Column(String, default="")
    ai_internal_model = Column(String, default="")
    ai_action_model = Column(String, default="")
    ai_task_model = Column(String, default="")
    ai_customer_ranking_model = Column(String, default="")
    ai_customer_development_model = Column(String, default="")
    ai_offer_model = Column(String, default="")
    ai_invoice_model = Column(String, default="")


class InfraDiscoveryDevice(Base):
    __tablename__ = "infra_discovery_devices"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    customer_number = Column(String, default="")
    customer_name = Column(String, default="")
    source = Column(String, default="agent")
    hostname = Column(String, default="")
    ip = Column(String, default="")
    mac = Column(String, default="")
    protocol = Column(String, default="")
    device_type = Column(String, default="")
    vendor = Column(String, default="")
    confidence = Column(Integer, default=0)
    evidence = Column(Text, default="[]")
    managed = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    last_seen_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


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
    signature_html = Column(String, default="")


class OfferSettings(Base):
    __tablename__ = "offer_settings"

    id = Column(Integer, primary_key=True)
    offer_number_format = Column(String, default="AN-XXXX")

class OfferBlockStore(Base):
    __tablename__ = "offer_block_store"

    id = Column(Integer, primary_key=True)
    data_json = Column(String, default="{}")
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

class AiPromptSettings(Base):
    __tablename__ = "ai_prompt_settings"

    id = Column(Integer, primary_key=True)
    data_json = Column(String, default="{}")
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

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


class PurchasingItem(Base):
    __tablename__ = "purchasing_items"

    id = Column(Integer, primary_key=True)
    done = Column(Boolean, default=False)
    status = Column(String, default="open")
    customer = Column(String, default="")
    title = Column(String, default="")
    source_url = Column(String, default="")
    quantity = Column(String, default="")
    remark = Column(String, default="")
    tracking_number = Column(String, default="")
    purchase_price = Column(String, default="")
    sale_price = Column(String, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id = Column(Integer, primary_key=True)
    title = Column(String, default="")
    category = Column(String, default="")
    tags_json = Column(Text, default="[]")
    content = Column(Text, default="")
    pinned = Column(Boolean, default=False)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class ContractTariff(Base):
    __tablename__ = "contract_tariffs"

    id = Column(Integer, primary_key=True)
    family_key = Column(String, default=lambda: str(uuid.uuid4()))
    name = Column(String, default="")
    category = Column(String, default="wartung")
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    currency = Column(String, default="EUR")
    base_price_monthly = Column(Float, default=0.0)
    price_server_monthly = Column(Float, default=0.0)
    price_client_monthly = Column(Float, default=0.0)
    price_network_monthly = Column(Float, default=0.0)
    price_iot_monthly = Column(Float, default=0.0)
    hourly_price = Column(Float, default=0.0)
    notes = Column(Text, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class CustomerContractCalculation(Base):
    __tablename__ = "customer_contract_calculations"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    tariff_id = Column(Integer, ForeignKey("contract_tariffs.id"), nullable=True)
    tariff_name = Column(String, default="")
    tariff_category = Column(String, default="")
    tariff_version = Column(Integer, default=1)
    servers = Column(Integer, default=0)
    clients = Column(Integer, default=0)
    network_devices = Column(Integer, default=0)
    iot_devices = Column(Integer, default=0)
    monthly_total = Column(Float, default=0.0)
    yearly_total = Column(Float, default=0.0)
    note = Column(Text, default="")
    snapshot_json = Column(Text, default="{}")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class CustomerContractDocument(Base):
    __tablename__ = "customer_contract_documents"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    title = Column(String, default="")
    doc_type = Column(String, default="wartung")
    status = Column(String, default="active")
    file_name = Column(String, default="")
    mime_type = Column(String, default="application/pdf")
    content_base64 = Column(Text, default="")
    html_content = Column(Text, default="")
    template_key = Column(String, default="")
    monthly_hours_included = Column(Float, default=0.0)
    valid_from = Column(String, default="")
    runtime_months = Column(Integer, default=12)
    termination_notice_months = Column(Integer, default=3)
    auto_extension_months = Column(Integer, default=12)
    note = Column(Text, default="")
    snapshot_json = Column(Text, default="{}")
    cancel_reason = Column(Text, default="")
    cancelled_at = Column(BigInteger, default=0)
    cancelled_effective_at = Column(BigInteger, default=0)
    stop_service_immediately = Column(Boolean, default=False)
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class CustomerPrepaidHoursEntry(Base):
    __tablename__ = "customer_prepaid_hours_entries"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    entry_type = Column(String, default="purchase")
    hours = Column(Float, default=0.0)
    label = Column(String, default="")
    note = Column(Text, default="")
    task_id = Column(Integer, ForeignKey("day_tasks.id"), nullable=True)
    task_title_snapshot = Column(String, default="")
    task_elapsed_hours_snapshot = Column(Float, default=0.0)
    effective_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


class CustomerLicense(Base):
    __tablename__ = "customer_licenses"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False, index=True)
    vendor = Column(String, default="")
    product_name = Column(String, default="")
    quantity = Column(Integer, default=1)
    billing_cycle = Column(String, default="monthly")
    cost_eur = Column(Float, default=0.0)
    valid_until = Column(String, default="")
    status = Column(String, default="active")
    notes = Column(Text, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))
    updated_at = Column(BigInteger, default=lambda: int(time.time() * 1000))


def _run_db_startup_step(step_name: str, callback: Callable[[], None]) -> None:
    attempts = max(1, int(DB_STARTUP_RETRY_ATTEMPTS or 1))
    delay_seconds = max(0.5, float(DB_STARTUP_RETRY_DELAY_SECONDS or 0.5))
    for attempt in range(1, attempts + 1):
        try:
            callback()
            if attempt > 1:
                logger.info(
                    "DB startup step '%s' succeeded on attempt %s/%s",
                    step_name,
                    attempt,
                    attempts,
                )
            return
        except SQLAlchemyError as exc:
            if attempt >= attempts:
                logger.exception(
                    "DB startup step '%s' failed after %s attempts",
                    step_name,
                    attempts,
                )
                raise
            logger.warning(
                "DB startup step '%s' failed (%s/%s): %s. Retrying in %.1fs",
                step_name,
                attempt,
                attempts,
                exc,
                delay_seconds,
            )
            time.sleep(delay_seconds)


_run_db_startup_step("create_all", lambda: Base.metadata.create_all(bind=engine))

def _ensure_purchasing_items_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("purchasing_items"):
        return
    columns = {column["name"] for column in inspector.get_columns("purchasing_items")}
    statements = []
    if "quantity" not in columns:
        statements.append("ALTER TABLE purchasing_items ADD COLUMN quantity VARCHAR DEFAULT ''")
    if "remark" not in columns:
        statements.append("ALTER TABLE purchasing_items ADD COLUMN remark VARCHAR DEFAULT ''")
    if "tracking_number" not in columns:
        statements.append("ALTER TABLE purchasing_items ADD COLUMN tracking_number VARCHAR DEFAULT ''")
    if "status" not in columns:
        statements.append("ALTER TABLE purchasing_items ADD COLUMN status VARCHAR DEFAULT 'open'")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_purchasing_items_columns", _ensure_purchasing_items_columns)

def _ensure_integration_settings_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("integration_settings"):
        return
    columns = {column["name"] for column in inspector.get_columns("integration_settings")}
    statements = []
    if "pbx_base_url" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN pbx_base_url VARCHAR DEFAULT ''")
    if "rmm_api_key" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN rmm_api_key VARCHAR DEFAULT ''")
    if "rmm_api_key_header" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN rmm_api_key_header VARCHAR DEFAULT 'X-API-KEY'")
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
    if "marketplace_import_url" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN marketplace_import_url VARCHAR DEFAULT ''")
    if "td_synnex_base_url" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN td_synnex_base_url VARCHAR DEFAULT ''")
    if "td_synnex_token_url" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN td_synnex_token_url VARCHAR DEFAULT ''")
    if "td_synnex_client_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN td_synnex_client_id VARCHAR DEFAULT ''")
    if "td_synnex_client_secret" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN td_synnex_client_secret VARCHAR DEFAULT ''")
    if "td_synnex_account_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN td_synnex_account_id VARCHAR DEFAULT ''")
    if "also_sftp_host" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN also_sftp_host VARCHAR DEFAULT ''")
    if "also_sftp_port" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN also_sftp_port VARCHAR DEFAULT ''")
    if "also_sftp_user" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN also_sftp_user VARCHAR DEFAULT ''")
    if "also_sftp_password" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN also_sftp_password VARCHAR DEFAULT ''")
    if "also_sftp_dir" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN also_sftp_dir VARCHAR DEFAULT ''")
    if "also_sftp_filename" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN also_sftp_filename VARCHAR DEFAULT ''")
    if "sevdesk_base_url" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_base_url VARCHAR DEFAULT ''")
    if "sevdesk_api_token" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_api_token VARCHAR DEFAULT ''")
    if "sevdesk_contact_person_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_contact_person_id VARCHAR DEFAULT ''")
    if "sevdesk_address_country_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_address_country_id VARCHAR DEFAULT ''")
    if "sevdesk_tax_type" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_tax_type VARCHAR DEFAULT 'default'")
    if "sevdesk_tax_rule_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_tax_rule_id VARCHAR DEFAULT '1'")
    if "sevdesk_tax_text" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_tax_text VARCHAR DEFAULT 'zzgl. Umsatzsteuer'")
    if "sevdesk_currency" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_currency VARCHAR DEFAULT 'EUR'")
    if "sevdesk_invoice_type" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_invoice_type VARCHAR DEFAULT 'RE'")
    if "sevdesk_default_tax_rate" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_default_tax_rate VARCHAR DEFAULT '19'")
    if "sevdesk_unity_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_unity_id VARCHAR DEFAULT ''")
    if "sevdesk_service_unity_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_service_unity_id VARCHAR DEFAULT ''")
    if "sevdesk_device_unity_id" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_device_unity_id VARCHAR DEFAULT ''")
    if "sevdesk_hourly_rate_eur" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN sevdesk_hourly_rate_eur VARCHAR DEFAULT ''")
    if "icecat_api_token" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN icecat_api_token VARCHAR DEFAULT ''")
    if "icecat_enabled" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN icecat_enabled BOOLEAN DEFAULT FALSE")
    if "meta_hub_rmm_enabled" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN meta_hub_rmm_enabled BOOLEAN DEFAULT TRUE")
    if "meta_hub_rmm_customer_field_name" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN meta_hub_rmm_customer_field_name VARCHAR DEFAULT 'Kundennummer'")
    if "meta_hub_email_enabled" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN meta_hub_email_enabled BOOLEAN DEFAULT FALSE")
    if "meta_hub_refresh_seconds" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN meta_hub_refresh_seconds INTEGER DEFAULT 300")
    if "meta_hub_mailboxes_json" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN meta_hub_mailboxes_json TEXT DEFAULT '[]'")
    if "ai_provider" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_provider VARCHAR DEFAULT 'ollama'")
    if "ai_base_url" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_base_url VARCHAR DEFAULT ''")
    if "ai_api_key" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_api_key VARCHAR DEFAULT ''")
    if "ai_default_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_default_model VARCHAR DEFAULT ''")
    if "ai_internal_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_internal_model VARCHAR DEFAULT ''")
    if "ai_action_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_action_model VARCHAR DEFAULT ''")
    if "ai_task_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_task_model VARCHAR DEFAULT ''")
    if "ai_customer_ranking_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_customer_ranking_model VARCHAR DEFAULT ''")
    if "ai_customer_development_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_customer_development_model VARCHAR DEFAULT ''")
    if "ai_offer_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_offer_model VARCHAR DEFAULT ''")
    if "ai_invoice_model" not in columns:
        statements.append("ALTER TABLE integration_settings ADD COLUMN ai_invoice_model VARCHAR DEFAULT ''")
    if statements:
        with engine.begin() as connection:
            for statement in statements:
                connection.execute(text(statement))

_run_db_startup_step("ensure_integration_settings_columns", _ensure_integration_settings_columns)

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

_run_db_startup_step("ensure_pbx_phonebook_columns", _ensure_pbx_phonebook_columns)


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


_run_db_startup_step("ensure_customer_metrics_settings_columns", _ensure_customer_metrics_settings_columns)


def _ensure_report_sent_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("reports"):
        return
    columns = {column["name"] for column in inspector.get_columns("reports")}
    if "sent_at" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE reports ADD COLUMN sent_at BIGINT DEFAULT 0"))


_run_db_startup_step("ensure_report_sent_column", _ensure_report_sent_column)


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


_run_db_startup_step("ensure_report_opened_columns", _ensure_report_opened_columns)


def _ensure_offer_opened_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("offers"):
        return
    columns = {column["name"] for column in inspector.get_columns("offers")}
    statements = []
    if "guid" not in columns:
        statements.append("ALTER TABLE offers ADD COLUMN guid VARCHAR")
    if "opened_at" not in columns:
        statements.append("ALTER TABLE offers ADD COLUMN opened_at BIGINT DEFAULT 0")
    if "opened_count" not in columns:
        statements.append("ALTER TABLE offers ADD COLUMN opened_count INTEGER DEFAULT 0")
    if "sent_at" not in columns:
        statements.append("ALTER TABLE offers ADD COLUMN sent_at BIGINT DEFAULT 0")
    if "sent_via" not in columns:
        statements.append("ALTER TABLE offers ADD COLUMN sent_via VARCHAR DEFAULT ''")
    if "sent_to" not in columns:
        statements.append("ALTER TABLE offers ADD COLUMN sent_to VARCHAR DEFAULT ''")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_offer_opened_columns", _ensure_offer_opened_columns)


def _ensure_report_catalog_group_column() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("report_catalog"):
        return
    columns = {column["name"] for column in inspector.get_columns("report_catalog")}
    if "group" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE report_catalog ADD COLUMN \"group\" VARCHAR"))


_run_db_startup_step("ensure_report_catalog_group_column", _ensure_report_catalog_group_column)


def _ensure_report_item_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("report_items"):
        return
    columns = {column["name"] for column in inspector.get_columns("report_items")}
    statements = []
    if "action_type" not in columns:
        statements.append("ALTER TABLE report_items ADD COLUMN action_type VARCHAR DEFAULT 'standard'")
    if "custom_html" not in columns:
        statements.append("ALTER TABLE report_items ADD COLUMN custom_html TEXT DEFAULT ''")
    if "custom_text" not in columns:
        statements.append("ALTER TABLE report_items ADD COLUMN custom_text TEXT DEFAULT ''")
    if "custom_data" not in columns:
        statements.append("ALTER TABLE report_items ADD COLUMN custom_data TEXT DEFAULT ''")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_report_item_columns", _ensure_report_item_columns)


def _ensure_smtp_settings_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("smtp_settings"):
        return
    columns = {column["name"] for column in inspector.get_columns("smtp_settings")}
    statements = []
    if "signature_html" not in columns:
        statements.append("ALTER TABLE smtp_settings ADD COLUMN signature_html VARCHAR")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_smtp_settings_columns", _ensure_smtp_settings_columns)


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
    if "newsletter_email" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN newsletter_email VARCHAR DEFAULT ''")
    if "billing_email" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN billing_email VARCHAR DEFAULT ''")
    if "time_tracking_enabled" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN time_tracking_enabled BOOLEAN DEFAULT FALSE")
    if "customer_report" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN customer_report BOOLEAN DEFAULT TRUE")
    if "newsletter" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN newsletter BOOLEAN DEFAULT TRUE")
    if "status" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN status VARCHAR DEFAULT 'active'")
    if "maintenance_contract" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN maintenance_contract BOOLEAN DEFAULT FALSE")
    if "contract_flags" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN contract_flags TEXT DEFAULT '[]'")
    if "street" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN street VARCHAR DEFAULT ''")
    if "postal_code" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN postal_code VARCHAR DEFAULT ''")
    if "city" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN city VARCHAR DEFAULT ''")
    if "country" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN country VARCHAR DEFAULT ''")
    if "billing_street" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN billing_street VARCHAR DEFAULT ''")
    if "billing_postal_code" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN billing_postal_code VARCHAR DEFAULT ''")
    if "billing_city" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN billing_city VARCHAR DEFAULT ''")
    if "billing_country" not in columns:
        statements.append("ALTER TABLE customers ADD COLUMN billing_country VARCHAR DEFAULT ''")
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
        if "customer_report" in columns:
            connection.execute(
                text("UPDATE customers SET customer_report = TRUE WHERE customer_report IS NULL")
            )
        if "status" in columns:
            connection.execute(
                text("UPDATE customers SET status = 'active' WHERE status IS NULL OR TRIM(status) = ''")
            )
        if "newsletter" in columns:
            connection.execute(
                text("UPDATE customers SET newsletter = TRUE WHERE newsletter IS NULL")
            )


_run_db_startup_step("ensure_customer_columns", _ensure_customer_columns)


def _ensure_delivery_note_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("delivery_notes"):
        return
    columns = {column["name"] for column in inspector.get_columns("delivery_notes")}
    statements = []
    if "time_from" not in columns:
        statements.append("ALTER TABLE delivery_notes ADD COLUMN time_from VARCHAR DEFAULT ''")
    if "time_to" not in columns:
        statements.append("ALTER TABLE delivery_notes ADD COLUMN time_to VARCHAR DEFAULT ''")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_delivery_note_columns", _ensure_delivery_note_columns)


def _ensure_report_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("reports"):
        return
    columns = {column["name"] for column in inspector.get_columns("reports")}
    statements = []
    if "third_party_payload" not in columns:
        statements.append("ALTER TABLE reports ADD COLUMN third_party_payload VARCHAR DEFAULT ''")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_report_columns", _ensure_report_columns)


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
    if "wartungsvertrag" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN wartungsvertrag BOOLEAN DEFAULT FALSE")
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
    if "urgency_flag" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN urgency_flag VARCHAR DEFAULT ''")
    if "billing_note" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN billing_note VARCHAR DEFAULT ''")
    if "billing_min_hours" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN billing_min_hours DOUBLE PRECISION DEFAULT 0")
    if "employee_id" not in columns:
        statements.append("ALTER TABLE day_tasks ADD COLUMN employee_id INTEGER")
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


_run_db_startup_step("ensure_day_tasks_columns", _ensure_day_tasks_columns)


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


_run_db_startup_step("ensure_day_task_groups_columns", _ensure_day_task_groups_columns)


def _ensure_infra_discovery_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("infra_discovery_devices"):
        return
    columns = {column["name"] for column in inspector.get_columns("infra_discovery_devices")}
    statements = []
    if "device_type" not in columns:
        statements.append("ALTER TABLE infra_discovery_devices ADD COLUMN device_type VARCHAR DEFAULT ''")
    if "vendor" not in columns:
        statements.append("ALTER TABLE infra_discovery_devices ADD COLUMN vendor VARCHAR DEFAULT ''")
    if "confidence" not in columns:
        statements.append("ALTER TABLE infra_discovery_devices ADD COLUMN confidence INTEGER DEFAULT 0")
    if "evidence" not in columns:
        statements.append("ALTER TABLE infra_discovery_devices ADD COLUMN evidence TEXT DEFAULT '[]'")
    if "is_active" not in columns:
        statements.append("ALTER TABLE infra_discovery_devices ADD COLUMN is_active BOOLEAN DEFAULT TRUE")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_infra_discovery_columns", _ensure_infra_discovery_columns)


def _ensure_customer_inventory_events_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("customer_inventory_events"):
        return
    columns = {column["name"] for column in inspector.get_columns("customer_inventory_events")}
    statements = []
    if "cancellation_date" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN cancellation_date VARCHAR DEFAULT ''")
    if "provider" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN provider VARCHAR DEFAULT ''")
    if "billing_cycle" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN billing_cycle VARCHAR DEFAULT 'monthly'")
    if "reminder_days" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN reminder_days INTEGER DEFAULT 60")
    if "is_external" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN is_external BOOLEAN DEFAULT FALSE")
    if "is_recurring" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE")
    if "cost_category" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN cost_category VARCHAR DEFAULT 'other'")
    if "monthly_cost_eur" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN monthly_cost_eur DOUBLE PRECISION DEFAULT 0")
    if "tags_json" not in columns:
        statements.append("ALTER TABLE customer_inventory_events ADD COLUMN tags_json TEXT DEFAULT '[]'")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step("ensure_customer_inventory_events_columns", _ensure_customer_inventory_events_columns)

def _ensure_customer_contract_documents_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("customer_contract_documents"):
        return
    columns = {column["name"] for column in inspector.get_columns("customer_contract_documents")}
    statements = []
    if "html_content" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN html_content TEXT DEFAULT ''")
    if "template_key" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN template_key VARCHAR DEFAULT ''")
    if "monthly_hours_included" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN monthly_hours_included DOUBLE PRECISION DEFAULT 0")
    if "valid_from" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN valid_from VARCHAR DEFAULT ''")
    if "runtime_months" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN runtime_months INTEGER DEFAULT 12")
    if "termination_notice_months" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN termination_notice_months INTEGER DEFAULT 3")
    if "auto_extension_months" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN auto_extension_months INTEGER DEFAULT 12")
    if "snapshot_json" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN snapshot_json TEXT DEFAULT '{}'")
    if "cancelled_effective_at" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN cancelled_effective_at BIGINT DEFAULT 0")
    if "stop_service_immediately" not in columns:
        statements.append("ALTER TABLE customer_contract_documents ADD COLUMN stop_service_immediately BOOLEAN DEFAULT FALSE")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step(
    "ensure_customer_contract_documents_columns",
    _ensure_customer_contract_documents_columns,
)


def _ensure_contract_tariffs_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("contract_tariffs"):
        return
    columns = {column["name"] for column in inspector.get_columns("contract_tariffs")}
    statements = []
    if "hourly_price" not in columns:
        statements.append("ALTER TABLE contract_tariffs ADD COLUMN hourly_price DOUBLE PRECISION DEFAULT 0")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_run_db_startup_step(
    "ensure_contract_tariffs_columns",
    _ensure_contract_tariffs_columns,
)

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
    newsletter_email: Optional[str] = ""
    time_tracking_enabled: Optional[bool] = None
    customer_report: Optional[bool] = None
    newsletter: Optional[bool] = None
    status: Optional[str] = "active"
    maintenance_contract: Optional[bool] = False
    contract_flags: Optional[List[str]] = None
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
    newsletter_email: Optional[str] = None
    time_tracking_enabled: Optional[bool] = None
    customer_report: Optional[bool] = None
    newsletter: Optional[bool] = None
    status: Optional[str] = None
    maintenance_contract: Optional[bool] = None
    contract_flags: Optional[List[str]] = None
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
    wartungsvertrag: Optional[bool] = False
    randzeit: Optional[bool] = False
    details: Optional[str] = ""
    arrival_time: Optional[str] = ""
    departure_time: Optional[str] = ""
    deadline: Optional[str] = ""
    urgency_flag: Optional[str] = ""
    billing_note: Optional[str] = ""
    billing_min_hours: Optional[float] = 0
    employee_id: Optional[int] = None
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
    wartungsvertrag: Optional[bool] = None
    randzeit: Optional[bool] = None
    details: Optional[str] = None
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    deadline: Optional[str] = None
    urgency_flag: Optional[str] = None
    billing_note: Optional[str] = None
    billing_min_hours: Optional[float] = None
    employee_id: Optional[int] = None
    elapsed: Optional[int] = None
    running: Optional[bool] = None
    startTime: Optional[int] = None
    completed_at: Optional[int] = None


class DeliveryNoteCreate(BaseModel):
    customer_id: int
    note: Optional[str] = ""
    signature_base64: Optional[str] = ""
    time_from: Optional[str] = ""
    time_to: Optional[str] = ""


class CustomerInventoryEventCreate(BaseModel):
    device_label: Optional[str] = ""
    event_type: Optional[str] = "wartung"
    event_date: Optional[str] = ""
    cancellation_date: Optional[str] = ""
    provider: Optional[str] = ""
    billing_cycle: Optional[str] = "monthly"
    reminder_days: Optional[int] = 60
    is_external: Optional[bool] = False
    is_recurring: Optional[bool] = False
    cost_category: Optional[str] = "other"
    monthly_cost_eur: Optional[float] = 0.0
    tags: Optional[List[str]] = None
    note: Optional[str] = ""


class CustomerInventoryEventUpdate(BaseModel):
    device_label: Optional[str] = None
    event_type: Optional[str] = None
    event_date: Optional[str] = None
    cancellation_date: Optional[str] = None
    provider: Optional[str] = None
    billing_cycle: Optional[str] = None
    reminder_days: Optional[int] = None
    is_external: Optional[bool] = None
    is_recurring: Optional[bool] = None
    cost_category: Optional[str] = None
    monthly_cost_eur: Optional[float] = None
    tags: Optional[List[str]] = None
    note: Optional[str] = None


class CustomerInventoryDeviceStateUpsert(BaseModel):
    source: str
    device_key: str
    device_label: Optional[str] = ""
    retired: Optional[bool] = False
    note: Optional[str] = ""


class CustomerLicenseCreate(BaseModel):
    vendor: Optional[str] = ""
    product_name: Optional[str] = ""
    quantity: Optional[int] = 1
    billing_cycle: Optional[str] = "monthly"
    cost_eur: Optional[float] = 0.0
    valid_until: Optional[str] = ""
    status: Optional[str] = "active"
    notes: Optional[str] = ""


class CustomerLicenseUpdate(BaseModel):
    vendor: Optional[str] = None
    product_name: Optional[str] = None
    quantity: Optional[int] = None
    billing_cycle: Optional[str] = None
    cost_eur: Optional[float] = None
    valid_until: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class EmployeeCreate(BaseModel):
    name: str
    short_code: Optional[str] = ""
    color: Optional[str] = "#111827"


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    short_code: Optional[str] = None
    color: Optional[str] = None


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


class PurchasingItemCreate(BaseModel):
    done: Optional[bool] = False
    status: Optional[str] = "open"
    customer: Optional[str] = ""
    title: str
    sourceUrl: Optional[str] = ""
    quantity: Optional[str] = ""
    remark: Optional[str] = ""
    trackingNumber: Optional[str] = ""
    purchasePrice: Optional[str] = ""
    salePrice: Optional[str] = ""


class PurchasingItemUpdate(BaseModel):
    done: Optional[bool] = None
    status: Optional[str] = None
    customer: Optional[str] = None
    title: Optional[str] = None
    sourceUrl: Optional[str] = None
    quantity: Optional[str] = None
    remark: Optional[str] = None
    trackingNumber: Optional[str] = None
    purchasePrice: Optional[str] = None
    salePrice: Optional[str] = None


class PurchasingTrackingStatusLookup(BaseModel):
    trackingNumbers: Optional[List[str]] = None
    force: Optional[bool] = False


class KnowledgeArticleCreate(BaseModel):
    title: Optional[str] = "Neuer Artikel"
    category: Optional[str] = ""
    tags: Optional[List[str]] = None
    content: Optional[str] = ""
    pinned: Optional[bool] = False


class KnowledgeArticleUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    content: Optional[str] = None
    pinned: Optional[bool] = None

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
    action_type: Optional[str] = "standard"
    custom_html: Optional[str] = ""
    custom_text: Optional[str] = ""
    custom_data: Optional[Dict[str, Any]] = None

class ReportCreate(BaseModel):
    customer: str
    customer_id: Optional[int] = None
    period: Optional[str] = ""
    status: Optional[str] = ""
    summary: Optional[str] = ""
    customer_action_text: Optional[str] = ""
    customer_status: Optional[str] = ""
    third_party_payload: Optional[Dict[str, Any]] = None
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
    third_party_payload: Optional[Dict[str, Any]] = None
    items: Optional[List[ReportItemSchema]] = None


class NewsletterGroupCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    customer_ids: Optional[List[int]] = None


class NewsletterGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    customer_ids: Optional[List[int]] = None


class NewsletterSaveRequest(BaseModel):
    title: Optional[str] = ""
    subject: str
    preheader: Optional[str] = ""
    intro_html: Optional[str] = ""
    body_html: Optional[str] = ""
    cta_label: Optional[str] = ""
    cta_url: Optional[str] = ""
    closing_html: Optional[str] = ""
    selected_group_ids: Optional[List[int]] = None
    selected_customer_ids: Optional[List[int]] = None
    recipient_emails: Optional[List[str]] = None


class NewsletterUpdateRequest(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    preheader: Optional[str] = None
    intro_html: Optional[str] = None
    body_html: Optional[str] = None
    cta_label: Optional[str] = None
    cta_url: Optional[str] = None
    closing_html: Optional[str] = None
    selected_group_ids: Optional[List[int]] = None
    selected_customer_ids: Optional[List[int]] = None
    recipient_emails: Optional[List[str]] = None


class NewsletterSendRequest(BaseModel):
    recipient_emails: Optional[List[str]] = None
    subject: Optional[str] = None
    html: str
    text: Optional[str] = None
    attachments: Optional[List["EmailAttachment"]] = None


class NewsletterRssFeedCreate(BaseModel):
    name: str
    url: str
    description: Optional[str] = ""
    enabled: Optional[bool] = True


class NewsletterRssFeedUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None


class NewsletterRssGenerateArticle(BaseModel):
    feed_name: Optional[str] = ""
    title: str
    link: Optional[str] = ""
    summary: Optional[str] = ""
    content: Optional[str] = ""
    published_at: Optional[int] = 0


class NewsletterRssGenerateRequest(BaseModel):
    mode: str = "ideas"
    tone: Optional[str] = "sachlich"
    articles: List[NewsletterRssGenerateArticle]


class IntegrationSettingsUpdate(BaseModel):
    rmm_host: Optional[str] = None
    rmm_user: Optional[str] = None
    rmm_password: Optional[str] = None
    rmm_api_key: Optional[str] = None
    rmm_api_key_header: Optional[str] = None
    pbx_base_url: Optional[str] = None
    pbx_username: Optional[str] = None
    pbx_password: Optional[str] = None
    pbx_refresh_token: Optional[str] = None
    pbx_api_key_id: Optional[str] = None
    pbx_api_key_secret: Optional[str] = None
    pbx_customer_account: Optional[str] = None
    marketplace_import_url: Optional[str] = None
    td_synnex_base_url: Optional[str] = None
    td_synnex_token_url: Optional[str] = None
    td_synnex_client_id: Optional[str] = None
    td_synnex_client_secret: Optional[str] = None
    td_synnex_account_id: Optional[str] = None
    also_sftp_host: Optional[str] = None
    also_sftp_port: Optional[str] = None
    also_sftp_user: Optional[str] = None
    also_sftp_password: Optional[str] = None
    also_sftp_dir: Optional[str] = None
    also_sftp_filename: Optional[str] = None
    sevdesk_base_url: Optional[str] = None
    sevdesk_api_token: Optional[str] = None
    sevdesk_contact_person_id: Optional[str] = None
    sevdesk_address_country_id: Optional[str] = None
    sevdesk_tax_type: Optional[str] = None
    sevdesk_tax_rule_id: Optional[str] = None
    sevdesk_tax_text: Optional[str] = None
    sevdesk_currency: Optional[str] = None
    sevdesk_invoice_type: Optional[str] = None
    sevdesk_default_tax_rate: Optional[str] = None
    sevdesk_unity_id: Optional[str] = None
    sevdesk_service_unity_id: Optional[str] = None
    sevdesk_device_unity_id: Optional[str] = None
    sevdesk_hourly_rate_eur: Optional[str] = None
    icecat_api_token: Optional[str] = None
    icecat_enabled: Optional[bool] = None
    meta_hub_rmm_enabled: Optional[bool] = None
    meta_hub_rmm_customer_field_name: Optional[str] = None
    meta_hub_email_enabled: Optional[bool] = None
    meta_hub_refresh_seconds: Optional[int] = None
    meta_hub_mailboxes: Optional[List[Dict[str, Any]]] = None
    ai_provider: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_default_model: Optional[str] = None
    ai_internal_model: Optional[str] = None
    ai_action_model: Optional[str] = None
    ai_task_model: Optional[str] = None
    ai_customer_ranking_model: Optional[str] = None
    ai_customer_development_model: Optional[str] = None
    ai_offer_model: Optional[str] = None
    ai_invoice_model: Optional[str] = None


class AiConnectionProbeRequest(BaseModel):
    ai_provider: Optional[str] = None
    ai_base_url: Optional[str] = None
    ai_api_key: Optional[str] = None
    ai_default_model: Optional[str] = None
    ai_internal_model: Optional[str] = None
    ai_action_model: Optional[str] = None
    ai_task_model: Optional[str] = None
    ai_customer_ranking_model: Optional[str] = None
    ai_customer_development_model: Optional[str] = None
    ai_offer_model: Optional[str] = None
    ai_invoice_model: Optional[str] = None


class SmtpSettingsUpdate(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    use_tls: Optional[bool] = None
    use_ssl: Optional[bool] = None
    signature_html: Optional[str] = None


class MetaHubMailboxTestRequest(BaseModel):
    mailbox: Optional[Dict[str, Any]] = None


class CustomerMetricsSettingsUpdate(BaseModel):
    office_address: Optional[str] = None
    km_rate_eur: Optional[str] = None
    min_distance_km: Optional[str] = None
    min_fee_eur: Optional[str] = None
    hourly_rate_eur: Optional[str] = None


class ContractTariffCreate(BaseModel):
    name: str
    category: str
    base_price_monthly: float = 0.0
    price_server_monthly: float = 0.0
    price_client_monthly: float = 0.0
    price_network_monthly: float = 0.0
    price_iot_monthly: float = 0.0
    hourly_price: float = 0.0
    notes: Optional[str] = ""


class ContractTariffVersionCreate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    base_price_monthly: Optional[float] = None
    price_server_monthly: Optional[float] = None
    price_client_monthly: Optional[float] = None
    price_network_monthly: Optional[float] = None
    price_iot_monthly: Optional[float] = None
    hourly_price: Optional[float] = None
    notes: Optional[str] = None


class ContractTariffUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    base_price_monthly: Optional[float] = None
    price_server_monthly: Optional[float] = None
    price_client_monthly: Optional[float] = None
    price_network_monthly: Optional[float] = None
    price_iot_monthly: Optional[float] = None
    hourly_price: Optional[float] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class CustomerContractCalculationCreate(BaseModel):
    tariff_id: int
    servers: int = 0
    clients: int = 0
    network_devices: int = 0
    iot_devices: int = 0
    monthly_total: Optional[float] = None
    yearly_total: Optional[float] = None
    note: Optional[str] = ""


class CustomerContractDocumentCreate(BaseModel):
    title: str
    doc_type: Optional[str] = "wartung"
    file_name: Optional[str] = None
    mime_type: Optional[str] = "application/pdf"
    content_base64: str
    html_content: Optional[str] = ""
    template_key: Optional[str] = ""
    tariff_id: Optional[int] = None
    monthly_hours_included: Optional[float] = 0.0
    valid_from: Optional[str] = ""
    runtime_months: Optional[int] = 12
    termination_notice_months: Optional[int] = 3
    auto_extension_months: Optional[int] = 12
    note: Optional[str] = ""
    monthly_total: Optional[float] = None
    yearly_total: Optional[float] = None
    suggested_monthly_total: Optional[float] = None
    suggested_yearly_total: Optional[float] = None
    servers: Optional[int] = 0
    clients: Optional[int] = 0
    network_devices: Optional[int] = 0
    iot_devices: Optional[int] = 0
    contract_variable_values: Optional[Dict[str, str]] = None
    status: Optional[str] = "active"


class CustomerContractStatusUpdate(BaseModel):
    reason: Optional[str] = ""
    stop_service_immediately: Optional[bool] = False
    effective_at: Optional[int] = 0


class CustomerContractPreviewRequest(BaseModel):
    title: Optional[str] = ""
    doc_type: Optional[str] = "wartung"
    template_key: Optional[str] = ""
    note: Optional[str] = ""
    tariff_id: Optional[int] = None
    calculation_id: Optional[int] = None
    servers: Optional[int] = 0
    clients: Optional[int] = 0
    network_devices: Optional[int] = 0
    iot_devices: Optional[int] = 0
    monthly_total: Optional[float] = None
    yearly_total: Optional[float] = None
    monthly_hours_included: Optional[float] = 0.0
    valid_from: Optional[str] = ""
    runtime_months: Optional[int] = 12
    termination_notice_months: Optional[int] = 3
    auto_extension_months: Optional[int] = 12
    contract_variable_values: Optional[Dict[str, str]] = None


class CustomerPrepaidHoursEntryCreate(BaseModel):
    entry_type: Optional[str] = "purchase"
    hours: float
    label: Optional[str] = ""
    note: Optional[str] = ""
    task_id: Optional[int] = None
    effective_at: Optional[int] = 0


class InfraDiscoveryItem(BaseModel):
    customer_id: Optional[int] = None
    customer_number: Optional[str] = ""
    customer_name: Optional[str] = ""
    source: Optional[str] = "agent"
    hostname: Optional[str] = ""
    ip: Optional[str] = ""
    mac: Optional[str] = ""
    protocol: Optional[str] = ""
    device_type: Optional[str] = ""
    vendor: Optional[str] = ""
    confidence: Optional[int] = 0
    evidence: Optional[List[str]] = None
    managed: Optional[bool] = False
    seen_at: Optional[int] = None


class InfraDiscoveryIngestRequest(BaseModel):
    items: List[InfraDiscoveryItem]


class CustomerDevelopmentAiRequest(BaseModel):
    customer_id: Optional[int] = None
    mode: str = "summary"
    tone: Optional[str] = "sachlich"


class CustomerDevelopmentAiInternalRequest(BaseModel):
    customer_id: Optional[int] = None
    mode: str = "summary"
    tone: Optional[str] = "sachlich"
    context: Dict[str, Any]


class InternalAiPromptRequest(BaseModel):
    prompt: str
    content: Optional[str] = ""
    model: Optional[str] = ""


class CustomerDevelopmentReportSuggestionPreviewRequest(BaseModel):
    customer_id: int
    recommendation_index: Optional[int] = 0


class CustomerDevelopmentReportSuggestionImportRequest(BaseModel):
    report_id: int
    customer_id: int
    recommendation_index: Optional[int] = 0
    confirm: bool = False


class OfferSettingsUpdate(BaseModel):
    offer_number_format: Optional[str] = None


class ReportSendRequest(BaseModel):
    to: str
    subject: Optional[str] = None
    html: str
    text: Optional[str] = None
    attachments: Optional[List["EmailAttachment"]] = None


class ReportPdfRequest(BaseModel):
    html: str
    filename: Optional[str] = None

class EmailAttachment(BaseModel):
    filename: str
    content_base64: str
    content_type: Optional[str] = None
    content_id: Optional[str] = None
    inline: Optional[bool] = False


class OfferSendRequest(BaseModel):
    offer_id: Optional[int] = None
    to: str
    subject: Optional[str] = None
    html: str
    text: Optional[str] = None
    attachments: Optional[List[EmailAttachment]] = None


ReportSendRequest.update_forward_refs()


def _attach_email_attachments(
    msg,
    attachments: Optional[List["EmailAttachment"]],
) -> None:
    html_part = None
    try:
        payload = msg.get_payload()
        if isinstance(payload, list):
            for part in payload:
                if str(part.get_content_type() or "").lower() == "text/html":
                    html_part = part
                    break
    except Exception:
        html_part = None

    for attachment in attachments or []:
        try:
            content = base64.b64decode(attachment.content_base64 or "")
        except Exception:  # noqa: BLE001
            continue
        content_type = attachment.content_type or "application/octet-stream"
        if "/" in content_type:
            maintype, subtype = content_type.split("/", 1)
        else:
            maintype, subtype = "application", "octet-stream"
        content_id = str(attachment.content_id or "").strip().strip("<>")
        if attachment.inline and content_id and html_part is not None:
            html_part.add_related(
                content,
                maintype=maintype,
                subtype=subtype,
                cid=f"<{content_id}>",
                filename=attachment.filename or "inline",
                disposition="inline",
            )
            continue
        msg.add_attachment(
            content,
            maintype=maintype,
            subtype=subtype,
            filename=attachment.filename or "attachment",
        )


def _format_smtp_from_address(sender_email: Any, sender_name: Any = "") -> str:
    email_value = str(sender_email or "").strip()
    name_value = str(sender_name or "").strip()
    if not name_value:
        return email_value
    return formataddr((name_value, email_value))


def _build_smtp_message(
    *,
    sender_email: Any,
    sender_name: Any = "",
    to: Any,
    subject: Any,
    text_body: Any = "",
    html_body: Any = "",
    attachments: Optional[List["EmailAttachment"]] = None,
):
    from email.message import EmailMessage

    normalized_sender_email = str(sender_email or "").strip()
    msg = EmailMessage(policy=policy.SMTP)
    msg["Subject"] = str(subject or "").strip()
    msg["From"] = _format_smtp_from_address(normalized_sender_email, sender_name)
    msg["To"] = str(to or "").strip()
    msg["Date"] = formatdate(localtime=True)
    _, parsed_sender = parseaddr(normalized_sender_email)
    message_id_domain = parsed_sender.rsplit("@", 1)[1].strip() if "@" in parsed_sender else ""
    msg["Message-ID"] = make_msgid(domain=message_id_domain or None)
    msg.set_content(
        str(text_body or "Bitte verwenden Sie ein E-Mail-Programm mit HTML-Unterstuetzung.")
    )
    msg.add_alternative(str(html_body or ""), subtype="html")
    _attach_email_attachments(msg, attachments)
    return msg


class OfferSaveRequest(BaseModel):
    reference: Optional[str] = ""
    customer: Optional[str] = ""
    status: Optional[str] = ""
    data: Dict[str, Any]


class OfferSaveResponse(BaseModel):
    id: int
    guid: str
    confirm_url: str
    reference: Optional[str] = ""


class OfferBlocksUpdate(BaseModel):
    serviceBlocks: Optional[List[Dict[str, Any]]] = None
    deviceBlocks: Optional[List[Dict[str, Any]]] = None
    calcBlocks: Optional[List[Dict[str, Any]]] = None


class AiPromptsUpdate(BaseModel):
    action_prompt: Optional[str] = None
    offer_base_prompt: Optional[str] = None
    offer_mode_instructions: Optional[Dict[str, str]] = None
    contract_header_html: Optional[str] = None
    contract_footer_html: Optional[str] = None
    contract_templates: Optional[Dict[str, Dict[str, str]]] = None
    contract_variables: Optional[Dict[str, str]] = None
    contract_variable_definitions: Optional[Dict[str, Dict[str, Any]]] = None


class OfferCustomerConfirm(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    note: Optional[str] = ""


class SevdeskTaskSyncRequest(BaseModel):
    task_ids: Optional[List[int]] = None
    customer_number: Optional[str] = None


class SevdeskTaskDraftRequest(BaseModel):
    customer_number: Optional[str] = None
    header: Optional[str] = None
    name: Optional[str] = None
    text: Optional[str] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    tax_rate: Optional[float] = None
    unity_id: Optional[int] = None
    use_existing_draft: Optional[bool] = True
    add_mileage: Optional[bool] = False
    mileage_name: Optional[str] = None
    mileage_text: Optional[str] = None
    mileage_price: Optional[float] = None
    mark_billed: Optional[bool] = True


class SevdeskOfferDraftRequest(BaseModel):
    line_item_ids: Optional[List[str]] = None
    device_item_ids: Optional[List[str]] = None

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


class DayTaskEmailDraftRequest(BaseModel):
    subject: Optional[str] = ""
    fromEmail: Optional[str] = ""
    fromName: Optional[str] = ""
    text: Optional[str] = ""
    html: Optional[str] = ""


class DayTaskScopeEstimateRequest(BaseModel):
    text: Optional[str] = None


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
def _normalize_urgency_flag(value: Optional[str]) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    aliases = {
        "rot": "red",
        "stillstand": "red",
        "red": "red",
        "orange": "orange",
        "eingeschrankt": "orange",
        "eingeschränkt": "orange",
        "green": "green",
        "gruen": "green",
        "grün": "green",
        "komfortproblem": "green",
        "blue": "blue",
        "blau": "blue",
        "warten auf rueckmeldung": "blue",
        "warten auf rückmeldung": "blue",
        "rueckmeldung": "blue",
        "rückmeldung": "blue",
    }
    return aliases.get(raw, "")


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
        "wartungsvertrag": t.wartungsvertrag,
        "randzeit": t.randzeit,
        "details": t.details,
        "arrival_time": t.arrival_time,
        "departure_time": t.departure_time,
        "deadline": t.deadline,
        "urgency_flag": _normalize_urgency_flag(t.urgency_flag),
        "billing_note": t.billing_note,
        "billing_min_hours": round(float(t.billing_min_hours or 0.0), 2),
        "employee_id": t.employee_id,
        "elapsed": t.elapsed,
        "running": t.running,
        "startTime": t.startTime,
        "completed_at": t.completed_at,
        "created_at": t.created_at,
    }


def serialize_employee(e: Employee) -> Dict[str, Any]:
    return {
        "id": e.id,
        "name": e.name,
        "short_code": e.short_code,
        "color": e.color,
        "created_at": e.created_at,
    }


def _parse_float(value: Optional[str], default: float = 0.0) -> float:
    if value is None:
        return default
    text = str(value).strip()
    if not text:
        return default
    normalized = text.replace(" ", "")
    if normalized.count(",") and normalized.count("."):
        if normalized.rfind(",") > normalized.rfind("."):
            normalized = normalized.replace(".", "")
        normalized = normalized.replace(",", ".")
    elif normalized.count(",") > 1 and normalized.count(".") == 0:
        normalized = normalized.replace(",", "")
    elif normalized.count(",") == 1 and normalized.count(".") == 0:
        normalized = normalized.replace(",", ".")
    try:
        return float(normalized)
    except (TypeError, ValueError):
        try:
            return float(normalized.replace(",", "."))
        except (TypeError, ValueError):
            return default


def _parse_int(value: Optional[str]) -> Optional[int]:
    try:
        parsed = int(str(value))
        return parsed
    except (TypeError, ValueError):
        return None


def _round_up_to_quarter_hours(hours: float) -> float:
    if hours <= 0:
        return 0.0
    return math.ceil(hours * 4) / 4


def _build_sevdesk_config(
    settings: IntegrationSettings, metrics: Optional[CustomerMetricsSettings] = None
) -> SevdeskConfig:
    base_url = (settings.sevdesk_base_url or "").strip() or "https://my.sevdesk.de/api/v1"
    tax_rate = _parse_float(settings.sevdesk_default_tax_rate, default=19.0)
    unity_id = _parse_int(settings.sevdesk_unity_id) or 1
    service_unity_id = _parse_int(settings.sevdesk_service_unity_id)
    device_unity_id = _parse_int(settings.sevdesk_device_unity_id)
    hourly_rate = _resolve_configured_hourly_rate(settings, metrics)

    return SevdeskConfig(
        base_url=base_url,
        api_token=(settings.sevdesk_api_token or "").strip(),
        contact_person_id=_parse_int(settings.sevdesk_contact_person_id),
        address_country_id=_parse_int(settings.sevdesk_address_country_id) or 1,
        tax_type=(settings.sevdesk_tax_type or "default").strip() or "default",
        tax_rule_id=_parse_int(settings.sevdesk_tax_rule_id) or 1,
        tax_text=(settings.sevdesk_tax_text or "zzgl. Umsatzsteuer").strip(),
        currency=(settings.sevdesk_currency or "EUR").strip() or "EUR",
        invoice_type=(settings.sevdesk_invoice_type or "RE").strip() or "RE",
        default_tax_rate=tax_rate,
        unity_id=unity_id,
        service_unity_id=service_unity_id,
        device_unity_id=device_unity_id,
        hourly_rate_eur=hourly_rate,
    )


def _require_sevdesk_config(
    settings: IntegrationSettings, metrics: Optional[CustomerMetricsSettings] = None
) -> SevdeskConfig:
    config = _build_sevdesk_config(settings, metrics)
    missing = []
    if not config.api_token:
        missing.append("sevdesk_api_token")
    if missing:
        raise HTTPException(400, f"Sevdesk settings missing: {', '.join(missing)}")
    return config


def _require_sevdesk_invoice_fields(config: SevdeskConfig) -> None:
    return None


def _resolve_configured_hourly_rate(
    integration: Optional[IntegrationSettings] = None,
    metrics: Optional[CustomerMetricsSettings] = None,
) -> float:
    if integration is not None:
        configured_rate = _parse_float(getattr(integration, "sevdesk_hourly_rate_eur", ""), default=-1.0)
        if configured_rate > 0:
            return configured_rate
    if metrics is not None:
        legacy_rate = _parse_float(getattr(metrics, "hourly_rate_eur", ""), default=0.0)
        if legacy_rate > 0:
            return legacy_rate
    return 0.0


def _split_model_list(raw_value: Any) -> List[str]:
    text_value = str(raw_value or "").strip()
    if not text_value:
        return []
    parts = [part.strip() for part in re.split(r"[,\s]+", text_value) if part.strip()]
    return parts


def _normalize_ai_provider(raw_value: Any) -> str:
    provider = str(raw_value or "").strip().lower()
    if provider in {"vllm", "openai", "openai_api", "openai-api", "openai-compatible", "openai_compatible"}:
        return AI_PROVIDER_OPENAI_COMPATIBLE
    if provider == AI_PROVIDER_OLLAMA:
        return AI_PROVIDER_OLLAMA
    if not provider and (AI_BASE_URL_ENV or AI_API_KEY_ENV):
        return AI_PROVIDER_OPENAI_COMPATIBLE
    return AI_PROVIDER_OLLAMA


def _normalize_ai_base_url(raw_value: Any, provider: str) -> str:
    base_url = str(raw_value or "").strip().rstrip("/")
    if base_url:
        return base_url
    if provider == AI_PROVIDER_OLLAMA:
        return str(OLLAMA_BASE_URL or "").strip().rstrip("/")
    return ""


def _normalize_openai_compatible_url(base_url: str, path: str) -> str:
    normalized_base = str(base_url or "").strip().rstrip("/")
    normalized_path = str(path or "").strip().lstrip("/")
    if not normalized_base:
        return ""
    if normalized_base.lower().endswith("/v1"):
        return f"{normalized_base}/{normalized_path}"
    return f"{normalized_base}/v1/{normalized_path}"


def _merge_model_candidates(*values: Any) -> List[str]:
    ordered: List[str] = []
    seen: Set[str] = set()
    for raw in values:
        for model in _split_model_list(raw):
            lowered = model.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            ordered.append(model)
    return ordered


def _build_ai_config_snapshot(settings: Optional[IntegrationSettings] = None) -> Dict[str, Any]:
    provider = _normalize_ai_provider(
        (getattr(settings, "ai_provider", "") if settings is not None else "") or AI_PROVIDER_ENV
    )
    base_url = _normalize_ai_base_url(
        (getattr(settings, "ai_base_url", "") if settings is not None else "") or AI_BASE_URL_ENV,
        provider,
    )
    api_key = str(
        (getattr(settings, "ai_api_key", "") if settings is not None else "") or AI_API_KEY_ENV
    ).strip()
    default_model = str(
        (getattr(settings, "ai_default_model", "") if settings is not None else "") or AI_DEFAULT_MODEL_ENV
    ).strip()
    if not default_model:
        default_model = AI_DEFAULT_MODEL_ENV
    models: Dict[str, str] = {}
    for purpose, field_name in AI_MODEL_SETTINGS_FIELDS.items():
        configured_value = getattr(settings, field_name, "") if settings is not None else ""
        models[purpose] = str(configured_value or AI_MODEL_ENV_DEFAULTS.get(purpose) or "").strip()
    return {
        "provider": provider,
        "base_url": base_url,
        "api_key": api_key,
        "default_model": default_model,
        "models": models,
    }


def _get_ai_config_snapshot(settings: Optional[IntegrationSettings] = None) -> Dict[str, Any]:
    if settings is not None:
        return _build_ai_config_snapshot(settings)
    with SessionLocal() as db:
        return _build_ai_config_snapshot(db.query(IntegrationSettings).first())


def _build_ai_config_from_request(
    data: Optional[AiConnectionProbeRequest],
    persisted_settings: Optional[IntegrationSettings] = None,
) -> Dict[str, Any]:
    base_config = _build_ai_config_snapshot(persisted_settings)
    if data is None:
        return base_config
    payload = data.dict(exclude_unset=True)
    provider = _normalize_ai_provider(payload.get("ai_provider", base_config.get("provider")))
    base_url = _normalize_ai_base_url(payload.get("ai_base_url", base_config.get("base_url")), provider)
    api_key = str(payload.get("ai_api_key", base_config.get("api_key")) or "").strip()
    default_model = str(payload.get("ai_default_model", base_config.get("default_model")) or "").strip()
    models = dict(base_config.get("models") or {})
    for purpose, field_name in AI_MODEL_SETTINGS_FIELDS.items():
        if field_name not in payload:
            continue
        models[purpose] = str(payload.get(field_name) or "").strip()
    return {
        "provider": provider,
        "base_url": base_url,
        "api_key": api_key,
        "default_model": default_model,
        "models": models,
    }


def _resolve_ai_models(
    *specific_values: Any,
    purpose: str = "",
    settings: Optional[IntegrationSettings] = None,
    config: Optional[Dict[str, Any]] = None,
) -> List[str]:
    resolved_config = config or _get_ai_config_snapshot(settings)
    ordered = _merge_model_candidates(
        *specific_values,
        (resolved_config.get("models") or {}).get(str(purpose or "").strip().lower(), ""),
        resolved_config.get("default_model") or "",
    )
    if not ordered:
        ordered.append("qwen3:8b")
    return ordered


def _resolve_ollama_models(*specific_values: Any) -> List[str]:
    return _resolve_ai_models(*specific_values)


def _configured_ai_models_for_picker(config: Dict[str, Any]) -> List[str]:
    models = config.get("models") if isinstance(config, dict) else {}
    configured = _merge_model_candidates(
        (models or {}).get("internal_ai", ""),
        (models or {}).get("action", ""),
        (models or {}).get("task_draft", ""),
        (models or {}).get("invoice_summary", ""),
        config.get("default_model") if isinstance(config, dict) else "",
    )
    return configured


def _list_ollama_models(timeout_seconds: int = 8, base_url: Optional[str] = None) -> List[str]:
    connect_timeout = max(1, int(OLLAMA_CONNECT_TIMEOUT_SECONDS or 1))
    request_timeout = max(connect_timeout, int(timeout_seconds or 8))
    resolved_base_url = _normalize_ai_base_url(base_url or OLLAMA_BASE_URL, AI_PROVIDER_OLLAMA)
    if not resolved_base_url:
        return []
    try:
        with _ollama_http.get(
            f"{resolved_base_url}/api/tags",
            timeout=(connect_timeout, request_timeout),
        ) as response:
            response.raise_for_status()
            payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Ollama model listing failed: %s", exc)
        return []
    models = payload.get("models") if isinstance(payload, dict) else None
    if not isinstance(models, list):
        return []
    ordered: List[str] = []
    seen = set()
    for entry in models:
        if not isinstance(entry, dict):
            continue
        model_name = str(entry.get("model") or entry.get("name") or "").strip()
        if not model_name:
            continue
        normalized = model_name.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(model_name)
    return ordered


def _build_openai_compatible_headers(api_key: str) -> Dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if str(api_key or "").strip():
        headers["Authorization"] = f"Bearer {str(api_key).strip()}"
    return headers


def _list_openai_compatible_models(
    config: Dict[str, Any],
    timeout_seconds: int = 8,
) -> List[str]:
    base_url = str(config.get("base_url") or "").strip()
    request_url = _normalize_openai_compatible_url(base_url, "models")
    if not request_url:
        return []
    connect_timeout = max(1, int(OLLAMA_CONNECT_TIMEOUT_SECONDS or 1))
    request_timeout = max(connect_timeout, int(timeout_seconds or 8))
    try:
        with _ollama_http.get(
            request_url,
            headers=_build_openai_compatible_headers(str(config.get("api_key") or "")),
            timeout=(connect_timeout, request_timeout),
        ) as response:
            response.raise_for_status()
            payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("OpenAI-compatible model listing failed: %s", exc)
        return []
    items = payload.get("data") if isinstance(payload, dict) else None
    ordered: List[str] = []
    seen: Set[str] = set()
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        model_name = str(item.get("id") or item.get("model") or "").strip()
        if not model_name:
            continue
        normalized = model_name.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        ordered.append(model_name)
    return ordered


def _list_available_ai_models(
    *,
    timeout_seconds: int = 8,
    settings: Optional[IntegrationSettings] = None,
    config: Optional[Dict[str, Any]] = None,
) -> List[str]:
    resolved_config = config or _get_ai_config_snapshot(settings)
    provider = str(resolved_config.get("provider") or AI_PROVIDER_OLLAMA)
    if provider == AI_PROVIDER_OPENAI_COMPATIBLE:
        models = _list_openai_compatible_models(resolved_config, timeout_seconds=timeout_seconds)
    else:
        models = _list_ollama_models(
            timeout_seconds=timeout_seconds,
            base_url=str(resolved_config.get("base_url") or OLLAMA_BASE_URL),
        )
    if models:
        return models
    return _configured_ai_models_for_picker(resolved_config)


def _resolve_internal_ai_tool_models(requested_model: Any = None) -> List[str]:
    config = _get_ai_config_snapshot()
    requested = str(requested_model or "").strip()
    available_models = _list_available_ai_models(config=config)
    if requested:
        if not available_models:
            return _resolve_ai_models(requested, purpose="internal_ai", config=config)
        available_lookup = {model.lower(): model for model in available_models}
        matched_model = available_lookup.get(requested.lower())
        if not matched_model:
            raise HTTPException(400, f"Unbekanntes Modell: {requested}")
        return _resolve_ai_models(matched_model, purpose="internal_ai", config=config)
    if available_models:
        available_lookup = {model.lower(): model for model in available_models}
        preferred = _resolve_ai_models(
            MODEL_PREF_INTERNAL_AI,
            MODEL_PREF_ACTION,
            MODEL_PREF_TASK_DRAFT,
            MODEL_PREF_INVOICE_SUMMARY,
            purpose="internal_ai",
            config=config,
        )
        ordered: List[str] = []
        seen = set()
        for candidate in preferred:
            matched_model = available_lookup.get(candidate.lower())
            if matched_model and matched_model.lower() not in seen:
                ordered.append(matched_model)
                seen.add(matched_model.lower())
        for model in available_models:
            normalized = model.lower()
            if normalized in seen:
                continue
            ordered.append(model)
            seen.add(normalized)
        return ordered
    return _resolve_ai_models(
        MODEL_PREF_INTERNAL_AI,
        MODEL_PREF_ACTION,
        MODEL_PREF_TASK_DRAFT,
        MODEL_PREF_INVOICE_SUMMARY,
        purpose="internal_ai",
        config=config,
    )


def _internal_ai_prompt_limit_chars() -> int:
    resolved_max_tokens = max(
        128,
        min(int(INTERNAL_AI_TOOL_MAX_TOKENS), int(OLLAMA_MAX_TOKENS_HARD_LIMIT or INTERNAL_AI_TOOL_MAX_TOKENS)),
    )
    prompt_ctx_budget = max(
        128,
        int(OLLAMA_NUM_CTX) - int(resolved_max_tokens) - int(OLLAMA_PROMPT_TOKEN_MARGIN),
    )
    ctx_limited_chars = max(800, int(prompt_ctx_budget * 4))
    return max(800, min(int(OLLAMA_PROMPT_MAX_CHARS), ctx_limited_chars))


def _ollama_cache_key(
    *,
    prompt: str,
    model_candidates: List[str],
    provider: str,
    base_url: str,
    response_format: str,
    temperature: Optional[float],
    max_tokens: Optional[int],
) -> str:
    payload = {
        "prompt": prompt,
        "model_candidates": model_candidates,
        "provider": provider,
        "base_url": base_url,
        "response_format": response_format,
        "temperature": temperature,
        "max_tokens": int(max_tokens or 0),
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _get_cached_ollama_response(cache_key: str) -> Optional[Tuple[Dict[str, Any], str]]:
    if not cache_key or OLLAMA_RESPONSE_CACHE_TTL_SECONDS <= 0:
        return None
    now_ms = int(time.time() * 1000)
    with _ollama_response_cache_lock:
        entry = _ollama_response_cache.get(cache_key)
        if not entry:
            return None
        cached_at = int(entry.get("cachedAt") or 0)
        ttl_ms = OLLAMA_RESPONSE_CACHE_TTL_SECONDS * 1000
        if cached_at <= 0 or now_ms - cached_at > ttl_ms:
            _ollama_response_cache.pop(cache_key, None)
            return None
        payload = entry.get("payload")
        model = str(entry.get("model") or "")
    if not isinstance(payload, dict):
        return None
    return dict(payload), model


def _store_cached_ollama_response(cache_key: str, payload: Dict[str, Any], model: str) -> None:
    if not cache_key or OLLAMA_RESPONSE_CACHE_TTL_SECONDS <= 0:
        return
    now_ms = int(time.time() * 1000)
    with _ollama_response_cache_lock:
        if len(_ollama_response_cache) >= OLLAMA_RESPONSE_CACHE_MAX_ENTRIES:
            oldest_key = min(
                _ollama_response_cache.items(),
                key=lambda item: int((item[1] or {}).get("cachedAt") or 0),
            )[0]
            _ollama_response_cache.pop(oldest_key, None)
        _ollama_response_cache[cache_key] = {
            "cachedAt": now_ms,
            "model": model,
            "payload": dict(payload),
        }


def _ollama_model_temporarily_missing(model: str) -> bool:
    if OLLAMA_MISSING_MODEL_TTL_SECONDS <= 0:
        return False
    model_key = str(model or "").strip().lower()
    if not model_key:
        return False
    now_ms = int(time.time() * 1000)
    with _ollama_missing_model_lock:
        until_ms = int(_ollama_missing_model_until_ms.get(model_key) or 0)
        if until_ms <= 0:
            return False
        if now_ms >= until_ms:
            _ollama_missing_model_until_ms.pop(model_key, None)
            return False
        return True


def _mark_ollama_model_missing(model: str) -> None:
    if OLLAMA_MISSING_MODEL_TTL_SECONDS <= 0:
        return
    model_key = str(model or "").strip().lower()
    if not model_key:
        return
    ttl_ms = OLLAMA_MISSING_MODEL_TTL_SECONDS * 1000
    with _ollama_missing_model_lock:
        _ollama_missing_model_until_ms[model_key] = int(time.time() * 1000) + ttl_ms


def _ollama_generate(
    prompt: str,
    *,
    model_candidates: List[str],
    base_url: Optional[str] = None,
    timeout: Optional[int] = None,
    response_format: str = "",
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    use_cache: bool = True,
    raw: bool = False,
) -> Tuple[Dict[str, Any], str]:
    request_timeout = max(1, int(timeout or OLLAMA_TIMEOUT_SECONDS))
    connect_timeout = max(1, int(OLLAMA_CONNECT_TIMEOUT_SECONDS or 1))
    resolved_base_url = _normalize_ai_base_url(base_url or OLLAMA_BASE_URL, AI_PROVIDER_OLLAMA)
    if not resolved_base_url:
        return {}, ""
    normalized_models = []
    seen_models: Set[str] = set()
    for item in model_candidates:
        model_name = str(item or "").strip()
        if not model_name:
            continue
        model_key = model_name.lower()
        if model_key in seen_models:
            continue
        seen_models.add(model_key)
        normalized_models.append(model_name)
    if not normalized_models:
        normalized_models = _resolve_ollama_models(OLLAMA_MODEL)
    cache_key = (
        _ollama_cache_key(
            prompt=prompt,
            model_candidates=normalized_models,
            provider=AI_PROVIDER_OLLAMA,
            base_url=resolved_base_url,
            response_format=response_format,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if use_cache
        else ""
    )
    cached_response = _get_cached_ollama_response(cache_key) if cache_key else None
    if cached_response is not None:
        return cached_response

    prompt_text = str(prompt or "").strip()
    if not prompt_text:
        return {}, ""
    if len(prompt_text) > OLLAMA_PROMPT_MAX_CHARS:
        prompt_text = prompt_text[:OLLAMA_PROMPT_MAX_CHARS]
    resolved_max_tokens: Optional[int] = None
    if max_tokens is not None:
        try:
            resolved_max_tokens = max(1, min(int(max_tokens), OLLAMA_MAX_TOKENS_HARD_LIMIT))
        except (TypeError, ValueError):
            resolved_max_tokens = None
    target_predict = int(resolved_max_tokens or OLLAMA_MAX_TOKENS_HARD_LIMIT or 0)
    prompt_ctx_budget = max(128, int(OLLAMA_NUM_CTX) - target_predict - int(OLLAMA_PROMPT_TOKEN_MARGIN))
    approx_prompt_tokens = max(1, int(math.ceil(len(prompt_text) / 4.0)))
    if approx_prompt_tokens > prompt_ctx_budget:
        allowed_chars = max(800, int(prompt_ctx_budget * 4))
        if len(prompt_text) > allowed_chars:
            prompt_text = prompt_text[:allowed_chars]
            logger.info(
                "Ollama prompt trimmed before request approx_tokens=%s budget=%s chars=%s",
                approx_prompt_tokens,
                prompt_ctx_budget,
                len(prompt_text),
            )

    for model in normalized_models:
        if _ollama_model_temporarily_missing(model):
            continue
        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt_text,
            "stream": bool(OLLAMA_STREAM_ENABLED),
        }
        if raw:
            payload["raw"] = True
        if response_format:
            payload["format"] = response_format
        options: Dict[str, Any] = {
            "num_ctx": int(OLLAMA_NUM_CTX),
            "num_thread": int(OLLAMA_NUM_THREAD),
        }
        if temperature is not None:
            options["temperature"] = float(temperature)
        if resolved_max_tokens is not None and resolved_max_tokens > 0:
            options["num_predict"] = int(resolved_max_tokens)
        if options:
            payload["options"] = options
        if OLLAMA_REQUEST_KEEP_ALIVE:
            payload["keep_alive"] = OLLAMA_REQUEST_KEEP_ALIVE
        started_at = time.time()
        try:
            if OLLAMA_STREAM_ENABLED:
                with _ollama_http.post(
                    f"{resolved_base_url}/api/generate",
                    json=payload,
                    timeout=(connect_timeout, request_timeout),
                    stream=True,
                ) as response:
                    response.raise_for_status()
                    data: Dict[str, Any] = {}
                    chunks: List[str] = []
                    for raw_line in response.iter_lines(decode_unicode=True):
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                        except ValueError as exc:
                            logger.warning("Ollama invalid chunk JSON with model %s: %s", model, exc)
                            continue
                        if not isinstance(chunk, dict):
                            continue
                        chunk_text = chunk.get("response")
                        if isinstance(chunk_text, str) and chunk_text:
                            chunks.append(chunk_text)
                        data.update({k: v for k, v in chunk.items() if k != "response"})
                    if chunks:
                        data["response"] = "".join(chunks)
            else:
                with _ollama_http.post(
                    f"{resolved_base_url}/api/generate",
                    json=payload,
                    timeout=(connect_timeout, request_timeout),
                ) as response:
                    response.raise_for_status()
                    try:
                        loaded = response.json()
                    except ValueError as exc:
                        logger.warning("Ollama invalid JSON response with model %s: %s", model, exc)
                        loaded = {}
                    data = loaded if isinstance(loaded, dict) else {}
        except requests.HTTPError as exc:
            response = exc.response
            if response is not None and response.status_code == 404:
                detail = (response.text or "").strip()
                logger.warning(
                    "Ollama model missing for %s (404). Pull it first. Response: %s",
                    model,
                    detail[:240],
                )
                _mark_ollama_model_missing(model)
            else:
                logger.warning("Ollama request failed with model %s: %s", model, exc)
            continue
        except requests.RequestException as exc:
            logger.warning("Ollama request failed with model %s: %s", model, exc)
            continue
        if isinstance(data, dict):
            duration_ms = int((time.time() - started_at) * 1000)
            if duration_ms >= OLLAMA_SLOW_REQUEST_MS:
                logger.info(
                    "Ollama slow response model=%s duration_ms=%s prompt_chars=%s num_predict=%s",
                    model,
                    duration_ms,
                    len(prompt_text),
                    int(options.get("num_predict") or 0),
                )
            else:
                logger.debug("Ollama response model=%s duration_ms=%s", model, duration_ms)
            response_value = data.get("response")
            has_response = (
                (isinstance(response_value, str) and bool(response_value.strip()))
                or isinstance(response_value, dict)
            )
            if cache_key and has_response:
                _store_cached_ollama_response(cache_key, data, model)
            return data, model
        logger.warning("Ollama response malformed with model %s", model)
    return {}, ""


def _ollama_generate_text(
    prompt: str,
    *,
    model_candidates: Optional[List[str]] = None,
    timeout: Optional[int] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    use_cache: bool = True,
) -> str:
    candidates = model_candidates or _resolve_ollama_models(MODEL_PREF_INVOICE_SUMMARY)
    data, _ = _ollama_generate(
        prompt,
        model_candidates=candidates,
        timeout=timeout,
        temperature=temperature,
        max_tokens=max_tokens,
        use_cache=use_cache,
    )
    return (data.get("response") or "").strip()


def _extract_openai_compatible_response_text(payload: Dict[str, Any]) -> str:
    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        return ""
    first_choice = choices[0] if isinstance(choices[0], dict) else {}
    message = first_choice.get("message") if isinstance(first_choice, dict) else {}
    content = message.get("content") if isinstance(message, dict) else None
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: List[str] = []
        for entry in content:
            if isinstance(entry, str):
                parts.append(entry)
                continue
            if not isinstance(entry, dict):
                continue
            text_part = entry.get("text")
            if isinstance(text_part, str) and text_part.strip():
                parts.append(text_part)
                continue
            content_part = entry.get("content")
            if isinstance(content_part, str) and content_part.strip():
                parts.append(content_part)
        return "".join(parts).strip()
    text = first_choice.get("text") if isinstance(first_choice, dict) else None
    if isinstance(text, str):
        return text.strip()
    return ""


def _openai_compatible_generate(
    prompt: str,
    *,
    model_candidates: List[str],
    config: Dict[str, Any],
    timeout: Optional[int] = None,
    response_format: str = "",
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    use_cache: bool = True,
) -> Tuple[Dict[str, Any], str]:
    request_timeout = max(1, int(timeout or OLLAMA_TIMEOUT_SECONDS))
    connect_timeout = max(1, int(OLLAMA_CONNECT_TIMEOUT_SECONDS or 1))
    normalized_models = _merge_model_candidates(model_candidates)
    if not normalized_models:
        normalized_models = _configured_ai_models_for_picker(config)
    if not normalized_models:
        normalized_models = ["qwen3:8b"]
    prompt_text = str(prompt or "").strip()
    if not prompt_text:
        return {}, ""
    if len(prompt_text) > OLLAMA_PROMPT_MAX_CHARS:
        prompt_text = prompt_text[:OLLAMA_PROMPT_MAX_CHARS]
    resolved_base_url = str(config.get("base_url") or "").strip()
    request_url = _normalize_openai_compatible_url(resolved_base_url, "chat/completions")
    if not request_url:
        return {}, ""
    cache_key = (
        _ollama_cache_key(
            prompt=prompt_text,
            model_candidates=normalized_models,
            provider=AI_PROVIDER_OPENAI_COMPATIBLE,
            base_url=resolved_base_url,
            response_format=response_format,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if use_cache
        else ""
    )
    cached_response = _get_cached_ollama_response(cache_key) if cache_key else None
    if cached_response is not None:
        return cached_response
    resolved_max_tokens: Optional[int] = None
    if max_tokens is not None:
        try:
            resolved_max_tokens = max(1, min(int(max_tokens), OLLAMA_MAX_TOKENS_HARD_LIMIT))
        except (TypeError, ValueError):
            resolved_max_tokens = None
    headers = _build_openai_compatible_headers(str(config.get("api_key") or ""))
    for model in normalized_models:
        payload: Dict[str, Any] = {
            "model": model,
            "messages": [{"role": "user", "content": prompt_text}],
        }
        if temperature is not None:
            payload["temperature"] = float(temperature)
        if resolved_max_tokens is not None and resolved_max_tokens > 0:
            payload["max_tokens"] = int(resolved_max_tokens)
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}
        started_at = time.time()
        try:
            with _ollama_http.post(
                request_url,
                headers=headers,
                json=payload,
                timeout=(connect_timeout, request_timeout),
            ) as response:
                response.raise_for_status()
                loaded = response.json()
                data = loaded if isinstance(loaded, dict) else {}
        except requests.HTTPError as exc:
            logger.warning("OpenAI-compatible request failed with model %s: %s", model, exc)
            continue
        except (requests.RequestException, ValueError) as exc:
            logger.warning("OpenAI-compatible request failed with model %s: %s", model, exc)
            continue
        response_text = _extract_openai_compatible_response_text(data)
        normalized_payload = {
            "response": response_text,
            "usage": data.get("usage") if isinstance(data, dict) else {},
        }
        duration_ms = int((time.time() - started_at) * 1000)
        if duration_ms >= OLLAMA_SLOW_REQUEST_MS:
            logger.info(
                "OpenAI-compatible slow response model=%s duration_ms=%s prompt_chars=%s max_tokens=%s",
                model,
                duration_ms,
                len(prompt_text),
                int(resolved_max_tokens or 0),
            )
        if cache_key and response_text:
            _store_cached_ollama_response(cache_key, normalized_payload, model)
        if response_text:
            return normalized_payload, model
    return {}, ""


def _ai_generate(
    prompt: str,
    *,
    model_candidates: List[str],
    timeout: Optional[int] = None,
    response_format: str = "",
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    use_cache: bool = True,
    raw: bool = False,
    settings: Optional[IntegrationSettings] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], str, str]:
    resolved_config = config or _get_ai_config_snapshot(settings)
    provider = str(resolved_config.get("provider") or AI_PROVIDER_OLLAMA)
    if provider == AI_PROVIDER_OPENAI_COMPATIBLE:
        payload, model = _openai_compatible_generate(
            prompt,
            model_candidates=model_candidates,
            config=resolved_config,
            timeout=timeout,
            response_format=response_format,
            temperature=temperature,
            max_tokens=max_tokens,
            use_cache=use_cache,
        )
        return payload, model, provider
    payload, model = _ollama_generate(
        prompt,
        model_candidates=model_candidates,
        base_url=str(resolved_config.get("base_url") or OLLAMA_BASE_URL),
        timeout=timeout,
        response_format=response_format,
        temperature=temperature,
        max_tokens=max_tokens,
        use_cache=use_cache,
        raw=raw,
    )
    return payload, model, AI_PROVIDER_OLLAMA


def _ai_generate_text(
    prompt: str,
    *,
    model_candidates: Optional[List[str]] = None,
    timeout: Optional[int] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    use_cache: bool = True,
    settings: Optional[IntegrationSettings] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str, str]:
    resolved_config = config or _get_ai_config_snapshot(settings)
    candidates = model_candidates or _resolve_ai_models(
        MODEL_PREF_INVOICE_SUMMARY,
        purpose="invoice_summary",
        config=resolved_config,
    )
    data, model, provider = _ai_generate(
        prompt,
        model_candidates=candidates,
        timeout=timeout,
        temperature=temperature,
        max_tokens=max_tokens,
        use_cache=use_cache,
        config=resolved_config,
    )
    return str(data.get("response") or "").strip(), model, provider


def _offer_item_text(item: Dict[str, Any]) -> str:
    text = (item.get("aiDraft") or item.get("description") or "").strip()
    if text:
        return text
    versions = item.get("aiVersions") or []
    active_id = item.get("activeAiVersionId")
    if active_id:
        for version in versions:
            if version.get("id") == active_id:
                return (version.get("text") or "").strip()
    if versions:
        return (versions[0].get("text") or "").strip()
    return ""


def _offer_items_to_sevdesk_positions(offer_payload: Dict[str, Any], config: SevdeskConfig) -> List[Dict[str, Any]]:
    items = (offer_payload.get("lineItems") or []) + (offer_payload.get("deviceItems") or [])
    vat_mode = (offer_payload.get("vatMode") or "").strip()
    vat_rate = _parse_float(offer_payload.get("vatRate"), default=config.default_tax_rate)
    if vat_mode in ("reverse_charge", "intra_community"):
        vat_rate = 0.0
    positions = []
    for item in items:
        quantity = _parse_float(item.get("quantity"), default=0.0)
        if quantity <= 0:
            continue
        is_device = bool(item.get("manufacturer") or item.get("model") or item.get("product"))
        unity_id = config.unity_id
        if is_device and config.device_unity_id:
            unity_id = config.device_unity_id
        elif not is_device and config.service_unity_id:
            unity_id = config.service_unity_id
        name = (
            item.get("title")
            or item.get("product")
            or item.get("manufacturer")
            or item.get("model")
            or "Position"
        )
        positions.append(
            {
                "quantity": quantity,
                "price": _parse_float(item.get("price"), default=0.0),
                "name": name,
                "text": _offer_item_text(item),
                "tax_rate": vat_rate,
                "unity_id": unity_id,
            }
        )
    return positions


def _filter_offer_items(items: List[Dict[str, Any]], allowed_ids: Optional[set[str]]) -> List[Dict[str, Any]]:
    if allowed_ids is None:
        return items
    return [item for item in items if str(item.get("id") or "") in allowed_ids]


def _build_sevdesk_draft_header(
    client: SevdeskClient,
    config: SevdeskConfig,
    invoice_snapshot: Optional[Dict[str, Any]] = None,
    draft_snapshot: Optional[Dict[str, Any]] = None,
) -> str:
    invoice_number = client.extract_invoice_number(invoice_snapshot)
    if not invoice_number:
        invoice_number = client.extract_invoice_number(draft_snapshot)
    if not invoice_number:
        invoice_number = client.get_next_invoice_number(config.invoice_type)
    if not invoice_number:
        logger.warning("Sevdesk invoice number unavailable, falling back to generic header.")
        return "Rechnung"
    return f"Rechnung RE-Nr. {invoice_number}"


def _build_task_position_text(task: DayTask) -> str:
    title = (task.title or "").strip()
    details = (task.details or "").strip()
    if title and details:
        combined = f"{title}. {details}"
        return re.sub(r"\s+", " ", combined).strip()
    return title or details or ""


def _format_hours_for_prompt(value: float) -> str:
    rounded = round(float(value or 0.0), 2)
    text = f"{rounded:.2f}".rstrip("0").rstrip(".")
    return text.replace(".", ",")


def _normalize_estimated_hours(value: Any, fallback: float) -> float:
    parsed = _parse_float(value, default=fallback)
    if parsed <= 0:
        parsed = fallback
    parsed = min(24.0, max(0.25, parsed))
    return _round_up_to_quarter_hours(parsed)


def _fallback_task_scope_estimate(task: DayTask, analysis_text: str) -> Dict[str, Any]:
    text = f"{task.title or ''} {task.details or ''} {analysis_text or ''}".lower()
    text = text.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")

    quick_keywords = (
        "passwort",
        "mailbox",
        "drucker",
        "konto",
        "lizenz",
        "freigabe",
        "kleinanpassung",
        "rueckruf",
        "frage",
    )
    medium_keywords = (
        "update",
        "wartung",
        "analyse",
        "pruefung",
        "stoerung",
        "vpn",
        "backup",
        "office",
        "client",
        "arbeitsplatz",
    )
    large_keywords = (
        "server",
        "migration",
        "umzug",
        "netzwerk",
        "firewall",
        "installation",
        "einrichtung",
        "rollout",
        "inbetriebnahme",
        "projekt",
        "umstellung",
        "tenant",
        "m365",
        "exchange",
    )

    estimated_min = 0.5
    estimated_hours = 1.0
    estimated_max = 1.5
    confidence = "low"
    summary = "Aus der Aufgabenbeschreibung ergibt sich voraussichtlich ein kleiner bis mittlerer Serviceeinsatz."

    if any(keyword in text for keyword in large_keywords):
        estimated_min = 1.5
        estimated_hours = 2.5
        estimated_max = 4.0
        confidence = "medium"
        summary = "Die Beschreibung deutet auf eine groessere technische Leistung mit mehreren Arbeitsschritten hin."
    elif any(keyword in text for keyword in medium_keywords):
        estimated_min = 0.75
        estimated_hours = 1.5
        estimated_max = 2.5
        confidence = "medium"
        summary = "Die Beschreibung spricht fuer einen typischen Serviceeinsatz mit Analyse, Anpassung oder Nacharbeit."
    elif any(keyword in text for keyword in quick_keywords):
        estimated_min = 0.25
        estimated_hours = 0.5
        estimated_max = 1.0
        confidence = "medium"
        summary = "Die Beschreibung wirkt wie ein eher kurzer Servicefall mit begrenztem Umsetzungsumfang."

    if len(_normalize_space(analysis_text)) > 260 and estimated_max < 4.0:
        estimated_min = max(estimated_min, 1.0)
        estimated_hours = max(estimated_hours, 2.0)
        estimated_max = max(estimated_max, 3.0)
        confidence = "medium"

    return {
        "summary": summary,
        "estimated_min_hours": estimated_min,
        "estimated_hours": estimated_hours,
        "estimated_max_hours": estimated_max,
        "confidence": confidence,
    }


def _finalize_task_scope_estimate(
    fallback: Dict[str, Any],
    loaded: Optional[Dict[str, Any]],
    *,
    actual_hours: float,
    provider: str,
    model: str = "",
    analysis_text: str = "",
) -> Dict[str, Any]:
    loaded = loaded if isinstance(loaded, dict) else {}
    summary = _normalize_space(loaded.get("summary")) or fallback["summary"]
    if len(summary) > 280:
        summary = summary[:277].rstrip(" ,;:-") + "..."
    estimated_min = _normalize_estimated_hours(
        loaded.get("estimated_min_hours"),
        fallback["estimated_min_hours"],
    )
    estimated = _normalize_estimated_hours(
        loaded.get("estimated_hours"),
        fallback["estimated_hours"],
    )
    estimated_max = _normalize_estimated_hours(
        loaded.get("estimated_max_hours"),
        fallback["estimated_max_hours"],
    )
    ordered = sorted([estimated_min, estimated, estimated_max])
    estimated_min, estimated, estimated_max = ordered[0], ordered[1], ordered[2]

    confidence = str(loaded.get("confidence") or "").strip().lower()
    if confidence not in {"low", "medium", "high"}:
        confidence = str(fallback["confidence"]).strip().lower() or "low"

    actual_hours = round(max(0.0, float(actual_hours or 0.0)), 2)
    actual_rounded_hours = _round_up_to_quarter_hours(actual_hours) if actual_hours > 0 else 0.0
    delta_hours = round(actual_hours - estimated, 2)
    rounded_delta_hours = round(actual_rounded_hours - estimated, 2)

    comparison = "missing_actual"
    comparison_label = "Keine Zeit erfasst"
    if actual_hours > 0:
        if actual_hours < estimated_min - 0.01:
            comparison = "below"
            comparison_label = "Unter KI-Schaetzung"
        elif actual_hours > estimated_max + 0.01:
            comparison = "above"
            comparison_label = "Ueber KI-Schaetzung"
        else:
            comparison = "within"
            comparison_label = "Im erwarteten Rahmen"

    return {
        "summary": summary,
        "estimated_min_hours": estimated_min,
        "estimated_hours": estimated,
        "estimated_max_hours": estimated_max,
        "actual_hours": actual_hours,
        "actual_rounded_hours": actual_rounded_hours,
        "delta_hours": delta_hours,
        "rounded_delta_hours": rounded_delta_hours,
        "comparison": comparison,
        "comparison_label": comparison_label,
        "confidence": confidence,
        "provider": provider,
        "model": model or "",
        "analysis_text": analysis_text,
        "generated_at": int(time.time() * 1000),
    }


def _estimate_task_scope(task: DayTask, analysis_text: str, actual_hours: float) -> Dict[str, Any]:
    fallback = _fallback_task_scope_estimate(task, analysis_text)
    content_text = _normalize_space(analysis_text)[:3000]
    title_text = _normalize_space(task.title)
    details_text = _normalize_space(task.details)
    onsite_text = ""
    if task.arrival_time or task.departure_time:
        onsite_text = f"{task.arrival_time or '?'} bis {task.departure_time or '?'}"
    prompt = (
        "Du analysierst IT-Service-Aufgaben fuer die Fakturierung.\n"
        "Schaetze den fachlich plausiblen Arbeitsumfang nur anhand der beschriebenen Leistung. "
        "Nutze die bereits erfasste Zeit nicht als Schaetzgrundlage, sie dient nur dem spaeteren Vergleich.\n"
        "Antworte ausschliesslich als JSON mit den Feldern summary, estimated_min_hours, "
        "estimated_hours, estimated_max_hours, confidence.\n"
        "summary: 1-2 kurze Saetze auf Deutsch, sachlich, ohne Aufzaehlung.\n"
        "confidence: low, medium oder high.\n"
        "Alle Stundenwerte als Dezimalzahl in 0,25h-Schritten. Es muss gelten: "
        "estimated_min_hours <= estimated_hours <= estimated_max_hours.\n\n"
        f"Titel: {title_text or 'n/a'}\n"
        f"Details: {details_text or 'n/a'}\n"
        f"Faktura-/Positionstext: {content_text or 'n/a'}\n"
        f"Vor Ort Zeiten: {onsite_text or 'n/a'}\n"
        f"Erfasste Zeit nur zum Vergleich: {_format_hours_for_prompt(actual_hours)} h"
    )

    provider = "fallback"
    model = ""
    loaded: Dict[str, Any] = {}
    try:
        model_candidates = _resolve_ai_models(
            MODEL_PREF_TASK_DRAFT,
            MODEL_PREF_INVOICE_SUMMARY,
            purpose="task_draft",
        )
        payload, model, provider_name = _ai_generate(
            prompt,
            model_candidates=model_candidates,
            timeout=TASK_SCOPE_AI_TIMEOUT_SECONDS,
            response_format="json",
            temperature=0.15,
            max_tokens=160,
        )
        raw = payload.get("response") if isinstance(payload, dict) else None
        if isinstance(raw, dict):
            loaded = raw
        elif isinstance(raw, str):
            try:
                loaded = json.loads(raw)
            except json.JSONDecodeError:
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1 and end > start:
                    loaded = json.loads(raw[start : end + 1])
        if loaded:
            provider = provider_name
    except Exception as exc:
        logger.warning("Task scope estimate AI failed (%s): %s", model or "n/a", exc)
    return _finalize_task_scope_estimate(
        fallback,
        loaded,
        actual_hours=actual_hours,
        provider=provider,
        model=model,
        analysis_text=content_text or _build_task_position_text(task),
    )


def _sanitize_invoice_position_ai_text(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"^[\-\*\d\.\)\s]+", "", text, flags=re.MULTILINE)
    text = re.sub(r"\b(Aufgabe|Notiz|Betreff|Kunde|Leistung|Ergebnis)\s*:\s*", "", text, flags=re.IGNORECASE)
    text = text.replace("\r", "\n")
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return ""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    trimmed_sentences: List[str] = []
    for sentence in sentences:
        cleaned = sentence.strip(" -")
        if not cleaned:
            continue
        trimmed_sentences.append(cleaned)
        if len(trimmed_sentences) >= 2:
            break
    text = " ".join(trimmed_sentences) if trimmed_sentences else text
    if len(text) > 320:
        text = text[:317].rstrip(" ,;:-") + "..."
    if text and text[-1] not in ".!?":
        text += "."
    return text


def _parse_sevdesk_date(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        try:
            timestamp = float(value)
            if timestamp > 1_000_000_000_000:
                timestamp /= 1000
            return datetime.fromtimestamp(timestamp)
        except (TypeError, ValueError, OSError):
            return None
    text = str(value).strip()
    if not text:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(text, fmt)
            if parsed.tzinfo:
                return parsed.astimezone(timezone.utc).replace(tzinfo=None)
            return parsed
        except ValueError:
            continue
    return None


def _parse_sevdesk_amount(invoice: Dict[str, Any]) -> float:
    for key in (
        "sumGross",
        "sumNet",
        "sum",
        "total",
        "sumTotal",
        "sumBrutto",
        "sumNetto",
    ):
        if key in invoice:
            return _parse_float(invoice.get(key), default=0.0)
    return 0.0


def _extract_sevdesk_unity_id(row: Optional[Dict[str, Any]]) -> Optional[int]:
    if not isinstance(row, dict):
        return None
    unity = row.get("unity")
    if isinstance(unity, dict):
        value = _parse_int(unity.get("id"))
        if value:
            return value
    return _parse_int(row.get("unity_id"))


def _sevdesk_invoice_position_text(row: Optional[Dict[str, Any]]) -> str:
    if not isinstance(row, dict):
        return ""
    return _clean_invoice_position_text(
        f"{row.get('name') or ''} {row.get('text') or ''}"
    ).lower()


def _sevdesk_invoice_position_name(row: Optional[Dict[str, Any]]) -> str:
    if not isinstance(row, dict):
        return ""
    return _clean_invoice_position_text(row.get("name")).lower()


def _sevdesk_invoice_position_body(row: Optional[Dict[str, Any]]) -> str:
    if not isinstance(row, dict):
        return ""
    return _clean_invoice_position_text(row.get("text")).lower()


def _is_explicit_worktime_position_label(text: Any) -> bool:
    normalized = str(text or "").strip().lower()
    if not normalized:
        return False
    return bool(re.match(r"^arbeitszeit(?:\*|[\s:/._-]|$)", normalized))


def _is_travel_invoice_position(row: Optional[Dict[str, Any]]) -> bool:
    text = _sevdesk_invoice_position_text(row)
    if not text:
        return False
    travel_keywords = (
        "anfahrt",
        "fahrt",
        "fahrzeit",
        "kilometer",
        "km-pauschale",
        "reisekosten",
    )
    return any(keyword in text for keyword in travel_keywords)


def _is_worktime_invoice_position(
    row: Optional[Dict[str, Any]],
    *,
    config: Optional[SevdeskConfig] = None,
) -> bool:
    if not isinstance(row, dict):
        return False
    if _is_travel_invoice_position(row):
        return False
    name = _sevdesk_invoice_position_name(row)
    if _is_explicit_worktime_position_label(name):
        return True
    if name:
        return False
    body = _sevdesk_invoice_position_body(row)
    return _is_explicit_worktime_position_label(body)


def _is_service_invoice_position(
    row: Optional[Dict[str, Any]],
    *,
    config: Optional[SevdeskConfig] = None,
) -> bool:
    if _is_worktime_invoice_position(row, config=config):
        return True
    if _is_travel_invoice_position(row):
        return True
    text = _sevdesk_invoice_position_text(row)
    if not text:
        return False
    service_keywords = ("servicepauschale", "wartungspauschale", "monitoring", "managed service")
    return any(keyword in text for keyword in service_keywords)


def _is_material_invoice_position(
    row: Optional[Dict[str, Any]],
    *,
    config: Optional[SevdeskConfig] = None,
) -> bool:
    if not isinstance(row, dict):
        return False
    unity_id = _extract_sevdesk_unity_id(row)
    device_unity_id = getattr(config, "device_unity_id", None)
    if unity_id and device_unity_id and unity_id == device_unity_id:
        return True
    if _is_worktime_invoice_position(row, config=config) or _is_travel_invoice_position(row):
        return False
    text = _sevdesk_invoice_position_text(row)
    if not text:
        return False
    material_keywords = (
        "material",
        "hardware",
        "geraet",
        "gerät",
        "lizenz",
        "firewall",
        "switch",
        "access point",
        "notebook",
        "pc",
        "server",
        "ssd",
        "drucker",
        "router",
        "monitor",
        "client",
    )
    return any(keyword in text for keyword in material_keywords)


def _extract_sevdesk_contact(invoice: Dict[str, Any]) -> Tuple[str, str]:
    contact = invoice.get("contact")
    contact_id = ""
    contact_name = ""
    if isinstance(contact, dict):
        contact_id = str(contact.get("id") or "").strip()
        primary_name = str(
            contact.get("name")
            or contact.get("customerName")
            or contact.get("name2")
            or contact.get("firstName")
            or ""
        ).strip()
        if primary_name:
            contact_name = primary_name
        else:
            first = str(contact.get("firstName") or "").strip()
            family = str(contact.get("familyName") or contact.get("lastName") or "").strip()
            combined = " ".join(part for part in (first, family) if part).strip()
            contact_name = combined
    if not contact_name:
        contact_name = str(
            invoice.get("contactName")
            or invoice.get("customerName")
            or invoice.get("name")
            or ""
        ).strip()
    if not contact_name and contact_id:
        contact_name = f"Kontakt #{contact_id}"
    if not contact_name:
        contact_name = "Unbekannt"
    return contact_id or contact_name, contact_name


def _extract_sevdesk_customer_number(invoice: Dict[str, Any]) -> str:
    contact = invoice.get("contact")
    if isinstance(contact, dict):
        number = _extract_customer_number_from_contact(contact)
        if number:
            return number
    for key in ("customerNumber", "customer_number", "customernumber", "contactCustomerNumber"):
        value = str(invoice.get(key) or "").strip()
        if value:
            return value
    return ""


def _resolve_sevdesk_contact_name(client: SevdeskClient, contact_id: str) -> str:
    key = str(contact_id or "").strip()
    if not key:
        return ""
    now_ms = int(time.time() * 1000)
    cached = _sevdesk_contact_cache.get(key)
    if cached and (now_ms - int(cached[0])) < SEVDESK_CONTACT_CACHE_TTL_MS:
        return str(cached[1] or "")
    try:
        contact = client.get_contact(int(key))
    except (SevdeskError, ValueError):
        return ""
    if not contact:
        return ""
    contact_name = _format_contact_name(contact)
    if contact_name:
        _sevdesk_contact_cache[key] = (now_ms, contact_name)
    return contact_name


def _resolve_sevdesk_contact_names_batch(
    client: SevdeskClient,
    contact_ids: set[str],
    *,
    max_contacts_pages: int = 100,
) -> Dict[str, str]:
    result: Dict[str, str] = {}
    unresolved = {str(item).strip() for item in contact_ids if str(item).strip()}
    if not unresolved:
        return result

    now_ms = int(time.time() * 1000)
    for contact_id in list(unresolved):
        cached = _sevdesk_contact_cache.get(contact_id)
        if cached and (now_ms - int(cached[0])) < SEVDESK_CONTACT_CACHE_TTL_MS and cached[1]:
            result[contact_id] = str(cached[1])
            unresolved.discard(contact_id)

    if unresolved:
        try:
            contacts = client.list_contacts(max_pages=max_contacts_pages, limit=200)
        except SevdeskError:
            contacts = []
        for contact in contacts:
            contact_id = str(contact.get("id") or "").strip()
            if not contact_id or contact_id not in unresolved:
                continue
            contact_name = _format_contact_name(contact)
            if not contact_name:
                continue
            _sevdesk_contact_cache[contact_id] = (now_ms, contact_name)
            result[contact_id] = contact_name
            unresolved.discard(contact_id)
            if not unresolved:
                break

    # Fallback for remaining ids
    for contact_id in unresolved:
        contact_name = _resolve_sevdesk_contact_name(client, contact_id)
        if contact_name:
            result[contact_id] = contact_name
    return result


def _format_contact_name(contact: Dict[str, Any]) -> str:
    if not isinstance(contact, dict):
        return ""
    name = str(
        contact.get("name")
        or contact.get("customerName")
        or contact.get("name2")
        or ""
    ).strip()
    if name:
        return name
    first = str(contact.get("firstName") or contact.get("first_name") or "").strip()
    last = str(contact.get("familyName") or contact.get("lastName") or "").strip()
    combo = " ".join(part for part in (first, last) if part)
    return combo.strip()


def _invoice_is_due(invoice: Dict[str, Any], today: datetime) -> bool:
    status = _parse_int(invoice.get("status"))
    if status == 100:
        return False
    if status == 1000:
        return False
    if status == 400:
        return False
    due_date = _parse_sevdesk_date(
        invoice.get("dueDate")
        or invoice.get("paymentDeadline")
        or invoice.get("paymentDeadlineDate")
    )
    amount = _parse_sevdesk_amount(invoice)
    paid = _parse_float(invoice.get("sumPaid"), default=0.0)
    if amount > 0 and paid >= amount:
        return False
    if invoice.get("paidDate") or invoice.get("paid"):
        return False
    if status is not None and status not in (200, 300):
        return False
    if status == 200:
        return True
    if due_date and due_date.date() > today.date():
        return False
    return True


def _invoice_is_paid(invoice: Dict[str, Any]) -> bool:
    status = _parse_int(invoice.get("status"))
    if status in (100, 400):
        return False
    if status == 1000:
        return True
    amount = _parse_sevdesk_amount(invoice)
    paid = _parse_float(invoice.get("sumPaid"), default=0.0)
    if amount > 0 and paid >= amount:
        return True
    if invoice.get("paidDate") or invoice.get("paid"):
        return True
    if status == 300:
        return True
    return False


def _invoice_paid_amount(invoice: Dict[str, Any]) -> float:
    amount = _parse_sevdesk_amount(invoice)
    paid = _parse_float(invoice.get("sumPaid"), default=0.0)
    if paid > 0:
        if amount > 0:
            return min(paid, amount)
        return paid
    return amount


def _invoice_date_for_paid(invoice: Dict[str, Any]) -> Optional[datetime]:
    direct_paid_date = _parse_sevdesk_date(invoice.get("paidDate"))
    if direct_paid_date:
        return direct_paid_date

    def _history_marks_paid(entry: Dict[str, Any]) -> bool:
        marker_fields = [
            entry.get("field"),
            entry.get("key"),
            entry.get("name"),
            entry.get("attribute"),
            entry.get("event"),
            entry.get("type"),
            entry.get("action"),
            entry.get("description"),
            entry.get("message"),
            entry.get("label"),
        ]
        marker_text = " ".join(str(value or "").strip().lower() for value in marker_fields if value is not None)
        if marker_text and ("paid" in marker_text or "bezahlt" in marker_text):
            return True
        status_markers = {
            _parse_int(entry.get("status")),
            _parse_int(entry.get("newStatus")),
            _parse_int(entry.get("toStatus")),
            _parse_int(entry.get("statusAfter")),
            _parse_int(entry.get("newValue")),
            _parse_int(entry.get("to")),
        }
        return 1000 in status_markers

    def _extract_history_date(entry: Dict[str, Any]) -> Optional[datetime]:
        for key in (
            "date",
            "paidDate",
            "created",
            "createdAt",
            "timestamp",
            "time",
            "when",
            "changedAt",
            "updatedAt",
        ):
            parsed = _parse_sevdesk_date(entry.get(key))
            if parsed:
                return parsed
        return None

    candidates: List[datetime] = []
    for history_key in ("history", "statusHistory", "changeHistory", "invoiceHistory", "timeline", "logs"):
        history = invoice.get(history_key)
        if not isinstance(history, list):
            continue
        for entry in history:
            if not isinstance(entry, dict):
                continue
            if not _history_marks_paid(entry):
                continue
            paid_date = _extract_history_date(entry)
            if paid_date:
                candidates.append(paid_date)
    if candidates:
        return max(candidates)

    return _parse_sevdesk_date(invoice.get("invoiceDate"))


def _summarize_customer_payment_rows(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    revenue_total = 0.0
    revenue_current_year = 0.0
    revenue_last_year = 0.0
    open_overdue_invoices = 0
    open_overdue_amount = 0.0
    open_age_weighted_total = 0.0
    open_age_weighted_count = 0
    payment_days_total = 0.0
    payment_days_count = 0
    late_paid_invoices = 0
    reminders_total = 0
    for row in rows:
        revenue_total += _parse_float(row.get("totalAmountEur"), default=0.0)
        revenue_current_year += _parse_float(row.get("revenueCurrentYearEur"), default=0.0)
        revenue_last_year += _parse_float(row.get("revenueLastYearEur"), default=0.0)
        open_count = _parse_int(row.get("openOverdueInvoices"))
        if open_count is None:
            open_count = _parse_int(row.get("openInvoices")) or 0
        open_overdue_invoices += int(open_count or 0)
        open_overdue_amount += _parse_float(
            row.get("openOverdueAmountEur", row.get("openAmountEur")),
            default=0.0,
        )
        avg_open_age = row.get("avgOpenAgeDays")
        if avg_open_age is not None and open_count and open_count > 0:
            open_age_weighted_total += _parse_float(avg_open_age, default=0.0) * float(open_count)
            open_age_weighted_count += int(open_count)
        paid_count = _parse_int(row.get("paidInvoices")) or 0
        avg_payment_days = row.get("avgPaymentDays")
        if avg_payment_days is not None and paid_count > 0:
            payment_days_total += _parse_float(avg_payment_days, default=0.0) * float(paid_count)
            payment_days_count += int(paid_count)
        late_paid_invoices += int(_parse_int(row.get("latePaidInvoices")) or 0)
        reminders_total += int(_parse_int(row.get("remindersTotal")) or 0)

    return {
        "customers": len(rows),
        "revenueTotalEur": round(revenue_total, 2),
        "revenueCurrentYearEur": round(revenue_current_year, 2),
        "revenueLastYearEur": round(revenue_last_year, 2),
        "openOverdueInvoices": int(open_overdue_invoices),
        "openOverdueAmountEur": round(open_overdue_amount, 2),
        "avgOpenAgeDays": (
            round(open_age_weighted_total / open_age_weighted_count, 1)
            if open_age_weighted_count
            else None
        ),
        "avgPaymentDays": (
            round(payment_days_total / payment_days_count, 1)
            if payment_days_count
            else None
        ),
        "latePaidRatePct": (
            round((late_paid_invoices / payment_days_count) * 100, 1)
            if payment_days_count
            else None
        ),
        "remindersTotal": int(reminders_total),
    }


def _filter_inactive_customer_payment_rows(
    rows: List[Dict[str, Any]],
    inactive_name_keys: Set[str],
    active_name_keys: Set[str],
    inactive_number_keys: Set[str],
    active_number_keys: Set[str],
) -> List[Dict[str, Any]]:
    if not rows:
        return []
    filtered: List[Dict[str, Any]] = []
    for row in rows:
        row_name_key = _dev_normalize_text(row.get("name"))
        row_number_key = _normalize_customer_number(row.get("customerNumber") or row.get("customer_number"))
        matched_inactive = False
        if row_number_key and row_number_key in inactive_number_keys and row_number_key not in active_number_keys:
            matched_inactive = True
        if row_name_key and row_name_key in inactive_name_keys and row_name_key not in active_name_keys:
            matched_inactive = True
        if matched_inactive:
            continue
        filtered.append(row)
    return filtered


def _filter_inactive_recurring_tag_customer_rows(
    rows: List[Dict[str, Any]],
    inactive_name_keys: Set[str],
    active_name_keys: Set[str],
    inactive_number_keys: Set[str],
    active_number_keys: Set[str],
) -> List[Dict[str, Any]]:
    filtered: List[Dict[str, Any]] = []
    for row in rows:
        row_name_key = _dev_normalize_text(row.get("customerName"))
        row_number_key = _normalize_customer_number(row.get("customerNumber"))
        matched_inactive = False
        if row_number_key and row_number_key in inactive_number_keys and row_number_key not in active_number_keys:
            matched_inactive = True
        if row_name_key and row_name_key in inactive_name_keys and row_name_key not in active_name_keys:
            matched_inactive = True
        if matched_inactive:
            continue
        filtered.append(row)
    return filtered


def _invoice_reminder_count(invoice: Dict[str, Any]) -> int:
    for key in ("reminderCount", "dunningLevel", "dunning_level", "reminderLevel", "dunningLevelNumber"):
        value = _parse_int(invoice.get(key))
        if value and value > 0:
            return value
    reminders = invoice.get("reminders")
    if isinstance(reminders, list) and reminders:
        return len(reminders)
    if bool(invoice.get("isReminder") or invoice.get("isDunned") or invoice.get("dunned")):
        return 1
    return 0


def _top_customers_for_period(
    invoices: List[Dict[str, Any]],
    start_dt: datetime,
    end_dt: datetime,
) -> List[Dict[str, Any]]:
    totals: Dict[str, Dict[str, Any]] = {}
    for invoice in invoices:
        status = _parse_int(invoice.get("status"))
        if status == 100:
            continue
        invoice_date = _parse_sevdesk_date(invoice.get("invoiceDate"))
        if not invoice_date:
            continue
        if invoice_date < start_dt or invoice_date > end_dt:
            continue
        amount = _parse_sevdesk_amount(invoice)
        if amount <= 0:
            continue
        key, name = _extract_sevdesk_contact(invoice)
        entry = totals.get(key)
        if not entry:
            entry = {"name": name, "total": 0.0, "count": 0, "contactId": key}
        entry["total"] += amount
        entry["count"] += 1
        if name and entry.get("name") in ("", "Unbekannt"):
            entry["name"] = name
        totals[key] = entry
    ranked = sorted(totals.values(), key=lambda item: item["total"], reverse=True)[:5]
    return [
        {
            "name": item["name"],
            "totalEur": round(item["total"], 2),
            "count": item["count"],
            "contactId": item.get("contactId", "")
        }
        for item in ranked
    ]


def _build_customer_payment_stats(
    invoices: List[Dict[str, Any]],
    now_dt: datetime,
) -> Dict[str, Any]:
    start_current_year = datetime(now_dt.year, 1, 1)
    start_last_year = datetime(now_dt.year - 1, 1, 1)
    end_last_year = datetime(now_dt.year - 1, 12, 31, 23, 59, 59)
    stats: Dict[str, Dict[str, Any]] = {}
    for invoice in invoices:
        status = _parse_int(invoice.get("status"))
        if status in (100, 400):
            continue
        amount = _parse_sevdesk_amount(invoice)
        if amount <= 0:
            continue
        invoice_date = _parse_sevdesk_date(invoice.get("invoiceDate"))
        if not invoice_date:
            continue
        contact_id, contact_name = _extract_sevdesk_contact(invoice)
        customer_number = _extract_sevdesk_customer_number(invoice)
        entry = stats.get(contact_id)
        if not entry:
            entry = {
                "name": contact_name,
                "contactId": contact_id,
                "customerNumber": customer_number,
                "totalInvoices": 0,
                "paidInvoices": 0,
                "openInvoices": 0,
                "overdueInvoices": 0,
                "totalAmount": 0.0,
                "revenueCurrentYear": 0.0,
                "revenueLastYear": 0.0,
                "openAmount": 0.0,
                "paidAmount": 0.0,
                "paymentDaysTotal": 0,
                "paymentDaysCount": 0,
                "latePaidInvoices": 0,
                "veryLatePaidInvoices": 0,
                "openAgeDaysTotal": 0,
                "openAgeDaysCount": 0,
                "maxPaymentDays": 0,
                "remindersTotal": 0,
                "earliestInvoiceDate": None,
                "latestInvoiceDate": None,
            }
        if customer_number and not str(entry.get("customerNumber") or "").strip():
            entry["customerNumber"] = customer_number
        entry["totalInvoices"] += 1
        entry["totalAmount"] += amount
        reminder_count = _invoice_reminder_count(invoice)
        entry["remindersTotal"] += reminder_count
        if entry["earliestInvoiceDate"] is None or invoice_date < entry["earliestInvoiceDate"]:
            entry["earliestInvoiceDate"] = invoice_date
        if entry["latestInvoiceDate"] is None or invoice_date > entry["latestInvoiceDate"]:
            entry["latestInvoiceDate"] = invoice_date
        if invoice_date >= start_current_year and invoice_date <= now_dt:
            entry["revenueCurrentYear"] += amount
        elif invoice_date >= start_last_year and invoice_date <= end_last_year:
            entry["revenueLastYear"] += amount
        paid_date = _invoice_date_for_paid(invoice)
        if _invoice_is_paid(invoice) and paid_date:
            paid_days = max(0, (paid_date.date() - invoice_date.date()).days)
            entry["paidInvoices"] += 1
            entry["paidAmount"] += _invoice_paid_amount(invoice)
            entry["paymentDaysTotal"] += paid_days
            entry["paymentDaysCount"] += 1
            entry["maxPaymentDays"] = max(entry["maxPaymentDays"], paid_days)
            if paid_days > 14:
                entry["latePaidInvoices"] += 1
            if paid_days > 30:
                entry["veryLatePaidInvoices"] += 1
        else:
            entry["openInvoices"] += 1
            entry["openAmount"] += amount
            age_days = max(0, (now_dt.date() - invoice_date.date()).days)
            entry["openAgeDaysTotal"] += age_days
            entry["openAgeDaysCount"] += 1
            due_date = _parse_sevdesk_date(
                invoice.get("dueDate")
                or invoice.get("paymentDeadline")
                or invoice.get("paymentDeadlineDate")
            )
            is_overdue = False
            if due_date:
                is_overdue = due_date.date() < now_dt.date()
            else:
                is_overdue = status == 300 or age_days > 30
            if is_overdue:
                entry["overdueInvoices"] += 1
        stats[contact_id] = entry

    overall_open_age_total = 0
    overall_open_age_count = 0
    overall_outstanding_amount = 0.0
    overall_outstanding_invoices = 0
    overall_revenue_total = 0.0
    overall_revenue_current_year = 0.0
    overall_revenue_last_year = 0.0
    overall_payment_days_total = 0
    overall_payment_days_count = 0
    overall_late_paid_invoices = 0
    overall_paid_invoices = 0
    overall_reminders_total = 0

    rows: List[Dict[str, Any]] = []
    for item in stats.values():
        revenue_total = round(item["totalAmount"], 2)
        revenue_current_year = round(item["revenueCurrentYear"], 2)
        revenue_last_year = round(item["revenueLastYear"], 2)
        avg_payment_days = (
            round(item["paymentDaysTotal"] / item["paymentDaysCount"], 1)
            if item["paymentDaysCount"]
            else None
        )
        late_paid_rate_pct = (
            round((item["latePaidInvoices"] / item["paymentDaysCount"]) * 100, 1)
            if item["paymentDaysCount"]
            else None
        )
        avg_open_age_days = (
            round(item["openAgeDaysTotal"] / item["openAgeDaysCount"], 1)
            if item["openAgeDaysCount"]
            else None
        )
        if item["overdueInvoices"] > 0:
            grade = "C"
        elif (avg_payment_days or 0) > 30 or (avg_open_age_days or 0) > 45:
            grade = "C"
        elif (avg_payment_days or 0) > 10 or item["openInvoices"] > 0:
            grade = "B"
        else:
            grade = "A"
        outstanding_ratio = (item["openAmount"] / item["totalAmount"]) if item["totalAmount"] else 0.0
        business_weight = (
            item["revenueCurrentYear"] * 0.6
            + item["revenueLastYear"] * 0.3
            + item["totalAmount"] * 0.1
            - item["openAmount"] * 0.2
            - item["overdueInvoices"] * 750.0
            - outstanding_ratio * 1000.0
        )
        outstanding_invoices = item["openInvoices"]
        overdue_invoices = item["overdueInvoices"]
        open_overdue_invoices = outstanding_invoices
        open_overdue_amount = round(item["openAmount"], 2)

        overall_open_age_total += item["openAgeDaysTotal"]
        overall_open_age_count += item["openAgeDaysCount"]
        overall_outstanding_amount += item["openAmount"]
        overall_outstanding_invoices += outstanding_invoices
        overall_revenue_total += item["totalAmount"]
        overall_revenue_current_year += item["revenueCurrentYear"]
        overall_revenue_last_year += item["revenueLastYear"]
        overall_payment_days_total += item["paymentDaysTotal"]
        overall_payment_days_count += item["paymentDaysCount"]
        overall_late_paid_invoices += item["latePaidInvoices"]
        overall_paid_invoices += item["paymentDaysCount"]
        overall_reminders_total += item["remindersTotal"]

        rows.append(
            {
                "name": item["name"],
                "contactId": item.get("contactId", ""),
                "customerNumber": str(item.get("customerNumber") or "").strip(),
                "grade": grade,
                "totalInvoices": item["totalInvoices"],
                "paidInvoices": item["paidInvoices"],
                "openInvoices": outstanding_invoices,
                "overdueInvoices": overdue_invoices,
                "openOverdueInvoices": open_overdue_invoices,
                "openOverdueAmountEur": open_overdue_amount,
                "totalAmountEur": revenue_total,
                "revenueCurrentYearEur": revenue_current_year,
                "revenueLastYearEur": revenue_last_year,
                "paidAmountEur": round(item["paidAmount"], 2),
                "openAmountEur": round(item["openAmount"], 2),
                "avgPaymentDays": avg_payment_days,
                "latePaidRatePct": late_paid_rate_pct,
                "latePaidInvoices": item["latePaidInvoices"],
                "veryLatePaidInvoices": item["veryLatePaidInvoices"],
                "avgOpenAgeDays": avg_open_age_days,
                "maxPaymentDays": item["maxPaymentDays"],
                "remindersTotal": int(item["remindersTotal"] or 0),
                "historyFrom": item["earliestInvoiceDate"].strftime("%Y-%m-%d")
                if item.get("earliestInvoiceDate")
                else "",
                "historyTo": item["latestInvoiceDate"].strftime("%Y-%m-%d")
                if item.get("latestInvoiceDate")
                else "",
                "businessWeight": round(business_weight, 2),
            }
        )
    grade_order = {"A": 0, "B": 1, "C": 2}
    rows.sort(
        key=lambda row: (
            grade_order.get(str(row.get("grade") or ""), 9),
            -(row.get("businessWeight") or 0),
            str(row.get("name") or "").lower(),
        )
    )

    avg_open_age_all = (
        round(overall_open_age_total / overall_open_age_count, 1)
        if overall_open_age_count
        else None
    )
    avg_payment_days_all = (
        round(overall_payment_days_total / overall_payment_days_count, 1)
        if overall_payment_days_count
        else None
    )
    late_paid_rate_all = (
        round((overall_late_paid_invoices / overall_paid_invoices) * 100, 1)
        if overall_paid_invoices
        else None
    )
    summary = _summarize_customer_payment_rows(rows)
    return {"rows": rows, "summary": summary}


def _parse_recurring_invoice_months(value: Any) -> float:
    raw = str(value or "").strip().upper()
    if not raw:
        return 1.0
    if raw == "P1M":
        return 1.0
    match = re.fullmatch(
        r"P(?:(?P<years>\d+)Y)?(?:(?P<months>\d+)M)?(?:(?P<weeks>\d+)W)?(?:(?P<days>\d+)D)?",
        raw,
    )
    if not match:
        return 1.0
    years = _safe_nonnegative_float(match.group("years"))
    months = _safe_nonnegative_float(match.group("months"))
    weeks = _safe_nonnegative_float(match.group("weeks"))
    days = _safe_nonnegative_float(match.group("days"))
    total_months = years * 12.0 + months + weeks * (7.0 / 30.4375) + days / 30.4375
    if total_months <= 0:
        return 1.0
    return round(total_months, 4)


def _build_sevdesk_recurring_tag_overview(
    client: SevdeskClient,
    invoices: List[Dict[str, Any]],
) -> Dict[str, Any]:
    recurring_invoices = []
    for invoice in invoices:
        invoice_type = str(invoice.get("invoiceType") or "").strip().upper()
        status = _parse_int(invoice.get("status"))
        if invoice_type != "WKR" or status == 50:
            continue
        invoice_id = _parse_int(invoice.get("id"))
        if invoice_id <= 0:
            continue
        recurring_invoices.append(invoice)
    if not recurring_invoices:
        return {
            "monthlyTotalEur": 0.0,
            "customersCount": 0,
            "invoiceCount": 0,
            "tagCount": 0,
            "tagTotals": [],
            "customerRows": [],
        }

    invoice_ids = {int(_parse_int(invoice.get("id"))) for invoice in recurring_invoices if _parse_int(invoice.get("id")) > 0}
    tag_relations = client.list_tag_relations(max_pages=40)
    invoice_tag_ids: Dict[int, List[str]] = {}
    tag_ids: Set[str] = set()
    for relation in tag_relations:
        if not isinstance(relation, dict):
            continue
        obj = relation.get("object")
        tag_ref = relation.get("tag")
        if not isinstance(obj, dict) or not isinstance(tag_ref, dict):
            continue
        if str(obj.get("objectName") or "").strip() != "Invoice":
            continue
        invoice_id = _parse_int(obj.get("id"))
        if invoice_id <= 0 or invoice_id not in invoice_ids:
            continue
        tag_id = str(tag_ref.get("id") or "").strip()
        if not tag_id:
            continue
        invoice_tag_ids.setdefault(invoice_id, []).append(tag_id)
        tag_ids.add(tag_id)

    tag_name_by_id: Dict[str, str] = {}
    if tag_ids:
        for tag in client.list_tags(max_pages=20):
            tag_id = str(tag.get("id") or "").strip()
            if not tag_id or tag_id not in tag_ids:
                continue
            tag_name = str(tag.get("name") or "").strip() or f"Tag #{tag_id}"
            tag_name_by_id[tag_id] = tag_name

    overview = {
        "monthlyTotalEur": 0.0,
        "customersCount": 0,
        "invoiceCount": 0,
        "tagCount": 0,
        "tagTotals": [],
        "customerRows": [],
    }
    tag_totals: Dict[str, Dict[str, Any]] = {}
    customer_rows: Dict[str, Dict[str, Any]] = {}

    for invoice in recurring_invoices:
        invoice_id = _parse_int(invoice.get("id"))
        if invoice_id <= 0:
            continue
        gross_value = round(_parse_sevdesk_amount(invoice), 2)
        if gross_value <= 0:
            continue
        months = _parse_recurring_invoice_months(invoice.get("accountIntervall"))
        monthly_value = round(gross_value / months, 2) if months > 0 else gross_value
        if monthly_value <= 0:
            continue
        tag_ids_for_invoice = list(dict.fromkeys(invoice_tag_ids.get(invoice_id) or []))
        tag_keys = tag_ids_for_invoice or ["untagged"]
        allocation_count = max(1, len(tag_keys))
        allocated_value = round(monthly_value / allocation_count, 2)

        contact_id, contact_name = _extract_sevdesk_contact(invoice)
        customer_number = _extract_sevdesk_customer_number(invoice)
        customer_key = contact_id or f"invoice:{invoice_id}"
        customer_entry = customer_rows.get(customer_key)
        if not customer_entry:
            customer_entry = {
                "contactId": contact_id,
                "customerName": contact_name or f"Kontakt #{contact_id or invoice_id}",
                "customerNumber": customer_number,
                "monthlyTotalEur": 0.0,
                "invoiceCount": 0,
                "tags": {},
                "invoices": [],
            }
        customer_entry["monthlyTotalEur"] = round(customer_entry["monthlyTotalEur"] + monthly_value, 2)
        customer_entry["invoiceCount"] += 1
        customer_entry["invoices"].append(
            {
                "invoiceId": invoice_id,
                "invoiceNumber": str(
                    invoice.get("invoiceNumber")
                    or invoice.get("invoiceNumberDefault")
                    or invoice.get("name")
                    or f"WKR #{invoice_id}"
                ).strip(),
                "grossEur": gross_value,
                "monthlyEur": monthly_value,
                "interval": str(invoice.get("accountIntervall") or "").strip(),
                "nextInvoiceAt": str(invoice.get("accountNextInvoice") or "").strip(),
                "tags": [
                    tag_name_by_id.get(tag_id, f"Tag #{tag_id}") for tag_id in tag_ids_for_invoice
                ] or ["Ohne Tag"],
            }
        )
        customer_rows[customer_key] = customer_entry

        for index, tag_key in enumerate(tag_keys):
            tag_name = "Ohne Tag" if tag_key == "untagged" else tag_name_by_id.get(tag_key, f"Tag #{tag_key}")
            value_piece = allocated_value
            if index == allocation_count - 1:
                distributed_before = round(allocated_value * (allocation_count - 1), 2)
                value_piece = round(monthly_value - distributed_before, 2)
            tag_entry = tag_totals.get(tag_key)
            if not tag_entry:
                tag_entry = {
                    "tagId": "" if tag_key == "untagged" else tag_key,
                    "tagName": tag_name,
                    "monthlyEur": 0.0,
                    "invoiceCount": 0,
                    "customerIds": set(),
                }
            tag_entry["monthlyEur"] = round(tag_entry["monthlyEur"] + value_piece, 2)
            tag_entry["invoiceCount"] += 1
            tag_entry["customerIds"].add(customer_key)
            tag_totals[tag_key] = tag_entry

            customer_tag_entry = customer_entry["tags"].get(tag_key)
            if not customer_tag_entry:
                customer_tag_entry = {
                    "tagId": "" if tag_key == "untagged" else tag_key,
                    "tagName": tag_name,
                    "monthlyEur": 0.0,
                    "invoiceCount": 0,
                }
            customer_tag_entry["monthlyEur"] = round(customer_tag_entry["monthlyEur"] + value_piece, 2)
            customer_tag_entry["invoiceCount"] += 1
            customer_entry["tags"][tag_key] = customer_tag_entry

        overview["monthlyTotalEur"] = round(overview["monthlyTotalEur"] + monthly_value, 2)
        overview["invoiceCount"] += 1

    overview["customersCount"] = len(customer_rows)
    overview["tagCount"] = len(tag_totals)
    overview["tagTotals"] = sorted(
        [
            {
                "tagId": value["tagId"],
                "tagName": value["tagName"],
                "monthlyEur": round(value["monthlyEur"], 2),
                "invoiceCount": int(value["invoiceCount"] or 0),
                "customersCount": len(value["customerIds"]),
            }
            for value in tag_totals.values()
        ],
        key=lambda item: (-float(item.get("monthlyEur") or 0.0), str(item.get("tagName") or "").lower()),
    )
    overview["customerRows"] = sorted(
        [
            {
                "contactId": row["contactId"],
                "customerName": row["customerName"],
                "customerNumber": row["customerNumber"],
                "monthlyTotalEur": round(row["monthlyTotalEur"], 2),
                "invoiceCount": int(row["invoiceCount"] or 0),
                "tags": sorted(
                    row["tags"].values(),
                    key=lambda item: (-float(item.get("monthlyEur") or 0.0), str(item.get("tagName") or "").lower()),
                ),
                "invoices": row["invoices"],
            }
            for row in customer_rows.values()
        ],
        key=lambda item: (-float(item.get("monthlyTotalEur") or 0.0), str(item.get("customerName") or "").lower()),
    )
    return overview


def _build_sevdesk_stats(
    client: SevdeskClient,
    now_dt: datetime,
    *,
    include_financial_overview: bool = True,
    invoices_max_pages: int = 30,
    resolve_contacts_limit: Optional[int] = None,
) -> Dict[str, Any]:
    drafts: List[Dict[str, Any]] = []
    draft_sum = 0.0
    due_invoices: List[Dict[str, Any]] = []
    due_sum = 0.0
    paid_invoices: List[Dict[str, Any]] = []
    paid_sum_total = 0.0
    paid_current_year: List[Dict[str, Any]] = []
    paid_current_month: List[Dict[str, Any]] = []
    paid_year_sum = 0.0
    paid_month_sum = 0.0
    overdue_invoices: List[Dict[str, Any]] = []
    overdue_sum = 0.0
    paid_avg = 0.0
    recurring_tag_overview: Dict[str, Any] = {
        "monthlyTotalEur": 0.0,
        "customersCount": 0,
        "invoiceCount": 0,
        "tagCount": 0,
        "tagTotals": [],
        "customerRows": [],
    }

    if include_financial_overview:
        drafts = client.list_invoices(params={"status": 100}, max_pages=10)
        draft_sum = round(sum(_parse_sevdesk_amount(item) for item in drafts), 2)

        due_candidates: List[Dict[str, Any]] = []
        for status in (200, 300):
            due_candidates.extend(client.list_invoices(params={"status": status}, max_pages=10))
        seen_due: set[str] = set()
        for item in due_candidates:
            invoice_id = str(item.get("id") or "")
            if invoice_id in seen_due:
                continue
            seen_due.add(invoice_id)
            if _invoice_is_due(item, now_dt):
                due_invoices.append(item)
        due_sum = round(sum(_parse_sevdesk_amount(item) for item in due_invoices), 2)

    all_invoices = client.list_invoices(max_pages=max(1, invoices_max_pages))
    recurring_invoices = client.list_recurring_invoices(max_pages=max(1, invoices_max_pages))
    start_month = datetime(now_dt.year, now_dt.month, 1)
    start_half_year = now_dt - timedelta(days=182)
    start_current_year = datetime(now_dt.year, 1, 1)
    start_last_year = datetime(now_dt.year - 1, 1, 1)
    end_last_year = datetime(now_dt.year - 1, 12, 31, 23, 59, 59)
    if include_financial_overview:
        paid_invoices = [item for item in all_invoices if _invoice_is_paid(item)]
        paid_sum_total = round(sum(_invoice_paid_amount(item) for item in paid_invoices), 2)
        for item in paid_invoices:
            paid_date = _invoice_date_for_paid(item)
            if not paid_date:
                continue
            if paid_date >= start_current_year and paid_date <= now_dt:
                paid_current_year.append(item)
            if paid_date >= start_month and paid_date <= now_dt:
                paid_current_month.append(item)
        paid_year_sum = round(sum(_invoice_paid_amount(item) for item in paid_current_year), 2)
        paid_month_sum = round(sum(_invoice_paid_amount(item) for item in paid_current_month), 2)
        for item in all_invoices:
            if _invoice_is_paid(item):
                continue
            status = _parse_int(item.get("status"))
            if status == 100 or status == 400:
                continue
            due_date = _parse_sevdesk_date(
                item.get("dueDate")
                or item.get("paymentDeadline")
                or item.get("paymentDeadlineDate")
            )
            if status == 300 and due_date is None:
                overdue_invoices.append(item)
                continue
            if due_date and due_date.date() < now_dt.date():
                overdue_invoices.append(item)
        overdue_sum = round(sum(_parse_sevdesk_amount(item) for item in overdue_invoices), 2)
        paid_avg = round(paid_sum_total / len(paid_invoices), 2) if paid_invoices else 0.0

    top_customers = {
        "thisMonth": _top_customers_for_period(all_invoices, start_month, now_dt),
        "halfYear": _top_customers_for_period(all_invoices, start_half_year, now_dt),
        "currentYear": _top_customers_for_period(all_invoices, start_current_year, now_dt),
        "lastYear": _top_customers_for_period(all_invoices, start_last_year, end_last_year),
    }
    customer_payment_data = _build_customer_payment_stats(all_invoices, now_dt)
    customer_payment_stats = customer_payment_data.get("rows") or []
    customer_payment_summary = customer_payment_data.get("summary") or {}
    recurring_tag_overview = _build_sevdesk_recurring_tag_overview(client, recurring_invoices)
    recurring_customer_rows = recurring_tag_overview.get("customerRows") or []

    contact_ids: set[str] = set()
    for bucket in top_customers.values():
        for item in bucket:
            contact_id = str(item.get("contactId") or "").strip()
            if contact_id and (item.get("name") or "").startswith("Kontakt #"):
                contact_ids.add(contact_id)
    customer_rows_for_resolution = (
        customer_payment_stats
        if resolve_contacts_limit is None
        else customer_payment_stats[: max(0, int(resolve_contacts_limit))]
    )
    for item in customer_rows_for_resolution:
        contact_id = str(item.get("contactId") or "").strip()
        if contact_id and (item.get("name") or "").startswith("Kontakt #"):
            contact_ids.add(contact_id)
    for item in recurring_customer_rows:
        contact_id = str(item.get("contactId") or "").strip()
        if contact_id and (item.get("customerName") or "").startswith("Kontakt #"):
            contact_ids.add(contact_id)
    if contact_ids:
        names_map = _resolve_sevdesk_contact_names_batch(client, contact_ids)
        for contact_id, contact_name in names_map.items():
            for bucket in top_customers.values():
                for item in bucket:
                    if str(item.get("contactId") or "") == contact_id:
                        item["name"] = contact_name
            for item in customer_payment_stats:
                if str(item.get("contactId") or "") == contact_id:
                    item["name"] = contact_name
            for item in recurring_customer_rows:
                if str(item.get("contactId") or "") == contact_id:
                    item["customerName"] = contact_name

    return {
        "connected": True,
        "drafts": {"count": len(drafts), "sumEur": draft_sum},
        "due": {"count": len(due_invoices), "sumEur": due_sum},
        "paid": {"count": len(paid_invoices), "sumEur": paid_sum_total},
        "paidCurrentYear": {"count": len(paid_current_year), "sumEur": paid_year_sum},
        "paidCurrentMonth": {"count": len(paid_current_month), "sumEur": paid_month_sum},
        "paidAverage": {"sumEur": paid_avg},
        "overdue": {"count": len(overdue_invoices), "sumEur": overdue_sum},
        "topCustomers": top_customers,
        "customerPaymentStats": customer_payment_stats,
        "customerPaymentSummary": customer_payment_summary,
        "recurringTagOverview": recurring_tag_overview,
    }


def _summarize_tasks_for_invoice(tasks: List[DayTask]) -> str:
    lines = []
    for task in tasks:
        details = (task.details or "").strip()
        if details:
            lines.append(f"- {task.title}: {details}")
        else:
            lines.append(f"- {task.title}")
    prompt = (
        "Fasse die folgenden erledigten Aufgaben zu einer kompakten Rechnungsposition zusammen. "
        "Schreibe auf Deutsch, sachlich und kundenfreundlich. "
        "Kein Markdown, keine Aufzaehlungszeichen, maximal 3 Saetze.\n\n"
        f"{chr(10).join(lines)}"
    )
    summary, _, _ = _ai_generate_text(prompt, max_tokens=180)
    if summary:
        return summary
    return " ".join(line.lstrip("- ").strip() for line in lines)


def serialize_day_task_group(g: DayTaskGroup) -> Dict[str, Any]:
    return {
        "id": g.id,
        "title": g.title,
        "column": g.column,
        "position": g.position,
        "pinned": g.pinned,
        "created_at": g.created_at,
    }


def _normalize_contract_flags(flags: Optional[List[Any]]) -> List[str]:
    if not isinstance(flags, list):
        return []
    allowed = {"monitoring", "wartung", "regie"}
    normalized: List[str] = []
    seen = set()
    for value in flags:
        key = re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())
        if key in {"maintenance", "wartungsvertrag"}:
            key = "wartung"
        if key in {"monitoringvertrag", "rmm"}:
            key = "monitoring"
        if key in {"regiekunde", "regiekundestatus", "nachaufwand", "timeandmaterial", "payg"}:
            key = "regie"
        if key in {"servicelevelagreement", "sla"}:
            key = "wartung"
        if key not in allowed or key in seen:
            continue
        seen.add(key)
        normalized.append(key)
    # "Regie" and "Wartung" are mutually exclusive.
    # "Monitoring" may exist together with "Regie".
    if "regie" in seen and "wartung" in seen:
        normalized = [entry for entry in normalized if entry != "regie"]
    return normalized


def _parse_contract_flags(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return _normalize_contract_flags(parsed if isinstance(parsed, list) else [])


def _normalize_contract_document_flags(flags: Optional[List[Any]]) -> List[str]:
    if not isinstance(flags, list):
        return []
    normalized: List[str] = []
    seen = set()
    for value in flags:
        key = _normalize_contract_doc_type(value, default="")
        if key not in {"wartung", "monitoring"} or key in seen:
            continue
        seen.add(key)
        normalized.append(key)
    return normalized


def _normalize_contract_type_counts(raw_counts: Optional[Dict[Any, Any]]) -> Dict[str, int]:
    if not isinstance(raw_counts, dict):
        return {}
    aggregated: Dict[str, int] = {}
    for raw_key, raw_value in raw_counts.items():
        key = _normalize_contract_doc_type(raw_key, default="")
        if not key:
            continue
        try:
            amount = int(raw_value)
        except (TypeError, ValueError):
            continue
        if amount <= 0:
            continue
        aggregated[key] = int(aggregated.get(key, 0)) + amount
    ordered: Dict[str, int] = {}
    for key in ["wartung", "monitoring", "avv_dsgvo"]:
        if key in aggregated:
            ordered[key] = aggregated[key]
    for key in sorted([entry for entry in aggregated.keys() if entry not in {"wartung", "monitoring", "avv_dsgvo"}]):
        ordered[key] = aggregated[key]
    return ordered


def _load_contract_document_meta_for_customers(
    db,
    customer_ids: List[int],
) -> Tuple[Dict[int, List[str]], Dict[int, Dict[str, int]]]:
    unique_ids = sorted({int(customer_id) for customer_id in customer_ids if customer_id is not None})
    if not unique_ids:
        return {}, {}
    rows = (
        db.query(
            CustomerContractDocument.customer_id,
            CustomerContractDocument.doc_type,
            CustomerContractDocument.template_key,
            CustomerContractDocument.status,
        )
        .filter(CustomerContractDocument.customer_id.in_(unique_ids))
        .all()
    )
    flags_by_customer_set: Dict[int, Set[str]] = {}
    counts_by_customer: Dict[int, Dict[str, int]] = {}
    for customer_id, doc_type, template_key, status in rows:
        cid = int(customer_id)
        key = _normalize_contract_doc_type(doc_type or template_key, default="")
        if not key:
            continue
        counts_for_customer = counts_by_customer.setdefault(cid, {})
        counts_for_customer[key] = int(counts_for_customer.get(key, 0)) + 1
        status_key = str(status or "").strip().lower()
        if status_key in {"active", "proposal"} and key in {"wartung", "monitoring"}:
            flags_by_customer_set.setdefault(cid, set()).add(key)
    flags_by_customer = {
        customer_id: [key for key in ["wartung", "monitoring"] if key in keys]
        for customer_id, keys in flags_by_customer_set.items()
    }
    counts_by_customer_normalized = {
        customer_id: _normalize_contract_type_counts(counts)
        for customer_id, counts in counts_by_customer.items()
    }
    return flags_by_customer, counts_by_customer_normalized


def serialize_customer(
    c: Customer,
    contract_document_flags: Optional[List[str]] = None,
    contract_type_counts: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    contract_flags = _parse_contract_flags(c.contract_flags)
    normalized_contract_document_flags = _normalize_contract_document_flags(contract_document_flags)
    normalized_contract_type_counts = _normalize_contract_type_counts(contract_type_counts)
    primary_email = _customer_primary_email(c)
    newsletter_email = _customer_newsletter_email(c)
    billing_email = _customer_billing_email(c)
    effective_email = _customer_effective_email(c)
    effective_newsletter_email = _customer_newsletter_effective_email(c)
    general_address = _customer_general_address(c)
    billing_address = _customer_billing_address(c)
    effective_address = _customer_effective_address(c)
    return {
        "id": c.id,
        "name": c.name,
        "creditor_number": c.creditor_number,
        "short_code": c.short_code,
        "email": effective_email,
        "primary_email": primary_email,
        "general_email": newsletter_email,
        "newsletter_email": newsletter_email,
        "newsletter_effective_email": effective_newsletter_email,
        "billing_email": billing_email,
        "primary_address_source": _customer_primary_address_source(c),
        "time_tracking_enabled": c.time_tracking_enabled,
        "customer_report": c.customer_report,
        "newsletter": c.newsletter,
        "status": (c.status or "active").strip().lower() or "active",
        "maintenance_contract": (
            bool(c.maintenance_contract)
            or ("wartung" in contract_flags)
            or ("wartung" in normalized_contract_document_flags)
        ),
        "contract_flags": contract_flags,
        "contract_document_flags": normalized_contract_document_flags,
        "contract_type_counts": normalized_contract_type_counts,
        "street": effective_address["street"],
        "postal_code": effective_address["postal_code"],
        "city": effective_address["city"],
        "country": effective_address["country"],
        "general_street": general_address["street"],
        "general_postal_code": general_address["postal_code"],
        "general_city": general_address["city"],
        "general_country": general_address["country"],
        "billing_street": billing_address["street"],
        "billing_postal_code": billing_address["postal_code"],
        "billing_city": billing_address["city"],
        "billing_country": billing_address["country"],
        "phones": [serialize_customer_phone(p) for p in c.phones],
    }


def serialize_customer_phone(p: CustomerPhone) -> Dict[str, Any]:
    return {
        "id": p.id,
        "label": p.label,
        "number": p.number,
    }


def _normalize_customer_license_billing_cycle(value: Any, default: str = "monthly") -> str:
    key = str(value or "").strip().lower()
    if key in {"monthly", "monatlich", "month"}:
        return "monthly"
    if key in {"quarterly", "quartal", "quarter"}:
        return "quarterly"
    if key in {"yearly", "year", "jaehrlich", "jährlich", "annual", "annually"}:
        return "yearly"
    if key in {"once", "einmalig", "one_time"}:
        return "once"
    return default


def _normalize_customer_license_status(value: Any, default: str = "active") -> str:
    key = str(value or "").strip().lower()
    if key in {"inactive", "inaktiv", "disabled"}:
        return "inactive"
    return "active" if default != "inactive" else default


def _customer_license_monthly_equivalent(cost_eur: Any, billing_cycle: Any) -> float:
    cost_value = round(float(_safe_nonnegative_float(cost_eur or 0.0)), 2)
    cycle = _normalize_customer_license_billing_cycle(billing_cycle, default="monthly")
    if cycle == "yearly":
        return round(cost_value / 12.0, 2)
    if cycle == "quarterly":
        return round(cost_value / 3.0, 2)
    if cycle == "once":
        return 0.0
    return cost_value


def serialize_customer_license(item: CustomerLicense) -> Dict[str, Any]:
    billing_cycle = _normalize_customer_license_billing_cycle(item.billing_cycle, default="monthly")
    cost_eur = round(float(item.cost_eur or 0.0), 2)
    return {
        "id": int(item.id),
        "customer_id": int(item.customer_id),
        "vendor": str(item.vendor or "").strip(),
        "product_name": str(item.product_name or "").strip(),
        "quantity": max(0, int(item.quantity or 0)),
        "billing_cycle": billing_cycle,
        "cost_eur": cost_eur,
        "monthly_equivalent_eur": _customer_license_monthly_equivalent(cost_eur, billing_cycle),
        "valid_until": str(item.valid_until or "").strip(),
        "status": _normalize_customer_license_status(item.status, default="active"),
        "notes": str(item.notes or "").strip(),
        "created_at": int(item.created_at or 0),
        "updated_at": int(item.updated_at or 0),
    }


def _normalize_tags(tags: Optional[List[Any]]) -> List[str]:
    if not isinstance(tags, list):
        return []
    return [str(tag).strip() for tag in tags if str(tag).strip()]


def _parse_tags_json(value: Optional[str]) -> List[str]:
    if not value:
        return []
    try:
        loaded = json.loads(value)
    except (TypeError, ValueError):
        return []
    return _normalize_tags(loaded)


_RECURRING_COST_CATEGORY_META: Dict[str, Dict[str, str]] = {
    "license_suite": {"label": "Lizenzen / SaaS", "group": "license"},
    "security_firewall": {"label": "Security / Firewall", "group": "license"},
    "backup": {"label": "Backup", "group": "license"},
    "mail_security": {"label": "Mailsecurity", "group": "license"},
    "cloud": {"label": "Cloud / Hosting", "group": "license"},
    "domain_ssl": {"label": "Domain / SSL", "group": "license"},
    "time_tracking": {"label": "Stempeluhr / Zeiterfassung", "group": "other"},
    "fleet_management": {"label": "Fleetcontrol / Fuhrpark", "group": "other"},
    "telecom": {"label": "Telefonie / Internet", "group": "other"},
    "leasing": {"label": "Leasing / Miete", "group": "other"},
    "other": {"label": "Sonstiges Abo", "group": "other"},
    "contract_wartung": {"label": "Servicevertrag", "group": "contract"},
    "contract_monitoring": {"label": "Monitoringvertrag", "group": "contract"},
    "contract_compliance": {"label": "Compliance / AVV", "group": "contract"},
}

_RECURRING_COST_CATEGORY_ALIASES = {
    "lizenz": "license_suite",
    "licenses": "license_suite",
    "license": "license_suite",
    "saas": "license_suite",
    "m365": "license_suite",
    "microsoft365": "license_suite",
    "o365": "license_suite",
    "security": "security_firewall",
    "firewall": "security_firewall",
    "atp": "security_firewall",
    "backup": "backup",
    "mailsecurity": "mail_security",
    "mail_security": "mail_security",
    "cloudhosting": "cloud",
    "hosting": "cloud",
    "cloud": "cloud",
    "domain": "domain_ssl",
    "ssl": "domain_ssl",
    "zeiterfassung": "time_tracking",
    "stempeluhr": "time_tracking",
    "time_tracking": "time_tracking",
    "fleet": "fleet_management",
    "fleetcontrol": "fleet_management",
    "telefonie": "telecom",
    "internet": "telecom",
    "telecom": "telecom",
    "leasing": "leasing",
    "miete": "leasing",
    "contract_o365": "license_suite",
    "contract_external": "other",
    "contract_other": "other",
    "wartung": "contract_wartung",
    "monitoring": "contract_monitoring",
    "avv": "contract_compliance",
    "avv_dsgvo": "contract_compliance",
}


def _normalize_recurring_cost_category(value: Any, fallback_text: Any = "", default: str = "other") -> str:
    normalized = (
        str(value or "")
        .strip()
        .lower()
        .replace("&", " ")
        .replace("/", " ")
        .replace("-", "_")
    )
    normalized = re.sub(r"[^a-z0-9_]+", "_", normalized).strip("_")
    if normalized in _RECURRING_COST_CATEGORY_META:
        return normalized
    if normalized in _RECURRING_COST_CATEGORY_ALIASES:
        return _RECURRING_COST_CATEGORY_ALIASES[normalized]
    combined = str(fallback_text or "").strip().lower()
    if combined:
        if any(token in combined for token in ("m365", "microsoft 365", "office 365", "exchange", "sharepoint", "adobe", "saas")):
            return "license_suite"
        if any(token in combined for token in ("firewall", "atp", "security", "utm", "endpoint")):
            return "security_firewall"
        if "backup" in combined:
            return "backup"
        if any(token in combined for token in ("mailsecurity", "mail security", "spamfilter", "mailarchiv", "mailarchivierung")):
            return "mail_security"
        if any(token in combined for token in ("hosting", "cloud", "vps", "server", "azure", "aws")):
            return "cloud"
        if any(token in combined for token in ("domain", "ssl", "zertifikat")):
            return "domain_ssl"
        if any(token in combined for token in ("stempeluhr", "zeiterfassung", "time tracking")):
            return "time_tracking"
        if any(token in combined for token in ("fleet", "fuhrpark", "fahrzeug")):
            return "fleet_management"
        if any(token in combined for token in ("telefon", "sip", "internet", "dsl", "mobilfunk")):
            return "telecom"
        if any(token in combined for token in ("leasing", "miete", "rental")):
            return "leasing"
    return default if default in _RECURRING_COST_CATEGORY_META else "other"


def _recurring_cost_category_meta(key: Any) -> Dict[str, str]:
    normalized = _normalize_recurring_cost_category(key)
    return _RECURRING_COST_CATEGORY_META.get(
        normalized,
        _RECURRING_COST_CATEGORY_META["other"],
    )


def serialize_purchasing_item(item: PurchasingItem) -> Dict[str, Any]:
    status = str(item.status or "").strip().lower()
    if status not in {"open", "ordered", "received"}:
        status = "received" if bool(item.done) else "open"
    return {
        "id": item.id,
        "done": bool(item.done) or status == "received",
        "status": status,
        "customer": item.customer or "",
        "title": item.title or "",
        "sourceUrl": item.source_url or "",
        "quantity": item.quantity or "",
        "remark": item.remark or "",
        "trackingNumber": item.tracking_number or "",
        "purchasePrice": item.purchase_price or "",
        "salePrice": item.sale_price or "",
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }


def serialize_knowledge_article(article: KnowledgeArticle) -> Dict[str, Any]:
    return {
        "id": article.id,
        "title": article.title or "",
        "category": article.category or "",
        "tags": _parse_tags_json(article.tags_json),
        "content": article.content or "",
        "pinned": bool(article.pinned),
        "createdAt": article.created_at,
        "updatedAt": article.updated_at,
    }


def serialize_delivery_note(note: DeliveryNote) -> Dict[str, Any]:
    return {
        "id": note.id,
        "customer_id": note.customer_id,
        "note": note.note,
        "signature_base64": note.signature_base64,
        "time_from": note.time_from,
        "time_to": note.time_to,
        "created_at": note.created_at,
    }


def serialize_customer_inventory_event(item: CustomerInventoryEvent) -> Dict[str, Any]:
    cancellation_date = str(item.cancellation_date or item.event_date or "").strip()
    fallback_text = " ".join(
        [
            str(item.device_label or ""),
            str(item.provider or ""),
            str(item.event_type or ""),
            str(item.note or ""),
            " ".join(_parse_tags_json(getattr(item, "tags_json", "[]"))),
        ]
    )
    cost_category = _normalize_recurring_cost_category(
        getattr(item, "cost_category", "") or getattr(item, "event_type", ""),
        fallback_text=fallback_text,
    )
    return {
        "id": item.id,
        "customer_id": item.customer_id,
        "device_label": item.device_label or "",
        "event_type": item.event_type or "wartung",
        "event_date": item.event_date or "",
        "cancellation_date": cancellation_date,
        "provider": item.provider or "",
        "billing_cycle": item.billing_cycle or "monthly",
        "reminder_days": int(item.reminder_days or 0),
        "is_external": bool(item.is_external),
        "is_recurring": bool(item.is_recurring),
        "cost_category": cost_category,
        "cost_category_label": _recurring_cost_category_meta(cost_category)["label"],
        "monthly_cost_eur": round(float(getattr(item, "monthly_cost_eur", 0.0) or 0.0), 2),
        "yearly_cost_eur": round(float(getattr(item, "monthly_cost_eur", 0.0) or 0.0) * 12.0, 2),
        "tags": _parse_tags_json(getattr(item, "tags_json", "[]")),
        "note": item.note or "",
        "created_at": int(item.created_at or 0),
        "updated_at": int(item.updated_at or 0),
    }


def serialize_customer_inventory_device_state(item: CustomerInventoryDeviceState) -> Dict[str, Any]:
    return {
        "id": item.id,
        "customer_id": item.customer_id,
        "source": item.source or "",
        "device_key": item.device_key or "",
        "device_label": item.device_label or "",
        "retired": bool(item.retired),
        "note": item.note or "",
        "updated_at": int(item.updated_at or 0),
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


_INVENTORY_EVENT_BILLING_CYCLES = {"monthly", "quarterly", "yearly", "biyearly", "custom"}


def _normalize_inventory_event_billing_cycle(value: Any, default: str = "monthly") -> str:
    normalized = re.sub(r"[^a-z]+", "", str(value or "").strip().lower())
    if normalized in _INVENTORY_EVENT_BILLING_CYCLES:
        return normalized
    return default


def _normalize_inventory_event_date(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        try:
            datetime.strptime(raw, "%Y-%m-%d")
            return raw
        except ValueError:
            return raw
    for fmt in ("%d.%m.%Y", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def _normalize_inventory_event_reminder_days(value: Any, default: int = 60) -> int:
    days = _safe_int(value, default=default)
    if days < 0:
        return 0
    if days > 3650:
        return 3650
    return days


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
    custom_data = {}
    raw_data = (item.custom_data or "").strip()
    if raw_data:
        try:
            parsed = json.loads(raw_data)
            if isinstance(parsed, dict):
                custom_data = parsed
        except ValueError:
            custom_data = {}
    return {
        "id": item.id,
        "priority": item.priority,
        "title": item.title,
        "system": item.system,
        "why_text": item.why_text,
        "impact": item.impact,
        "duration": item.duration,
        "cost": item.cost,
        "action_type": item.action_type,
        "custom_html": item.custom_html,
        "custom_text": item.custom_text,
        "custom_data": custom_data,
    }

def serialize_report(report: Report) -> Dict[str, Any]:
    third_party_payload = {}
    raw_payload = (report.third_party_payload or "").strip()
    if raw_payload:
        try:
            parsed = json.loads(raw_payload)
            if isinstance(parsed, dict):
                third_party_payload = parsed
        except ValueError:
            third_party_payload = {}
    return {
        "id": report.id,
        "guid": report.guid,
        "customer": report.customer,
        "customer_id": report.customer_id,
        "period": report.period,
        "status": report.status,
        "summary": report.summary,
        "customer_action_text": report.customer_action_text,
        "third_party_payload": third_party_payload,
        "customer_status": report.customer_status,
        "created_at": report.created_at,
        "sent_at": report.sent_at,
        "sent_via": report.sent_via,
        "sent_to": report.sent_to,
        "opened_at": report.opened_at,
        "opened_count": report.opened_count,
        "items": [serialize_report_item(i) for i in report.items],
    }


def _normalize_newsletter_customer_ids(values: Optional[List[Any]]) -> List[int]:
    ids: List[int] = []
    seen: Set[int] = set()
    for value in values or []:
        try:
            customer_id = int(value)
        except (TypeError, ValueError):
            continue
        if customer_id <= 0 or customer_id in seen:
            continue
        seen.add(customer_id)
        ids.append(customer_id)
    return ids


def _normalize_newsletter_email_list(values: Optional[List[Any]]) -> List[str]:
    emails: List[str] = []
    seen: Set[str] = set()
    for value in values or []:
        email = str(value or "").strip()
        if not email:
            continue
        key = email.lower()
        if key in seen:
            continue
        seen.add(key)
        emails.append(email)
    return emails


def _parse_json_object(value: Optional[str]) -> Dict[str, Any]:
    raw = str(value or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except ValueError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _parse_json_string_list(value: Optional[str]) -> List[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except ValueError:
        return []
    return _normalize_newsletter_email_list(parsed if isinstance(parsed, list) else [])


def _serialize_newsletter_group_customer(customer: Customer) -> Dict[str, Any]:
    return {
        "id": customer.id,
        "name": customer.name or "",
        "email": _customer_newsletter_effective_email(customer),
        "status": (customer.status or "active").strip().lower() or "active",
        "newsletter": bool(customer.newsletter),
    }


def serialize_newsletter_group(group: NewsletterGroup) -> Dict[str, Any]:
    members = []
    for member in sorted(group.members, key=lambda item: ((item.customer.name or "").lower() if item.customer else "", item.customer_id)):
        if not member.customer:
            continue
        members.append(_serialize_newsletter_group_customer(member.customer))
    return {
        "id": group.id,
        "name": group.name or "",
        "description": group.description or "",
        "created_at": group.created_at,
        "customer_ids": [int(member["id"]) for member in members],
        "customers": members,
        "recipient_count": len(
            [
                item
                for item in members
                if item.get("newsletter") and str(item.get("email") or "").strip()
            ]
        ),
    }


def serialize_newsletter(newsletter: Newsletter) -> Dict[str, Any]:
    audience = _parse_json_object(newsletter.audience_json)
    return {
        "id": newsletter.id,
        "guid": newsletter.guid,
        "title": newsletter.title or "",
        "subject": newsletter.subject or "",
        "preheader": newsletter.preheader or "",
        "intro_html": newsletter.intro_html or "",
        "body_html": newsletter.body_html or "",
        "cta_label": newsletter.cta_label or "",
        "cta_url": newsletter.cta_url or "",
        "closing_html": newsletter.closing_html or "",
        "selected_group_ids": _normalize_newsletter_customer_ids(audience.get("group_ids")),
        "selected_customer_ids": _normalize_newsletter_customer_ids(audience.get("customer_ids")),
        "recipient_emails": _parse_json_string_list(newsletter.recipient_emails_json),
        "created_at": newsletter.created_at,
        "updated_at": newsletter.updated_at,
        "sent_at": newsletter.sent_at,
        "sent_via": newsletter.sent_via or "",
        "sent_to": _parse_json_string_list(newsletter.sent_to),
        "recipient_count": int(newsletter.recipient_count or 0),
    }


def serialize_newsletter_rss_feed(feed: NewsletterRssFeed) -> Dict[str, Any]:
    return {
        "id": int(feed.id),
        "name": str(feed.name or "").strip(),
        "url": str(feed.url or "").strip(),
        "description": str(feed.description or "").strip(),
        "enabled": bool(feed.enabled),
        "created_at": int(feed.created_at or 0),
        "updated_at": int(feed.updated_at or 0),
    }


def _normalize_newsletter_rss_url(value: Any) -> str:
    url = str(value or "").strip()
    if not url:
        return ""
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = f"https://{url.lstrip('/')}"
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return url


def _html_to_plain_text(value: Any) -> str:
    raw = str(value or "")
    if not raw:
        return ""
    text_value = re.sub(r"<br\s*/?>", "\n", raw, flags=re.IGNORECASE)
    text_value = re.sub(r"</p\s*>", "\n\n", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"<li\s*>", "• ", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"</li\s*>", "\n", text_value, flags=re.IGNORECASE)
    text_value = re.sub(r"<[^>]+>", " ", text_value)
    text_value = unescape(text_value)
    text_value = re.sub(r"\r\n?", "\n", text_value)
    text_value = re.sub(r"[ \t]+\n", "\n", text_value)
    text_value = re.sub(r"\n{3,}", "\n\n", text_value)
    text_value = re.sub(r"[ \t]{2,}", " ", text_value)
    return text_value.strip()


def _xml_local_name(tag: Any) -> str:
    value = str(tag or "")
    if "}" in value:
        return value.split("}", 1)[1]
    if ":" in value:
        return value.split(":", 1)[1]
    return value


def _xml_first_child_text(element: Optional[ET.Element], names: List[str]) -> str:
    if element is None:
        return ""
    wanted = {str(name or "").strip().lower() for name in names if str(name or "").strip()}
    if not wanted:
        return ""
    for child in list(element):
        local_name = _xml_local_name(child.tag).lower()
        if local_name not in wanted:
            continue
        text_value = "".join(child.itertext()).strip()
        if text_value:
            return text_value
    return ""


def _xml_collect_child_texts(element: Optional[ET.Element], names: List[str]) -> List[str]:
    if element is None:
        return []
    wanted = {str(name or "").strip().lower() for name in names if str(name or "").strip()}
    values: List[str] = []
    for child in list(element):
        local_name = _xml_local_name(child.tag).lower()
        if local_name not in wanted:
            continue
        text_value = "".join(child.itertext()).strip()
        if text_value:
            values.append(text_value)
    return values


def _parse_feed_datetime_to_ms(value: Any) -> int:
    text_value = str(value or "").strip()
    if not text_value:
        return 0
    try:
        parsed = parsedate_to_datetime(text_value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp() * 1000)
    except (TypeError, ValueError, IndexError, OverflowError):
        pass
    iso_value = text_value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(iso_value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return int(parsed.timestamp() * 1000)
    except ValueError:
        return 0


def _parse_newsletter_rss_feed_items(
    feed: NewsletterRssFeed,
    xml_bytes: bytes,
    *,
    per_feed_limit: int = 12,
) -> Dict[str, Any]:
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        raise ValueError(f"RSS/Atom parse failed: {exc}") from exc

    local_root = _xml_local_name(root.tag).lower()
    feed_title = ""
    entries: List[Dict[str, Any]] = []

    if local_root == "rss":
        channel = next((child for child in list(root) if _xml_local_name(child.tag).lower() == "channel"), None)
        feed_title = _xml_first_child_text(channel, ["title"]) or str(feed.name or "").strip()
        for item in list(channel or []):
            if _xml_local_name(item.tag).lower() != "item":
                continue
            title = _xml_first_child_text(item, ["title"]) or "Artikel"
            link = _xml_first_child_text(item, ["link"])
            summary = _xml_first_child_text(item, ["description", "encoded", "summary"])
            content = "\n\n".join(
                part for part in _xml_collect_child_texts(item, ["encoded", "description", "content", "summary"]) if part
            ).strip()
            published_at = _parse_feed_datetime_to_ms(
                _xml_first_child_text(item, ["pubDate", "updated", "published", "dc:date", "date"])
            )
            author = _xml_first_child_text(item, ["author", "creator"])
            category_values = _xml_collect_child_texts(item, ["category"])
            entries.append(
                {
                    "id": hashlib.sha1(
                        f"{feed.id}|{link or title}|{published_at}".encode("utf-8", "ignore")
                    ).hexdigest()[:20],
                    "feed_id": int(feed.id),
                    "feed_name": feed_title,
                    "feed_url": str(feed.url or "").strip(),
                    "title": title.strip(),
                    "link": link.strip(),
                    "summary": _html_to_plain_text(summary)[:2400],
                    "content": _html_to_plain_text(content)[:12000],
                    "author": author.strip(),
                    "published_at": published_at,
                    "categories": [str(value).strip() for value in category_values if str(value).strip()],
                }
            )
            if len(entries) >= per_feed_limit:
                break
    elif local_root == "feed":
        feed_title = _xml_first_child_text(root, ["title"]) or str(feed.name or "").strip()
        for item in list(root):
            if _xml_local_name(item.tag).lower() != "entry":
                continue
            title = _xml_first_child_text(item, ["title"]) or "Artikel"
            link = ""
            for child in list(item):
                if _xml_local_name(child.tag).lower() != "link":
                    continue
                href = str(child.attrib.get("href") or "").strip()
                rel = str(child.attrib.get("rel") or "alternate").strip().lower()
                if href and rel in {"alternate", ""}:
                    link = href
                    break
                if href and not link:
                    link = href
            summary = _xml_first_child_text(item, ["summary"])
            content = "\n\n".join(
                part for part in _xml_collect_child_texts(item, ["content", "summary"]) if part
            ).strip()
            published_at = _parse_feed_datetime_to_ms(
                _xml_first_child_text(item, ["updated", "published"])
            )
            author = ""
            for child in list(item):
                if _xml_local_name(child.tag).lower() != "author":
                    continue
                author = _xml_first_child_text(child, ["name"]) or "".join(child.itertext()).strip()
                if author:
                    break
            category_values = []
            for child in list(item):
                if _xml_local_name(child.tag).lower() != "category":
                    continue
                term = str(child.attrib.get("term") or "").strip()
                label = str(child.attrib.get("label") or "").strip()
                if term or label:
                    category_values.append(label or term)
            entries.append(
                {
                    "id": hashlib.sha1(
                        f"{feed.id}|{link or title}|{published_at}".encode("utf-8", "ignore")
                    ).hexdigest()[:20],
                    "feed_id": int(feed.id),
                    "feed_name": feed_title,
                    "feed_url": str(feed.url or "").strip(),
                    "title": title.strip(),
                    "link": link.strip(),
                    "summary": _html_to_plain_text(summary)[:2400],
                    "content": _html_to_plain_text(content)[:12000],
                    "author": author.strip(),
                    "published_at": published_at,
                    "categories": [str(value).strip() for value in category_values if str(value).strip()],
                }
            )
            if len(entries) >= per_feed_limit:
                break
    else:
        raise ValueError("Unsupported feed format")

    entries = [entry for entry in entries if str(entry.get("title") or "").strip()]
    return {
        "feed": {
            "id": int(feed.id),
            "name": feed_title or str(feed.name or "").strip(),
            "url": str(feed.url or "").strip(),
        },
        "items": entries,
    }


def _fetch_newsletter_rss_articles_for_feed(
    feed: NewsletterRssFeed,
    *,
    per_feed_limit: int = 12,
) -> Dict[str, Any]:
    try:
        response = requests.get(
            str(feed.url or "").strip(),
            timeout=(4, 10),
            headers={"User-Agent": "IT-Dashboard Newsletter RSS Import/1.0"},
        )
        response.raise_for_status()
        parsed = _parse_newsletter_rss_feed_items(feed, response.content, per_feed_limit=per_feed_limit)
        return {
            "feed": parsed.get("feed") or serialize_newsletter_rss_feed(feed),
            "items": parsed.get("items") or [],
            "status": "ok",
            "error": "",
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Newsletter RSS feed fetch failed for %s: %s", feed.url, exc)
        return {
            "feed": serialize_newsletter_rss_feed(feed),
            "items": [],
            "status": "error",
            "error": str(exc),
        }


def _build_newsletter_rss_source_text(articles: List[NewsletterRssGenerateArticle]) -> str:
    blocks: List[str] = []
    for index, article in enumerate(articles, start=1):
        title = str(article.title or "").strip()
        if not title:
            continue
        summary = _html_to_plain_text(article.summary)[:1600]
        content = _html_to_plain_text(article.content)[:3200]
        link = str(article.link or "").strip()
        feed_name = str(article.feed_name or "").strip()
        published_at = _safe_int(article.published_at, 0)
        published_label = ""
        if published_at > 0:
            try:
                published_label = datetime.fromtimestamp(published_at / 1000, tz=timezone.utc).strftime("%d.%m.%Y")
            except (OSError, OverflowError, ValueError):
                published_label = ""
        parts = [f"Artikel {index}: {title}"]
        if feed_name:
            parts.append(f"Quelle: {feed_name}")
        if published_label:
            parts.append(f"Datum: {published_label}")
        if summary:
            parts.append(f"Kurzfassung: {summary}")
        if content and content != summary:
            parts.append(f"Inhalt: {content}")
        if link:
            parts.append(f"Link: {link}")
        blocks.append("\n".join(parts))
    return "\n\n".join(blocks).strip()


def _build_newsletter_rss_prompt(mode: str, tone: str, article_count: int) -> str:
    tone_value = str(tone or "sachlich").strip() or "sachlich"
    mode_key = str(mode or "ideas").strip().lower()
    if mode_key == "newsletter":
        return (
            "Erstelle auf Deutsch einen sofort nutzbaren Newsletter-Entwurf aus den gelieferten RSS-Artikeln. "
            "Gib reinen Text ohne Markdown aus. "
            "Struktur: erste Zeile = Betreff, zweite Zeile = kurzer Preheader, danach Leerzeile und dann der komplette Newsletter-Text in gut lesbaren Absätzen. "
            "Verdichte die Inhalte, vermeide Copy-Paste aus den Artikeln und formuliere kundenorientiert mit klarer Einordnung. "
            "Falls mehrere Artikel vorliegen, fasse sie in einem konsistenten Newsletter zusammen. "
            f"Ton: {tone_value}. Verarbeite {article_count} Artikel."
        )
    return (
        "Erstelle auf Deutsch 5 konkrete Newsletter-Themenvorschläge aus den gelieferten RSS-Artikeln. "
        "Gib reinen Text ohne Markdown oder JSON aus. "
        "Jeder Vorschlag in einer Zeile: Ueberschrift, danach Gedankenstrich und ein kurzer Nutzen-/Aufhaenger-Satz. "
        f"Ton: {tone_value}. Verarbeite {article_count} Artikel."
    )


def _build_newsletter_rss_fallback(mode: str, articles: List[NewsletterRssGenerateArticle]) -> str:
    cleaned = [article for article in articles if str(article.title or "").strip()]
    if not cleaned:
        return "Keine RSS-Artikel ausgewaehlt."
    if str(mode or "").strip().lower() == "newsletter":
        first = cleaned[0]
        title = str(first.title or "Newsletter").strip()
        summaries = []
        for article in cleaned[:3]:
            summary_value = _html_to_plain_text(article.summary or article.content)[:280]
            if summary_value:
                summaries.append(f"{article.title}: {summary_value}")
        body = "\n\n".join(summaries) if summaries else "Aktuelle Branchenthemen kompakt fuer Ihre Kunden aufbereitet."
        return f"{title}\nAktuelle Branchenimpulse kompakt zusammengefasst\n\n{body}".strip()
    lines = []
    for article in cleaned[:5]:
        teaser = _html_to_plain_text(article.summary or article.content)[:140].rstrip(" ,;:-")
        lines.append(f"{article.title} - {teaser or 'Aktuellen Artikel als Aufhaenger fuer den Newsletter nutzen.'}")
    return "\n".join(lines).strip()


def _replace_newsletter_group_members(
    db: Session,
    group: NewsletterGroup,
    customer_ids: Optional[List[Any]],
) -> None:
    next_ids = set(_normalize_newsletter_customer_ids(customer_ids))
    group.members.clear()
    if not next_ids:
        return
    valid_ids = {
        int(row.id)
        for row in db.query(Customer.id).filter(Customer.id.in_(list(next_ids))).all()
    }
    for customer_id in sorted(valid_ids):
        group.members.append(NewsletterGroupMember(customer_id=customer_id))


def _resolve_newsletter_recipient_emails(
    db: Session,
    *,
    selected_group_ids: Optional[List[Any]] = None,
    selected_customer_ids: Optional[List[Any]] = None,
    explicit_emails: Optional[List[Any]] = None,
) -> List[str]:
    blocked_emails = {
        _customer_newsletter_effective_email(customer).lower()
        for customer in db.query(Customer).filter(Customer.newsletter.is_(False)).all()
        if _customer_newsletter_effective_email(customer)
    }
    emails = [
        email
        for email in _normalize_newsletter_email_list(explicit_emails)
        if str(email or "").strip().lower() not in blocked_emails
    ]
    customer_ids = set(_normalize_newsletter_customer_ids(selected_customer_ids))
    group_ids = _normalize_newsletter_customer_ids(selected_group_ids)
    if group_ids:
        rows = (
            db.query(NewsletterGroupMember.customer_id)
            .filter(NewsletterGroupMember.group_id.in_(group_ids))
            .all()
        )
        customer_ids.update(int(row.customer_id) for row in rows if row.customer_id is not None)
    if customer_ids:
        customers = (
            db.query(Customer)
            .filter(Customer.id.in_(list(customer_ids)), Customer.newsletter.is_(True))
            .all()
        )
        emails.extend(
            _customer_newsletter_effective_email(customer)
            for customer in customers
            if _customer_newsletter_effective_email(customer)
        )
    return _normalize_newsletter_email_list(emails)


def _normalize_meta_hub_mailbox(raw: Dict[str, Any]) -> Dict[str, Any]:
    mailbox_id = str(raw.get("id") or "").strip() or str(uuid.uuid4())
    host = str(raw.get("host") or "").strip()
    username = str(raw.get("username") or "").strip()
    password = str(raw.get("password") or "").strip()
    folder = str(raw.get("folder") or "INBOX").strip() or "INBOX"
    name = str(raw.get("name") or "").strip()
    email = str(raw.get("email") or "").strip()
    enabled = bool(raw.get("enabled", True))
    use_tls = bool(raw.get("use_tls", True))
    use_ssl = bool(raw.get("use_ssl", False))
    port_value = raw.get("port")
    try:
        port = int(port_value) if port_value not in (None, "") else (993 if use_ssl else 993)
    except Exception:
        port = 993 if use_ssl else 993
    port = max(1, min(port, 65535))
    # Meta-Hub mailbox access is intentionally restricted to read-only.
    read_only = True
    if not name:
        name = email or username or host or "Postfach"
    return {
        "id": mailbox_id,
        "name": name,
        "email": email,
        "host": host,
        "port": port,
        "username": username,
        "password": password,
        "folder": folder,
        "enabled": enabled,
        "use_tls": use_tls,
        "use_ssl": use_ssl,
        "read_only": read_only,
    }


def _parse_meta_hub_mailboxes(raw: Any) -> List[Dict[str, Any]]:
    payload: Any = raw
    if isinstance(raw, str):
        text_value = raw.strip()
        if not text_value:
            return []
        try:
            payload = json.loads(text_value)
        except Exception:
            return []
    if not isinstance(payload, list):
        return []
    normalized: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    for item in payload:
        if not isinstance(item, dict):
            continue
        row = _normalize_meta_hub_mailbox(item)
        row_id = str(row.get("id") or "").strip()
        if not row_id or row_id in seen_ids:
            row["id"] = str(uuid.uuid4())
        seen_ids.add(str(row["id"]))
        normalized.append(row)
    return normalized


def _serialize_meta_hub_mailboxes_for_response(raw: Any) -> List[Dict[str, Any]]:
    rows = _parse_meta_hub_mailboxes(raw)
    out: List[Dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "id": row.get("id") or "",
                "name": row.get("name") or "",
                "email": row.get("email") or "",
                "host": row.get("host") or "",
                "port": int(row.get("port") or 993),
                "username": row.get("username") or "",
                "password": "",
                "has_password": bool(str(row.get("password") or "").strip()),
                "folder": row.get("folder") or "INBOX",
                "enabled": bool(row.get("enabled", True)),
                "use_tls": bool(row.get("use_tls", True)),
                "use_ssl": bool(row.get("use_ssl", False)),
                "read_only": True,
            }
        )
    return out


def _merge_meta_hub_mailboxes(existing_raw: Any, incoming_raw: Any) -> List[Dict[str, Any]]:
    existing = _parse_meta_hub_mailboxes(existing_raw)
    existing_by_id = {str(row.get("id") or "").strip(): row for row in existing if str(row.get("id") or "").strip()}
    if incoming_raw is None:
        return existing
    if not isinstance(incoming_raw, list):
        return existing
    merged: List[Dict[str, Any]] = []
    seen_ids: Set[str] = set()
    for item in incoming_raw:
        if not isinstance(item, dict):
            continue
        normalized = _normalize_meta_hub_mailbox(item)
        row_id = str(normalized.get("id") or "").strip()
        if not row_id:
            row_id = str(uuid.uuid4())
            normalized["id"] = row_id
        previous = existing_by_id.get(row_id)
        if previous and not str(item.get("password") or "").strip():
            normalized["password"] = str(previous.get("password") or "")
        if row_id in seen_ids:
            normalized["id"] = str(uuid.uuid4())
            row_id = str(normalized["id"])
        seen_ids.add(row_id)
        merged.append(normalized)
    return merged


def _connect_meta_hub_mailbox_read_only(mailbox: Dict[str, Any]) -> imaplib.IMAP4:
    host = str(mailbox.get("host") or "").strip()
    username = str(mailbox.get("username") or "").strip()
    password = str(mailbox.get("password") or "")
    try:
        port = int(mailbox.get("port") or 993)
    except Exception:
        port = 993
    folder = str(mailbox.get("folder") or "INBOX").strip() or "INBOX"
    use_ssl = bool(mailbox.get("use_ssl", False))
    use_tls = bool(mailbox.get("use_tls", True))

    if not host:
        raise RuntimeError("IMAP Host fehlt")
    if not username:
        raise RuntimeError("IMAP Benutzername fehlt")
    if not password:
        raise RuntimeError("IMAP Passwort fehlt")

    connection: Optional[imaplib.IMAP4] = None
    try:
        if use_ssl:
            connection = imaplib.IMAP4_SSL(host, port, timeout=META_HUB_MAILBOX_TEST_TIMEOUT_SECONDS)
        else:
            connection = imaplib.IMAP4(host, port, timeout=META_HUB_MAILBOX_TEST_TIMEOUT_SECONDS)
            if use_tls:
                connection.starttls(ssl_context=ssl.create_default_context())
        connection.login(username, password)
        status, _ = connection.select(folder, readonly=True)
        if status != "OK":
            raise RuntimeError(f"Read-only select fuer {folder} fehlgeschlagen")
        return connection
    except Exception:
        if connection is not None:
            try:
                connection.logout()
            except Exception:
                pass
        raise


def serialize_integration_settings(settings: IntegrationSettings) -> Dict[str, Any]:
    meta_hub_mailboxes = _serialize_meta_hub_mailboxes_for_response(settings.meta_hub_mailboxes_json)
    ai_config = _build_ai_config_snapshot(settings)
    return {
        "id": settings.id,
        "rmm_host": settings.rmm_host,
        "rmm_api_key": "",
        "rmm_api_key_header": settings.rmm_api_key_header or "X-API-KEY",
        "has_rmm_api_key": bool(settings.rmm_api_key),
        "pbx_base_url": settings.pbx_base_url,
        "pbx_username": settings.pbx_username,
        "has_pbx_password": bool(settings.pbx_password),
        "has_pbx_refresh_token": bool(settings.pbx_refresh_token),
        "pbx_api_key_id": settings.pbx_api_key_id,
        "pbx_customer_account": settings.pbx_customer_account,
        "has_pbx_api_key_secret": bool(settings.pbx_api_key_secret),
        "marketplace_import_url": settings.marketplace_import_url,
        "td_synnex_base_url": settings.td_synnex_base_url,
        "td_synnex_token_url": settings.td_synnex_token_url,
        "td_synnex_client_id": settings.td_synnex_client_id,
        "td_synnex_account_id": settings.td_synnex_account_id,
        "has_td_synnex_client_secret": bool(settings.td_synnex_client_secret),
        "also_sftp_host": settings.also_sftp_host,
        "also_sftp_port": settings.also_sftp_port,
        "also_sftp_user": settings.also_sftp_user,
        "also_sftp_dir": settings.also_sftp_dir,
        "also_sftp_filename": settings.also_sftp_filename,
        "has_also_sftp_password": bool(settings.also_sftp_password),
        "sevdesk_base_url": settings.sevdesk_base_url,
        "sevdesk_contact_person_id": settings.sevdesk_contact_person_id,
        "sevdesk_address_country_id": settings.sevdesk_address_country_id,
        "sevdesk_tax_type": settings.sevdesk_tax_type,
        "sevdesk_tax_rule_id": settings.sevdesk_tax_rule_id,
        "sevdesk_tax_text": settings.sevdesk_tax_text,
        "sevdesk_currency": settings.sevdesk_currency,
        "sevdesk_invoice_type": settings.sevdesk_invoice_type,
        "sevdesk_default_tax_rate": settings.sevdesk_default_tax_rate,
        "sevdesk_unity_id": settings.sevdesk_unity_id,
        "sevdesk_service_unity_id": settings.sevdesk_service_unity_id,
        "sevdesk_device_unity_id": settings.sevdesk_device_unity_id,
        "sevdesk_hourly_rate_eur": settings.sevdesk_hourly_rate_eur,
        "has_sevdesk_api_token": bool(settings.sevdesk_api_token),
        "icecat_enabled": bool(settings.icecat_enabled),
        "has_icecat_api_token": bool(settings.icecat_api_token),
        "meta_hub_rmm_enabled": bool(settings.meta_hub_rmm_enabled),
        "meta_hub_rmm_customer_field_name": settings.meta_hub_rmm_customer_field_name or "Kundennummer",
        "meta_hub_email_enabled": bool(settings.meta_hub_email_enabled),
        "meta_hub_email_access_mode": "read_only",
        "meta_hub_refresh_seconds": int(settings.meta_hub_refresh_seconds or 300),
        "meta_hub_mailboxes": meta_hub_mailboxes,
        "meta_hub_mailbox_count": len(meta_hub_mailboxes),
        "ai_provider": ai_config["provider"],
        "ai_base_url": ai_config["base_url"],
        "ai_default_model": str(settings.ai_default_model or ai_config["default_model"] or "").strip(),
        "ai_internal_model": str(settings.ai_internal_model or "").strip(),
        "ai_action_model": str(settings.ai_action_model or "").strip(),
        "ai_task_model": str(settings.ai_task_model or "").strip(),
        "ai_customer_ranking_model": str(settings.ai_customer_ranking_model or "").strip(),
        "ai_customer_development_model": str(settings.ai_customer_development_model or "").strip(),
        "ai_offer_model": str(settings.ai_offer_model or "").strip(),
        "ai_invoice_model": str(settings.ai_invoice_model or "").strip(),
        "has_ai_api_key": bool(settings.ai_api_key or ai_config["api_key"]),
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
        "signature_html": settings.signature_html,
        "has_password": bool(settings.password),
    }


def serialize_offer_settings(settings: OfferSettings) -> Dict[str, Any]:
    return {
        "id": settings.id,
        "offer_number_format": settings.offer_number_format,
    }

def _default_contract_templates_v1() -> Dict[str, Dict[str, str]]:
    return {
        "wartung": {
            "title": "Wartungsvertrag",
            "description": "Klassischer Wartungsvertrag mit laufender Betreuung und Stundenbudget.",
            "doc_type": "wartung",
            "header_html": "",
            "footer_html": "",
            "body_template": (
                "<p>Dieser Vertrag wird zwischen <strong>{provider_name}</strong> und "
                "<strong>{customer_name}</strong> geschlossen und betrifft die IT-Umgebung des Kunden.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">1) Enthaltene Leistungen</h3>"
                "<p>Der IT-Dienstleister erbringt im Rahmen dieses Wartungsvertrages folgende Leistungen:</p>"
                "<ul>"
                "<li>Regelmäßige Wartung und Funktionsprüfung der betreuten Systeme.</li>"
                "<li>Proaktive Systemüberwachung (Monitoring).</li>"
                "<li>Fehleranalyse und Störungsbehebung im vertraglich vereinbarten Umfang.</li>"
                "<li>Remote-Support innerhalb der vereinbarten Servicezeiten.</li>"
                "<li>Installation sicherheitsrelevanter Updates und Patches.</li>"
                "<li>Basis-IT-Security-Überwachung.</li>"
                "<li>Dokumentation der durchgeführten Arbeiten.</li>"
                "<li>Konkrete Handlungsempfehlungen zur Systemstabilität.</li>"
                "</ul>"
                "<p><strong>Servicezeiten:</strong><br>{service_hours}</p>"
                "<p><strong>Reaktionszeit (Remote):</strong><br>{reaction_time}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">2) Nicht enthaltene Leistungen</h3>"
                "<p>Folgende Leistungen sind ausdrücklich nicht Bestandteil dieses Vertrages:</p>"
                "<ul>"
                "<li>Projektleistungen, Migrationen, Neuinstallationen und grundlegende Umbauten.</li>"
                "<li>Hardwarelieferungen und Softwarelizenzen.</li>"
                "<li>Ersatzteile und Herstellerleistungen.</li>"
                "<li>Vor-Ort-Einsätze außerhalb inkludierter Stunden.</li>"
                "<li>Reisekosten und Fremdleistungen.</li>"
                "<li>Notfalleinsätze außerhalb der Servicezeiten ohne gesonderte Beauftragung.</li>"
                "<li>Schulungen oder Anwendertrainings.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">3) Vergütung und Zeitbudget</h3>"
                "<p><strong>Monatliche Betreuungspauschale:</strong><br>{monthly_total}</p>"
                "<p><strong>Jährliche Gesamtvergütung:</strong><br>{yearly_total}</p>"
                "<p><strong>Inklusivstunden pro Monat:</strong><br>{monthly_hours_included}</p>"
                "<p><strong>Regelungen:</strong><br>"
                "Nicht verbrauchte Inklusivstunden verfallen am Monatsende, sofern nichts anderes "
                "schriftlich vereinbart wurde. Mehrleistungen werden nach vorheriger Freigabe gesondert "
                "verrechnet.</p>"
                "<p><strong>Stundensatz für Zusatzleistungen:</strong> {hourly_rate_extra}</p>"
                "<p><strong>Abrechnungseinheit:</strong> {billing_interval}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">4) Betreute Umgebung</h3>"
                "<p><strong>Server:</strong> {servers}<br>"
                "<strong>Clients / Arbeitsplätze:</strong> {clients}<br>"
                "<strong>Netzwerkgeräte:</strong> {network_devices}<br>"
                "<strong>IoT / Peripherie:</strong> {iot_devices}<br>"
                "<strong>Zusätzliche Systeme:</strong><br>{additional_systems}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">5) Serviceumfang</h3>"
                "<p><strong>Monitoring aktiviert:</strong> {monitoring_enabled}<br>"
                "<strong>Backupüberwachung:</strong> {backup_monitoring}<br>"
                "<strong>Patchmanagement:</strong> {patch_management}<br>"
                "<strong>Securityüberwachung:</strong> {security_monitoring}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">6) Laufzeit</h3>"
                "<p><strong>Vertragsbeginn:</strong> {contract_start}<br>"
                "<strong>Mindestlaufzeit:</strong><br>{minimum_term_months} Monate</p>"
                "<p><strong>Verlängerung:</strong><br>"
                "Der Vertrag verlängert sich automatisch um {extension_period} Monate, sofern keine "
                "schriftliche Kündigung mindestens {termination_notice} vor Ablauf erfolgt.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">7) Mitwirkungspflichten des Kunden</h3>"
                "<p>Der Kunde verpflichtet sich:</p>"
                "<ul>"
                "<li>notwendige Systemzugänge bereitzustellen,</li>"
                "<li>administrative Änderungen mitzuteilen,</li>"
                "<li>Datensicherungen gemäß Empfehlung umzusetzen,</li>"
                "<li>autorisierte Ansprechpartner zu benennen.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">8) Haftung</h3>"
                "<p>Der IT-Dienstleister haftet ausschließlich für grobe Fahrlässigkeit und Vorsatz im "
                "Rahmen der gesetzlichen Bestimmungen.</p>"
                "<p>Keine Haftung besteht für:</p>"
                "<ul>"
                "<li>Datenverlust ohne funktionierende Datensicherung,</li>"
                "<li>Drittanbieter-Ausfälle,</li>"
                "<li>Internet- oder Cloud-Provider-Störungen,</li>"
                "<li>Cyberangriffe außerhalb zumutbarer Schutzmaßnahmen.</li>"
                "</ul>"
                "<p><strong>Haftungshöchstgrenze pro Schadensfall:</strong><br>{liability_limit}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">9) Vertraulichkeit und Datenschutz</h3>"
                "<p>Beide Vertragsparteien verpflichten sich zur Einhaltung der DSGVO sowie zur vertraulichen "
                "Behandlung aller im Rahmen der Betreuung erlangten Informationen.</p>"
                "<p>{note_block}</p>"
            ),
        },
        "monitoring": {
            "title": "Monitoringvertrag",
            "description": "Technische Ueberwachung mit Alarmierung und Monitoring-Berichten.",
            "doc_type": "monitoring",
            "header_html": "",
            "footer_html": "",
            "body_template": (
                "<p>Dieser Vertrag wird zwischen <strong>{provider_name}</strong> und "
                "<strong>{customer_name}</strong> geschlossen und betrifft die laufende Überwachung der "
                "IT-Umgebung des Kunden.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">1) Enthaltene Leistungen</h3>"
                "<p>Der IT-Dienstleister erbringt im Rahmen dieses Monitoringvertrages folgende Leistungen:</p>"
                "<ul>"
                "<li>Technisches Monitoring der vereinbarten Systeme und Dienste.</li>"
                "<li>Erkennung und Meldung definierter Schwellwertverletzungen und Störungen.</li>"
                "<li>Regelmäßige Monitoring-Berichte und transparente Betriebsdokumentation.</li>"
                "<li>Erstbewertung von Alarmen inklusive Priorisierung für die weitere Bearbeitung.</li>"
                "<li>Benachrichtigung und Abstimmung mit dem Kunden bei Handlungsbedarf.</li>"
                "</ul>"
                "<p><strong>Servicezeiten:</strong><br>{service_hours}</p>"
                "<p><strong>Reaktionszeit (Remote):</strong><br>{reaction_time}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">2) Nicht enthaltene Leistungen</h3>"
                "<p>Folgende Leistungen sind ausdrücklich nicht Bestandteil dieses Vertrages:</p>"
                "<ul>"
                "<li>Automatische Entstörung ohne gesonderte Beauftragung.</li>"
                "<li>Projektarbeiten, Migrationen, Neuinstallationen und grundlegende Umbauten.</li>"
                "<li>Hardwarelieferungen, Softwarelizenzen sowie Herstellerleistungen Dritter.</li>"
                "<li>Vor-Ort-Einsätze außerhalb inkludierter Stunden.</li>"
                "<li>Notfalleinsätze außerhalb der Servicezeiten ohne gesonderte Beauftragung.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">3) Vergütung und Zeitbudget</h3>"
                "<p><strong>Monatliche Monitoringpauschale:</strong><br>{monthly_total}</p>"
                "<p><strong>Jährliche Gesamtvergütung:</strong><br>{yearly_total}</p>"
                "<p><strong>Inklusivstunden pro Monat:</strong><br>{monthly_hours_included}</p>"
                "<p><strong>Regelungen:</strong><br>"
                "Nicht verbrauchte Inklusivstunden verfallen am Monatsende, sofern nichts anderes "
                "schriftlich vereinbart wurde. Weitergehende Umsetzungen werden nach vorheriger Freigabe "
                "gesondert verrechnet.</p>"
                "<p><strong>Stundensatz für Zusatzleistungen:</strong> {hourly_rate_extra}</p>"
                "<p><strong>Abrechnungseinheit:</strong> {billing_interval}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">4) Überwachte Umgebung</h3>"
                "<p><strong>Server:</strong> {servers}<br>"
                "<strong>Clients / Arbeitsplätze:</strong> {clients}<br>"
                "<strong>Netzwerkgeräte:</strong> {network_devices}<br>"
                "<strong>IoT / Peripherie:</strong> {iot_devices}<br>"
                "<strong>Zusätzliche Systeme:</strong><br>{additional_systems}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">5) Serviceumfang</h3>"
                "<p><strong>Monitoring aktiviert:</strong> {monitoring_enabled}<br>"
                "<strong>Backupüberwachung:</strong> {backup_monitoring}<br>"
                "<strong>Patchmanagement:</strong> {patch_management}<br>"
                "<strong>Securityüberwachung:</strong> {security_monitoring}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">6) Laufzeit</h3>"
                "<p><strong>Vertragsbeginn:</strong> {contract_start}<br>"
                "<strong>Mindestlaufzeit:</strong><br>{minimum_term_months} Monate</p>"
                "<p><strong>Verlängerung:</strong><br>"
                "Der Vertrag verlängert sich automatisch um {extension_period} Monate, sofern keine "
                "schriftliche Kündigung mindestens {termination_notice} vor Ablauf erfolgt.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">7) Mitwirkungspflichten des Kunden</h3>"
                "<p>Der Kunde verpflichtet sich:</p>"
                "<ul>"
                "<li>notwendige Zugänge und Kontaktinformationen bereitzustellen,</li>"
                "<li>Änderungen an überwachten Systemen unverzüglich mitzuteilen,</li>"
                "<li>Empfehlungen zur IT-Sicherheit angemessen umzusetzen,</li>"
                "<li>autorisierte Ansprechpartner für Störfälle zu benennen.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">8) Haftung</h3>"
                "<p>Der IT-Dienstleister haftet ausschließlich für grobe Fahrlässigkeit und Vorsatz im "
                "Rahmen der gesetzlichen Bestimmungen.</p>"
                "<p>Keine Haftung besteht für:</p>"
                "<ul>"
                "<li>Datenverlust ohne funktionierende Datensicherung,</li>"
                "<li>Ausfälle von Drittanbietern,</li>"
                "<li>Internet- oder Cloud-Provider-Störungen,</li>"
                "<li>Cyberangriffe außerhalb zumutbarer Schutzmaßnahmen.</li>"
                "</ul>"
                "<p><strong>Haftungshöchstgrenze pro Schadensfall:</strong><br>{liability_limit}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">9) Vertraulichkeit und Datenschutz</h3>"
                "<p>Beide Vertragsparteien verpflichten sich zur Einhaltung der DSGVO sowie zur vertraulichen "
                "Behandlung aller im Rahmen der Betreuung erlangten Informationen.</p>"
                "<p>{note_block}</p>"
            ),
        },
        "avv_dsgvo": {
            "title": "Auftragsverarbeitungsvertrag (DSGVO)",
            "description": "Datenschutzrechtliches Template fuer Auftragsverarbeitung nach Art. 28 DSGVO.",
            "doc_type": "avv_dsgvo",
            "header_html": "",
            "footer_html": "",
            "body_template": (
                "<p>Dieser Vertrag zur Auftragsverarbeitung gemäß Art. 28 DSGVO wird zwischen "
                "<strong>{provider_name}</strong> (Auftragsverarbeiter) und "
                "<strong>{customer_name}</strong> (Verantwortlicher) geschlossen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">1) Gegenstand und Zweck</h3>"
                "<p>Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich zur Erbringung "
                "der vereinbarten IT-Leistungen und ausschließlich auf dokumentierte Weisung des "
                "Verantwortlichen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">2) Art der Daten und Kreis betroffener Personen</h3>"
                "<p>Verarbeitet werden nur die für die Leistungserbringung erforderlichen personenbezogenen "
                "Daten. Betroffene Personen können insbesondere Mitarbeitende, Ansprechpartner, Kunden oder "
                "Dienstleister des Verantwortlichen sein.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">3) Pflichten des Auftragsverarbeiters</h3>"
                "<ul>"
                "<li>Verarbeitung nur im Rahmen dokumentierter Weisungen des Verantwortlichen.</li>"
                "<li>Wahrung der Vertraulichkeit und Zugriff nur für berechtigte Personen.</li>"
                "<li>Umsetzung angemessener technischer und organisatorischer Maßnahmen (TOM).</li>"
                "<li>Unterstützung bei Betroffenenrechten, Datenschutzvorfällen und Nachweispflichten.</li>"
                "<li>Dokumentation und Auskunftserteilung im rechtlich erforderlichen Umfang.</li>"
                "<li>Löschung oder Rückgabe personenbezogener Daten nach Vertragsende, soweit keine "
                "gesetzliche Aufbewahrungspflicht entgegensteht.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">4) Unterauftragsverhältnisse</h3>"
                "<p>Der Einsatz von Unterauftragsverarbeitern erfolgt nur unter Beachtung der gesetzlichen "
                "Vorgaben und vertraglichen Abstimmung mit dem Verantwortlichen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">5) Pflichten des Verantwortlichen</h3>"
                "<p>Der Verantwortliche bleibt für die Rechtmäßigkeit der Verarbeitung, die "
                "Zulässigkeit der Datenweitergabe sowie für die Wahrung der Betroffenenrechte "
                "verantwortlich.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">6) Nicht enthaltene Regelungen</h3>"
                "<ul>"
                "<li>Keine Übernahme der Rolle des Verantwortlichen durch den Auftragsverarbeiter.</li>"
                "<li>Keine Datenverarbeitung außerhalb dokumentierter Weisungen.</li>"
                "<li>Keine eigenständige Rechtsberatung zur DSGVO-Compliance des Verantwortlichen.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">7) Laufzeit und Beendigung</h3>"
                "<p>Gültig ab <strong>{valid_from}</strong>. Die Laufzeit richtet sich nach der Dauer "
                "des zugrunde liegenden Hauptvertrags beziehungsweise der Leistungserbringung.</p>"
                "<p>Nach Beendigung erfolgt die Rückgabe oder Löschung personenbezogener Daten gemäß "
                "gesetzlichen und vertraglichen Vorgaben.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">8) Vertraulichkeit und Datenschutz</h3>"
                "<p>Beide Vertragsparteien verpflichten sich zur Einhaltung der DSGVO sowie zur vertraulichen "
                "Behandlung aller im Rahmen der Zusammenarbeit erlangten Informationen.</p>"
                "<p>{note_block}</p>"
            ),
        },
    }


def _default_contract_templates_v2() -> Dict[str, Dict[str, str]]:
    return {
        "wartung": {
            "title": "IT-Service- und Wartungsvertrag",
            "description": "Servicevertrag fuer laufende Betreuung, Wartung und definierte Inklusivstunden.",
            "doc_type": "wartung",
            "header_html": "",
            "footer_html": "",
            "body_template": (
                "<p>Zwischen <strong>{provider_name}</strong> und <strong>{customer_name}</strong> "
                "wird dieser IT-Service- und Wartungsvertrag für die nachfolgend beschriebene IT-Umgebung geschlossen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">1) Vertragsgegenstand</h3>"
                "<p>Gegenstand dieses Vertrages ist die laufende technische Betreuung, Wartung und "
                "Betriebsstabilisierung der vereinbarten Systeme des Kunden. Maßgeblich ist der schriftlich "
                "vereinbarte Leistungsrahmen einschließlich der nachstehenden Regelungen.</p>"
                "<p><strong>Vereinbarter Serviceumfang:</strong><br>{service_scope}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">2) Enthaltene Leistungen</h3>"
                "<ul>"
                "<li>Regelmäßige technische Wartung und Funktionskontrolle der betreuten Systeme.</li>"
                "<li>Analyse und Behebung von Störungen im vertraglich vereinbarten Umfang.</li>"
                "<li>Remote-Support innerhalb der vereinbarten Servicezeiten.</li>"
                "<li>Einspielen sicherheitsrelevanter Updates und Patches nach fachlicher Bewertung.</li>"
                "<li>Überwachung zentraler Betriebszustände, soweit Monitoring Bestandteil des Leistungsumfangs ist.</li>"
                "<li>Dokumentation wesentlicher Maßnahmen und Empfehlungen zur Systemstabilität.</li>"
                "</ul>"
                "<p><strong>Servicezeiten:</strong><br>{service_hours}</p>"
                "<p><strong>Reaktionszeit:</strong><br>{reaction_time}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">3) Betreute Systeme</h3>"
                "<p><strong>Server:</strong> {servers}<br>"
                "<strong>Clients / Arbeitsplätze:</strong> {clients}<br>"
                "<strong>Netzwerkgeräte:</strong> {network_devices}<br>"
                "<strong>IoT / Peripherie:</strong> {iot_devices}<br>"
                "<strong>Zusätzliche Systeme:</strong><br>{additional_systems}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">4) Leistungsabgrenzung</h3>"
                "<p>Nicht Bestandteil dieses Vertrages sind insbesondere Leistungen, die über den laufenden "
                "Betrieb und die vereinbarte Wartung hinausgehen.</p>"
                "<ul>"
                "<li>Projektleistungen, Migrationen, Neuinstallationen und grundlegende Umbauten.</li>"
                "<li>Hardware, Softwarelizenzen, Ersatzteile und Leistungen von Herstellern oder Drittanbietern.</li>"
                "<li>Vor-Ort-Einsätze, Reisekosten oder Fremdleistungen, soweit sie nicht ausdrücklich vereinbart sind.</li>"
                "<li>Notfallmaßnahmen außerhalb der Servicezeiten ohne gesonderte Beauftragung.</li>"
                "<li>Schulungen, Anwendertrainings oder organisatorische Beratungsleistungen.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">5) Vergütung und Zeitbudget</h3>"
                "<p><strong>Monatliche Betreuungspauschale:</strong><br>{monthly_total}</p>"
                "<p><strong>Jährliche Gesamtvergütung:</strong><br>{yearly_total}</p>"
                "<p><strong>Inklusivstunden pro Monat:</strong><br>{monthly_hours_included}</p>"
                "<p>Nicht verbrauchte Inklusivstunden verfallen zum Monatsende, sofern nichts Abweichendes "
                "schriftlich vereinbart wurde. Leistungen über das vereinbarte Zeitbudget hinaus werden nach "
                "vorheriger Freigabe gesondert verrechnet.</p>"
                "<p><strong>Stundensatz für Zusatzleistungen:</strong> {hourly_rate_extra}<br>"
                "<strong>Abrechnungsintervall:</strong> {billing_interval}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">6) Mitwirkungspflichten des Kunden</h3>"
                "<ul>"
                "<li>Bereitstellung erforderlicher Zugänge, Ansprechpartner und technischer Informationen.</li>"
                "<li>Unverzügliche Mitteilung wesentlicher Änderungen an Systemen, Standorten oder Verantwortlichkeiten.</li>"
                "<li>Sicherstellung geeigneter Datensicherungen, soweit diese nicht ausdrücklich Vertragsbestandteil sind.</li>"
                "<li>Zeitnahe Freigabe notwendiger Maßnahmen, wenn deren Umsetzung von Entscheidungen des Kunden abhängt.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">7) Vertragslaufzeit und Kündigung</h3>"
                "<p><strong>Vertragsbeginn:</strong> {contract_start}<br>"
                "<strong>Mindestlaufzeit:</strong> {minimum_term_months} Monate<br>"
                "<strong>Automatische Verlängerung:</strong> {extension_period} Monate</p>"
                "<p>Der Vertrag verlängert sich jeweils automatisch um {extension_period} Monate, sofern er nicht "
                "mit einer Frist von {termination_notice} zum Ende der jeweiligen Laufzeit schriftlich gekündigt wird.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">8) Vertraulichkeit, Datenschutz und Haftung</h3>"
                "<p>Beide Vertragsparteien verpflichten sich zur vertraulichen Behandlung aller im Rahmen der "
                "Zusammenarbeit bekannt gewordenen Informationen sowie zur Einhaltung der anwendbaren "
                "datenschutzrechtlichen Vorgaben.</p>"
                "<p><strong>Haftungshöchstgrenze pro Schadensfall:</strong><br>{liability_limit}</p>"
                "<p>{note_block}</p>"
            ),
        },
        "monitoring": {
            "title": "IT-Monitoringvertrag",
            "description": "Template fuer Ueberwachung, Alarmierung und regelmaessige Betriebsinformationen.",
            "doc_type": "monitoring",
            "header_html": "",
            "footer_html": "",
            "body_template": (
                "<p>Zwischen <strong>{provider_name}</strong> und <strong>{customer_name}</strong> "
                "wird dieser IT-Monitoringvertrag für die vereinbarte technische Überwachung der Kundenumgebung geschlossen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">1) Vertragsgegenstand</h3>"
                "<p>Gegenstand dieses Vertrages ist die laufende Überwachung definierter Systeme, Dienste und "
                "Betriebsparameter, um kritische Zustände, Ausfälle und Abweichungen frühzeitig zu erkennen "
                "und dem Kunden transparent zu machen.</p>"
                "<p><strong>Vereinbarter Serviceumfang:</strong><br>{service_scope}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">2) Enthaltene Leistungen</h3>"
                "<ul>"
                "<li>Technisches Monitoring vereinbarter Systeme und Dienste auf Basis definierter Prüfungen und Schwellwerte.</li>"
                "<li>Erkennung, Kategorisierung und Dokumentation von Alarmen, Auffälligkeiten und Störungen.</li>"
                "<li>Erstbewertung eingehender Monitoring-Ereignisse und Priorisierung für die weitere Bearbeitung.</li>"
                "<li>Benachrichtigung des Kunden beziehungsweise der benannten Ansprechpartner bei Handlungsbedarf.</li>"
                "<li>Regelmäßige Bereitstellung von Statusinformationen oder Monitoring-Berichten nach Vereinbarung.</li>"
                "</ul>"
                "<p><strong>Servicezeiten:</strong><br>{service_hours}</p>"
                "<p><strong>Reaktionszeit für qualifizierte Rückmeldung:</strong><br>{reaction_time}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">3) Überwachte Umgebung</h3>"
                "<p><strong>Server:</strong> {servers}<br>"
                "<strong>Clients / Arbeitsplätze:</strong> {clients}<br>"
                "<strong>Netzwerkgeräte:</strong> {network_devices}<br>"
                "<strong>IoT / Peripherie:</strong> {iot_devices}<br>"
                "<strong>Zusätzliche Systeme:</strong><br>{additional_systems}</p>"
                "<p><strong>Monitoring aktiviert:</strong> {monitoring_enabled}<br>"
                "<strong>Backupüberwachung:</strong> {backup_monitoring}<br>"
                "<strong>Patchmanagement:</strong> {patch_management}<br>"
                "<strong>Securityüberwachung:</strong> {security_monitoring}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">4) Leistungsabgrenzung</h3>"
                "<p>Dieser Vertrag begründet keine automatische Entstörung oder Projektleistung, sofern dies nicht "
                "gesondert schriftlich vereinbart wurde.</p>"
                "<ul>"
                "<li>Keine automatische Fehlerbehebung ohne gesonderte Beauftragung oder vereinbartes Stundenkontingent.</li>"
                "<li>Keine Projektarbeiten, Migrationen, Neuinstallationen oder grundlegenden Umbauten.</li>"
                "<li>Keine Hardware-, Lizenz- oder Herstellerleistungen Dritter.</li>"
                "<li>Keine Vor-Ort-Einsätze oder Notfalleinsätze außerhalb der Servicezeiten ohne gesonderte Freigabe.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">5) Vergütung und Zusatzleistungen</h3>"
                "<p><strong>Monatliche Monitoringpauschale:</strong><br>{monthly_total}</p>"
                "<p><strong>Jährliche Gesamtvergütung:</strong><br>{yearly_total}</p>"
                "<p><strong>Inklusivstunden pro Monat:</strong><br>{monthly_hours_included}</p>"
                "<p>Soweit ein Stundenkontingent vereinbart ist, können abgestimmte Zusatzmaßnahmen hierüber "
                "erbracht werden. Darüber hinausgehende Leistungen werden nach vorheriger Freigabe separat berechnet.</p>"
                "<p><strong>Stundensatz für Zusatzleistungen:</strong> {hourly_rate_extra}<br>"
                "<strong>Abrechnungsintervall:</strong> {billing_interval}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">6) Mitwirkungspflichten des Kunden</h3>"
                "<ul>"
                "<li>Benennung fachlicher und technischer Ansprechpartner.</li>"
                "<li>Bereitstellung erforderlicher Zugriffe, Freigaben und Informationen zur Einbindung der Systeme.</li>"
                "<li>Unverzügliche Information über Änderungen an Infrastruktur, Verantwortlichkeiten oder Sicherheitsvorgaben.</li>"
                "<li>Zeitnahe Entscheidung über empfohlene Maßnahmen bei erkannten Risiken oder Störungen.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">7) Vertragslaufzeit und Kündigung</h3>"
                "<p><strong>Vertragsbeginn:</strong> {contract_start}<br>"
                "<strong>Mindestlaufzeit:</strong> {minimum_term_months} Monate<br>"
                "<strong>Automatische Verlängerung:</strong> {extension_period} Monate</p>"
                "<p>Der Vertrag verlängert sich jeweils automatisch um {extension_period} Monate, sofern er nicht "
                "mit einer Frist von {termination_notice} zum Ende der jeweiligen Laufzeit schriftlich gekündigt wird.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">8) Vertraulichkeit, Datenschutz und Haftung</h3>"
                "<p>Monitoringdaten, Betriebsinformationen und sonstige im Rahmen der Leistungserbringung gewonnene "
                "Informationen sind vertraulich zu behandeln. Es gelten die anwendbaren datenschutzrechtlichen Vorgaben.</p>"
                "<p><strong>Haftungshöchstgrenze pro Schadensfall:</strong><br>{liability_limit}</p>"
                "<p>{note_block}</p>"
            ),
        },
        "avv_dsgvo": {
            "title": "Vereinbarung zur Auftragsverarbeitung (Art. 28 DSGVO)",
            "description": "Rechtliches Datenschutz-Template zur Auftragsverarbeitung.",
            "doc_type": "avv_dsgvo",
            "header_html": "",
            "footer_html": "",
            "body_template": (
                "<p>Diese Vereinbarung zur Auftragsverarbeitung gemäß Art. 28 DSGVO wird zwischen "
                "<strong>{customer_name}</strong> als Verantwortlichem und <strong>{provider_name}</strong> "
                "als Auftragsverarbeiter geschlossen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">1) Gegenstand und Dauer der Verarbeitung</h3>"
                "<p>Gegenstand dieser Vereinbarung ist die Verarbeitung personenbezogener Daten im Zusammenhang "
                "mit der Erbringung der vertraglich vereinbarten Leistungen, insbesondere im Rahmen von "
                "Administration, Support, Systembetrieb, Monitoring und vergleichbaren IT-Dienstleistungen.</p>"
                "<p>Die Vereinbarung gilt ab <strong>{valid_from}</strong> und für die Dauer der zugrunde "
                "liegenden Leistungserbringung beziehungsweise bis zur vollständigen Beendigung aller damit "
                "zusammenhängenden Verarbeitungsvorgänge.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">2) Art und Zweck der Verarbeitung</h3>"
                "<p>Die Verarbeitung erfolgt ausschließlich zur vertragsgemäßen Erbringung der beauftragten "
                "Leistungen, zur technischen Betreuung der Systeme, zur Fehleranalyse, zur Absicherung des "
                "Betriebs sowie zur Erfüllung dokumentierter Weisungen des Verantwortlichen.</p>"
                "<p><strong>Leistungsbezug:</strong><br>{service_scope}</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">3) Kategorien personenbezogener Daten und betroffener Personen</h3>"
                "<p>Je nach Auftragsinhalt können insbesondere Stamm-, Kontakt-, Kommunikations-, Benutzer-, "
                "Protokoll-, Geräte- und Supportdaten verarbeitet werden, soweit dies für die Leistungserbringung "
                "erforderlich ist.</p>"
                "<p>Betroffene Personen sind insbesondere Mitarbeitende, Ansprechpartner, Kunden, Lieferanten "
                "oder sonstige Kommunikationspartner des Verantwortlichen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">4) Weisungsrecht des Verantwortlichen</h3>"
                "<p>Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschließlich auf dokumentierte "
                "Weisung des Verantwortlichen, soweit nicht eine gesetzliche Verpflichtung zur Verarbeitung besteht. "
                "Hält der Auftragsverarbeiter eine Weisung für rechtlich unzulässig, wird er den Verantwortlichen "
                "hierauf unverzüglich hinweisen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">5) Pflichten des Auftragsverarbeiters</h3>"
                "<ul>"
                "<li>Verpflichtung aller mit der Verarbeitung befassten Personen auf Vertraulichkeit.</li>"
                "<li>Umsetzung geeigneter technischer und organisatorischer Maßnahmen zum Schutz personenbezogener Daten.</li>"
                "<li>Unterstützung des Verantwortlichen bei der Wahrnehmung von Betroffenenrechten, bei Datenschutz-Folgenabschätzungen und bei behördlichen Anfragen, soweit gesetzlich erforderlich.</li>"
                "<li>Unverzügliche Information über bekannt gewordene Verletzungen des Schutzes personenbezogener Daten.</li>"
                "<li>Führung geeigneter Nachweise über die Einhaltung der gesetzlichen und vertraglichen Pflichten.</li>"
                "<li>Ermöglichung angemessener Informationen und Kontrollen im gesetzlich vorgesehenen Umfang.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">6) Unterauftragsverarbeiter</h3>"
                "<p>Der Einsatz von Unterauftragsverarbeitern erfolgt ausschließlich nach Maßgabe der DSGVO und "
                "unter Sicherstellung eines gleichwertigen Schutzniveaus. Der Auftragsverarbeiter bleibt gegenüber "
                "dem Verantwortlichen für die ordnungsgemäße Erfüllung der Pflichten verantwortlich.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">7) Pflichten des Verantwortlichen</h3>"
                "<ul>"
                "<li>Verantwortung für die Rechtmäßigkeit der Datenverarbeitung und der Datenübermittlung an den Auftragsverarbeiter.</li>"
                "<li>Erteilung klarer, dokumentierter Weisungen und Benennung zuständiger Ansprechpartner.</li>"
                "<li>Wahrung der Informationspflichten gegenüber betroffenen Personen sowie der sonstigen Pflichten nach DSGVO.</li>"
                "</ul>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">8) Rückgabe und Löschung</h3>"
                "<p>Nach Beendigung der Leistungserbringung wird der Auftragsverarbeiter alle personenbezogenen Daten "
                "nach Wahl des Verantwortlichen zurückgeben oder löschen, sofern keine gesetzlichen "
                "Aufbewahrungspflichten oder berechtigte Nachweisinteressen entgegenstehen.</p>"
                "<h3 style=\"margin:14px 0 6px; font-size:14px;\">9) Schlussbestimmungen</h3>"
                "<p>Diese Vereinbarung konkretisiert die datenschutzrechtlichen Pflichten der Parteien im Rahmen "
                "der bestehenden Geschäftsbeziehung. Im Übrigen gelten die Vereinbarungen des zugrunde liegenden "
                "Hauptvertrags fort.</p>"
                "<p>{note_block}</p>"
            ),
        },
    }


def _normalize_contract_template_entry(raw: Any) -> Dict[str, str]:
    entry = raw if isinstance(raw, dict) else {}
    raw_doc_type = str(entry.get("doc_type") or "").strip()
    return {
        "title": str(entry.get("title") or "").strip(),
        "description": str(entry.get("description") or "").strip(),
        "doc_type": _normalize_contract_doc_type(raw_doc_type, default="") if raw_doc_type else "",
        "header_html": str(entry.get("header_html") or ""),
        "body_template": str(entry.get("body_template") or ""),
        "footer_html": str(entry.get("footer_html") or ""),
    }


def _contract_template_entries_equal(left: Any, right: Any) -> bool:
    return _normalize_contract_template_entry(left) == _normalize_contract_template_entry(right)


def _default_ai_prompts() -> Dict[str, Any]:
    return {
        "action_prompt": (
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
            "Text: {text}"
        ),
        "offer_base_prompt": (
            "Du bist ein Assistent fuer Angebots-Texte. "
            "Schreibe auf Deutsch, sachlich und klar. "
            "Nutze die Informationen im Kontext. "
            "Wenn bereits Text vorhanden ist, verbessere und ergaenze ihn, "
            "ohne den Inhalt zu wiederholen. "
            "Gib nur den Text zurueck, keine Markdown- oder JSON-Formatierung.\n\n"
            "Aufgabe: {instruction}\n\n"
            "Kontext:\n{context}\n\n"
            "Bereits vorhandener Text:\n{current_text}\n"
        ),
        "offer_mode_instructions": {
            "cover_intro": "Schreibe einen kurzen Deckblatt-Introtext (2-4 Sätze).",
            "overview": "Schreibe einen kurzen Überblick für den Kunden (2-4 Sätze oder kurze Stichpunkte).",
            "calculation": "Schreibe kurze Hinweise zur Kalkulation (1-3 Sätze).",
            "position_text": (
                "Erstelle einen sehr kurzen, professionellen Positionstext "
                "(1-2 kurze Sätze). Integriere Aufgaben-Titel und Notiz "
                "klar und sachlich. Kein Aufsatz, keine Einleitung."
            ),
            "invoice_position_text": (
                "Erstelle einen abrechenbaren Text fuer eine Rechnungsposition in sevdesk. "
                "Schreibe auf Deutsch, sachlich, konkret und kundenlesbar. "
                "Beschreibe die ausgefuehrte Leistung und das Ergebnis, nicht die interne Aufgabe. "
                "Keine Woerter wie Aufgabe, Notiz, Ticket, Betreff, intern, Analyse oder erledigt. "
                "Keine Begruessung, keine Aufzaehlung, keine Markdown-Formatierung. "
                "Maximal 2 kurze Saetze, bevorzugt 1 Satz. "
                "Wenn moeglich, mit technischem Ergebnis oder Nutzen abschliessen."
            ),
            "device_description": "Schreibe eine kurze Produktbeschreibung für Material (3-6 Sätze).",
        },
        "contract_header_html": (
            "<div style=\"margin-bottom:10px; padding:10px 12px; border:1px solid #dbe4ef; border-radius:12px; "
            "background:#f8fafc; color:#1e3a5f;\">"
            "<div style=\"font-size:11px; letter-spacing:0.08em; text-transform:uppercase; font-weight:600;\">"
            "Vertragliche Leistungsbeschreibung"
            "</div>"
            "<div style=\"margin-top:4px; font-size:12px; color:#334155;\">"
            "Dieser Vertrag beschreibt klar, welche Leistungen enthalten sind und welche nicht. "
            "Maßgeblich sind ausschließlich die schriftlich vereinbarten Regelungen in diesem Dokument."
            "</div>"
            "</div>"
        ),
        "contract_footer_html": (
            "<div style=\"margin-top:12px; padding:10px 12px; border:1px solid #e2e8f0; border-radius:12px; "
            "background:#f8fafc; color:#475569; font-size:11px;\">"
            "<p style=\"margin:0 0 6px;\">"
            "Hinweis: Die Leistungen werden als Dienstleistung nach bestem Wissen und Stand der Technik erbracht. "
            "Die Haftung richtet sich - soweit gesetzlich zulässig - auf Vorsatz und grobe Fahrlässigkeit; "
            "weitere Haftungsregelungen ergeben sich aus den vereinbarten AGB."
            "</p>"
            "<p style=\"margin:0;\">"
            "Änderungen, Nebenabreden und Erweiterungen bedürfen der Textform. "
            "Sollten einzelne Regelungen unwirksam sein, bleibt der Vertrag im Übrigen wirksam "
            "(salvatorische Klausel)."
            "</p>"
            "</div>"
        ),
        "contract_templates": _default_contract_templates_v2(),
        "contract_variables": {},
        "contract_variable_definitions": {},
    }


def _get_ai_prompt_settings(db) -> AiPromptSettings:
    store = db.query(AiPromptSettings).first()
    if not store:
        store = AiPromptSettings(data_json=json.dumps(_default_ai_prompts()))
        db.add(store)
        db.commit()
        db.refresh(store)
    return store


ALLOWED_CONTRACT_DOC_TYPES = {"wartung", "monitoring", "avv_dsgvo"}
CONTRACT_DOC_TYPE_ALIASES = {
    "vertrag": "wartung",
    "it_servicevertrag": "wartung",
    "it-servicevertrag": "wartung",
    "servicevertrag": "wartung",
    "wartungsvertrag": "wartung",
    "monitoringvertrag": "monitoring",
    "avv": "avv_dsgvo",
    "dsgvo": "avv_dsgvo",
    "auftragsverarbeitungsvertrag": "avv_dsgvo",
}


def _normalize_contract_doc_type(value: Any, *, default: str = "wartung") -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return default
    key = CONTRACT_DOC_TYPE_ALIASES.get(raw, raw)
    if key.startswith("wartung_"):
        return "wartung"
    if key.startswith("monitoring_"):
        return "monitoring"
    if key.startswith("avv_dsgvo_") or key.startswith("avv_") or key.startswith("dsgvo_"):
        return "avv_dsgvo"
    return key if key in ALLOWED_CONTRACT_DOC_TYPES else default


def _normalize_contract_template_key(value: Any, *, fallback: str = "wartung") -> str:
    normalized = re.sub(r"[^a-z0-9_]+", "_", str(value or "").strip().lower()).strip("_")
    return normalized or fallback


def _resolve_contract_doc_type_from_template(
    template_key: Any,
    template_entry: Optional[Dict[str, Any]] = None,
    *,
    default: str = "wartung",
) -> str:
    if isinstance(template_entry, dict):
        explicit = _normalize_contract_doc_type(template_entry.get("doc_type"), default="")
        if explicit:
            return explicit
    return _normalize_contract_doc_type(template_key, default=default)


def _normalize_contract_variable_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", str(value or "").strip().lower()).strip("_")


def _to_bool_flag(value: Any, *, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    raw = str(value or "").strip().lower()
    if raw in {"1", "true", "yes", "ja", "on"}:
        return True
    if raw in {"0", "false", "no", "nein", "off"}:
        return False
    return default


_CONTRACT_RUNTIME_PLACEHOLDERS: Set[str] = {
    "provider_name",
    "provider_address",
    "provider_email",
    "provider_contact_line",
    "customer_name",
    "customer_number",
    "customer_short_code",
    "customer_email",
    "customer_street",
    "customer_postal_code",
    "customer_city",
    "customer_country",
    "customer_address",
    "generated_at",
    "valid_from",
    "contract_start",
    "runtime_months",
    "minimum_term_months",
    "extension_period",
    "auto_extension_months",
    "termination_notice_months",
    "termination_notice",
    "servers",
    "clients",
    "network_devices",
    "iot_devices",
    "monthly_total",
    "yearly_total",
    "monthly_hours_included",
    "service_scope",
}


def _normalize_contract_variable_definitions(
    raw_definitions: Any,
    fallback_values: Optional[Dict[str, Any]] = None,
) -> Dict[str, Dict[str, Any]]:
    merged: Dict[str, Dict[str, Any]] = {}
    if isinstance(fallback_values, dict):
        for raw_key, raw_value in fallback_values.items():
            key = _normalize_contract_variable_key(raw_key)
            if not key or key in _CONTRACT_RUNTIME_PLACEHOLDERS:
                continue
            merged[key] = {
                "value": str(raw_value or ""),
                "customer_editable": False,
                "label": key,
            }
    if isinstance(raw_definitions, dict):
        for raw_key, raw_value in raw_definitions.items():
            key = _normalize_contract_variable_key(raw_key)
            if not key or key in _CONTRACT_RUNTIME_PLACEHOLDERS:
                continue
            current = merged.get(key) or {
                "value": "",
                "customer_editable": False,
                "label": key,
            }
            if isinstance(raw_value, dict):
                raw_value_value = raw_value.get("value")
                if raw_value_value is None:
                    raw_value_value = raw_value.get("default")
                if raw_value_value is None:
                    raw_value_value = raw_value.get("suggested_value")
                if raw_value_value is None:
                    raw_value_value = current.get("value", "")
                raw_label = str(raw_value.get("label") or "").strip() or str(current.get("label") or key).strip() or key
                raw_customer_editable = raw_value.get("customer_editable")
                if raw_customer_editable is None:
                    raw_customer_editable = raw_value.get("customerEditable")
                merged[key] = {
                    "value": str(raw_value_value or ""),
                    "customer_editable": _to_bool_flag(raw_customer_editable, default=False),
                    "label": raw_label,
                }
            else:
                merged[key] = {
                    "value": str(raw_value or ""),
                    "customer_editable": _to_bool_flag(current.get("customer_editable"), default=False),
                    "label": str(current.get("label") or key).strip() or key,
                }
    normalized: Dict[str, Dict[str, Any]] = {}
    for key in sorted(merged.keys()):
        entry = merged.get(key) or {}
        normalized[key] = {
            "value": str(entry.get("value") or ""),
            "customer_editable": _to_bool_flag(entry.get("customer_editable"), default=False),
            "label": str(entry.get("label") or key).strip() or key,
        }
    return normalized


def _flatten_contract_variable_definitions(
    definitions: Optional[Dict[str, Dict[str, Any]]],
) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if not isinstance(definitions, dict):
        return out
    for raw_key, raw_entry in definitions.items():
        key = _normalize_contract_variable_key(raw_key)
        if not key or key in _CONTRACT_RUNTIME_PLACEHOLDERS:
            continue
        entry = raw_entry if isinstance(raw_entry, dict) else {}
        out[key] = str(entry.get("value") or "")
    return out


def _offer_iso_timestamp(ms: int) -> str:
    if not ms:
        return ""
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def serialize_ai_prompts(store: AiPromptSettings) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if store.data_json:
        try:
            parsed = json.loads(store.data_json)
            if isinstance(parsed, dict):
                data = parsed
        except ValueError:
            data = {}
    defaults = _default_ai_prompts()
    mode_defaults = defaults.get("offer_mode_instructions") or {}
    mode_data = data.get("offer_mode_instructions")
    if isinstance(mode_data, dict):
        merged_modes = {**mode_defaults, **mode_data}
    else:
        merged_modes = mode_defaults
    contract_defaults = defaults.get("contract_templates") or {}
    contract_data = data.get("contract_templates")
    merged_contract_templates: Dict[str, Dict[str, str]] = {}
    keys: Set[str] = set()
    keys.update([str(key).strip() for key in contract_defaults.keys() if str(key).strip()])
    if isinstance(contract_data, dict):
        keys.update([str(key).strip() for key in contract_data.keys() if str(key).strip()])
    for key in sorted(keys):
        default_entry = contract_defaults.get(key) if isinstance(contract_defaults.get(key), dict) else {}
        current_entry = contract_data.get(key) if isinstance(contract_data, dict) else {}
        if not isinstance(current_entry, dict):
            legacy_key = next(
                (
                    existing_key
                    for existing_key in (contract_data.keys() if isinstance(contract_data, dict) else [])
                    if _normalize_contract_doc_type(existing_key, default="") == key
                ),
                "",
            )
            current_entry = contract_data.get(legacy_key) if legacy_key and isinstance(contract_data, dict) else {}
        if not isinstance(current_entry, dict):
            current_entry = {}
        merged_contract_templates[key] = {
            "title": str(current_entry.get("title") or default_entry.get("title") or "").strip(),
            "description": str(
                current_entry.get("description") or default_entry.get("description") or ""
            ).strip(),
            "doc_type": _normalize_contract_doc_type(
                current_entry.get("doc_type") or default_entry.get("doc_type"),
                default=_normalize_contract_doc_type(key, default=""),
            ),
            "header_html": str(current_entry.get("header_html") or default_entry.get("header_html") or ""),
            "body_template": str(
                current_entry.get("body_template") or default_entry.get("body_template") or ""
            ),
            "footer_html": str(current_entry.get("footer_html") or default_entry.get("footer_html") or ""),
        }
    
    defaults_contract_variables = (
        defaults.get("contract_variables") if isinstance(defaults.get("contract_variables"), dict) else {}
    )
    current_contract_variables = (
        data.get("contract_variables") if isinstance(data.get("contract_variables"), dict) else {}
    )
    defaults_contract_variable_definitions = (
        defaults.get("contract_variable_definitions")
        if isinstance(defaults.get("contract_variable_definitions"), dict)
        else {}
    )
    current_contract_variable_definitions = (
        data.get("contract_variable_definitions")
        if isinstance(data.get("contract_variable_definitions"), dict)
        else {}
    )
    merged_contract_variable_definitions = _normalize_contract_variable_definitions(
        {**defaults_contract_variable_definitions, **current_contract_variable_definitions},
        fallback_values={**defaults_contract_variables, **current_contract_variables},
    )
    merged_contract_variables = _flatten_contract_variable_definitions(merged_contract_variable_definitions)
    return {
        "action_prompt": data.get("action_prompt", defaults["action_prompt"]),
        "offer_base_prompt": data.get("offer_base_prompt", defaults["offer_base_prompt"]),
        "offer_mode_instructions": merged_modes,
        "contract_header_html": str(
            data.get("contract_header_html")
            or defaults.get("contract_header_html")
            or ""
        ),
        "contract_footer_html": str(
            data.get("contract_footer_html")
            or defaults.get("contract_footer_html")
            or ""
        ),
        "contract_templates": merged_contract_templates,
        "contract_variables": merged_contract_variables,
        "contract_variable_definitions": merged_contract_variable_definitions,
        "updated_at": _offer_iso_timestamp(store.updated_at),
    }


def _migrate_contract_templates_to_supported_types() -> None:
    defaults = _default_ai_prompts()
    default_templates = defaults.get("contract_templates") if isinstance(defaults.get("contract_templates"), dict) else {}
    default_keys = set(default_templates.keys())
    legacy_keys = {"vertrag", "sonstiges"}
    if not default_keys:
        return
    with SessionLocal() as db:
        store = _get_ai_prompt_settings(db)
        payload = serialize_ai_prompts(store)
        raw_data: Dict[str, Any] = {}
        if store.data_json:
            try:
                parsed = json.loads(store.data_json)
                if isinstance(parsed, dict):
                    raw_data = parsed
            except ValueError:
                raw_data = {}
        raw_templates = raw_data.get("contract_templates") if isinstance(raw_data.get("contract_templates"), dict) else {}
        raw_keys = {str(key).strip() for key in raw_templates.keys() if str(key).strip()}
        normalized_keys = {_normalize_contract_doc_type(key, default="") for key in raw_keys}
        needs_migration = bool(raw_keys & legacy_keys) or not default_keys.issubset(normalized_keys)
        if not needs_migration:
            return
        updated_payload = {
            "action_prompt": payload.get("action_prompt") or defaults.get("action_prompt") or "",
            "offer_base_prompt": payload.get("offer_base_prompt") or defaults.get("offer_base_prompt") or "",
            "offer_mode_instructions": payload.get("offer_mode_instructions") or defaults.get("offer_mode_instructions") or {},
            "contract_header_html": defaults.get("contract_header_html") or "",
            "contract_footer_html": defaults.get("contract_footer_html") or "",
            "contract_templates": default_templates,
            "contract_variables": payload.get("contract_variables") or defaults.get("contract_variables") or {},
            "contract_variable_definitions": (
                payload.get("contract_variable_definitions")
                or defaults.get("contract_variable_definitions")
                or {}
            ),
        }
        store.data_json = json.dumps(updated_payload)
        store.updated_at = int(time.time() * 1000)
        db.commit()


def _refresh_contract_templates_professional_defaults_v2() -> None:
    legacy_templates = _default_contract_templates_v1()
    default_templates = _default_contract_templates_v2()
    with SessionLocal() as db:
        store = _get_ai_prompt_settings(db)
        payload = serialize_ai_prompts(store)
        current_templates = (
            payload.get("contract_templates") if isinstance(payload.get("contract_templates"), dict) else {}
        )
        updated_templates: Dict[str, Dict[str, str]] = {
            key: _normalize_contract_template_entry(value) for key, value in current_templates.items()
        }
        changed = False
        for key, default_entry in default_templates.items():
            current_entry = updated_templates.get(key) or {}
            legacy_entry = legacy_templates.get(key) or {}
            current_body = str(current_entry.get("body_template") or "").strip()
            if (not current_body and not str(current_entry.get("title") or "").strip()) or _contract_template_entries_equal(
                current_entry,
                legacy_entry,
            ):
                updated_templates[key] = _normalize_contract_template_entry(default_entry)
                changed = True
        if not changed:
            return
        updated_payload = {
            "action_prompt": payload.get("action_prompt") or "",
            "offer_base_prompt": payload.get("offer_base_prompt") or "",
            "offer_mode_instructions": payload.get("offer_mode_instructions") or {},
            "contract_header_html": payload.get("contract_header_html") or "",
            "contract_footer_html": payload.get("contract_footer_html") or "",
            "contract_templates": updated_templates,
            "contract_variables": payload.get("contract_variables") or {},
            "contract_variable_definitions": payload.get("contract_variable_definitions") or {},
        }
        store.data_json = json.dumps(updated_payload)
        store.updated_at = int(time.time() * 1000)
        db.commit()


_run_db_startup_step(
    "migrate_contract_templates_to_supported_types",
    _migrate_contract_templates_to_supported_types,
)

_run_db_startup_step(
    "refresh_contract_templates_professional_defaults_v2",
    _refresh_contract_templates_professional_defaults_v2,
)


def _render_prompt(template: str, values: Dict[str, str]) -> str:
    text = template or ""
    for key, value in values.items():
        text = text.replace(f"{{{key}}}", value)
    return text


_CONTRACT_PLACEHOLDER_PATTERN = re.compile(r"\{([a-zA-Z0-9_]+)\}")
_CONTRACT_FALLBACK_VALUES: Dict[str, str] = {
    "service_hours": "Montag bis Freitag, 08:00-17:00 Uhr (werktags)",
    "reaction_time": "innerhalb von 8 Arbeitsstunden",
    "hourly_rate_extra": "120,00 EUR pro Stunde",
    "billing_interval": "monatlich",
    "additional_systems": "keine",
    "monitoring_enabled": "ja",
    "backup_monitoring": "nach Vereinbarung",
    "patch_management": "ja (sicherheitsrelevant)",
    "security_monitoring": "ja (Basis)",
    "extension_period": "12",
    "termination_notice": "3 Monate",
    "liability_limit": "gemäß AGB",
}

def _render_contract_template(template: str, values: Dict[str, str]) -> str:
    rendered = _render_prompt(template or "", values)

    def _replace_missing(match: re.Match[str]) -> str:
        key = str(match.group(1) or "").strip().lower()
        if not key:
            return ""
        return escape(str(_CONTRACT_FALLBACK_VALUES.get(key, "—")))

    return _CONTRACT_PLACEHOLDER_PATTERN.sub(_replace_missing, rendered)


def _extract_contract_placeholders(*templates: str) -> List[str]:
    seen: Set[str] = set()
    ordered: List[str] = []
    for template in templates:
        for match in _CONTRACT_PLACEHOLDER_PATTERN.finditer(str(template or "")):
            key = str(match.group(1) or "").strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            ordered.append(key)
    return ordered


def _normalize_contract_liability_section(rendered_html: str) -> str:
    html = str(rendered_html or "")
    html = re.sub(
        r"(?is)<p[^>]*>\s*Keine\s+Haftung\s+besteht[^<:]*:\s*</p>\s*<ul[^>]*>.*?</ul>",
        "<p>Weitere Haftungsregelungen und Ausschlüsse richten sich nach den vereinbarten AGB.</p>",
        html,
    )
    html = re.sub(
        r"(?is)<p[^>]*>\s*Haftungsh[^<]*grenze[^<]*</p>",
        "<p>Weitere Haftungsregelungen und Haftungshöchstgrenzen richten sich nach den vereinbarten AGB.</p>",
        html,
    )
    return html


def _format_contract_currency(value: float) -> str:
    amount = float(value or 0.0)
    total_cents = int(round(abs(amount) * 100))
    whole = total_cents // 100
    cents = total_cents % 100
    whole_text = f"{whole:,}".replace(",", ".")
    sign = "-" if amount < 0 else ""
    return f"{sign}{whole_text},{cents:02d} EUR"


def _format_contract_hours(value: float) -> str:
    hours = float(value or 0.0)
    whole = int(abs(hours))
    frac = int(round((abs(hours) - whole) * 100))
    if frac >= 100:
        whole += 1
        frac = 0
    sign = "-" if hours < 0 else ""
    return f"{sign}{whole},{frac:02d} h"


def _normalize_contract_storage_date(value: Any, *, fallback_dt: Optional[datetime] = None) -> str:
    raw = str(value or "").strip()
    if not raw:
        if fallback_dt:
            return fallback_dt.strftime("%Y-%m-%d")
        return ""
    parsed = _parse_sevdesk_date(raw)
    if parsed:
        return parsed.strftime("%Y-%m-%d")
    return raw


def _format_contract_display_date(value: Any, *, fallback: str = "") -> str:
    raw = str(value or "").strip()
    if not raw:
        return str(fallback or "").strip()
    parsed = _parse_sevdesk_date(raw)
    if parsed:
        return parsed.strftime("%d.%m.%Y")
    return raw


def _resolve_contract_provider_meta(settings: Optional[IntegrationSettings]) -> Dict[str, str]:
    company_name = str(getattr(settings, "company", "") or "").strip()
    sender_name = str(getattr(settings, "sender_name", "") or "").strip()
    sender_email = str(getattr(settings, "sender_email", "") or "").strip()
    office_address = str(getattr(settings, "office_address", "") or "").strip()
    provider_name = company_name or sender_name or "Ihr IT-Dienstleister"
    return {
        "provider_name": provider_name,
        "provider_address": office_address,
        "provider_email": sender_email,
        "provider_contact_line": sender_email,
    }


def _render_contract_html(
    *,
    customer: Customer,
    title: str,
    template_key: str,
    header_html: str,
    body_template: str,
    footer_html: str,
    placeholders: Dict[str, str],
) -> str:
    rendered_body = _normalize_contract_liability_section(
        _render_contract_template(body_template or "", placeholders)
    )
    rendered_header = _render_contract_template(header_html or "", placeholders)
    rendered_footer = _render_contract_template(footer_html or "", placeholders)
    header_block = (
        "<div style=\"margin-bottom:12px;\">"
        f"{rendered_header}"
        "</div>"
        if str(rendered_header or "").strip()
        else ""
    )
    footer_block = (
        "<div style=\"margin-top:12px;\">"
        f"{rendered_footer}"
        "</div>"
        if str(rendered_footer or "").strip()
        else ""
    )
    customer_address = _customer_address_text(_customer_effective_address(customer))
    customer_address = re.sub(r"\s+", " ", customer_address)
    customer_display = escape(str(customer.name or "").strip() or "Kunde")
    template_label = escape((template_key or "wartung").replace("_", " ").upper())
    generated_at = escape(str(placeholders.get("generated_at", "")).strip())
    valid_from = escape(str(placeholders.get("valid_from", "")).strip())
    provider_name = escape(str(placeholders.get("provider_name", "")).strip() or "Ihr IT-Dienstleister")
    provider_address = escape(str(placeholders.get("provider_address", "")).strip() or "Keine Anbieteradresse hinterlegt")
    provider_contact_line = escape(str(placeholders.get("provider_contact_line", "")).strip())
    customer_address_display = escape(customer_address) if customer_address else "Keine Adresse hinterlegt"
    return (
        "<style>"
        "@page { size: A4 portrait; margin: 12mm; }"
        "* { box-sizing: border-box; }"
        ".contract-document { font-family:\"DejaVu Sans\", \"Noto Sans\", Arial, sans-serif; color:#0f172a; line-height:1.56; font-size:11pt; background:#f1f5f9; padding:14px; }"
        ".contract-sheet { max-width:190mm; margin:0 auto; background:#ffffff; border:1px solid #dbe4ef; border-radius:14px; padding:12mm; box-shadow:0 10px 22px rgba(15, 23, 42, 0.06); }"
        ".contract-header { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; border-bottom:1px solid #e2e8f0; padding-bottom:10px; margin-bottom:12px; }"
        ".contract-logo { height:44px; width:auto; object-fit:contain; display:block; }"
        ".contract-chip { display:inline-block; border:1px solid #dbe4ef; background:#f8fafc; color:#1e3a5f; padding:4px 9px; border-radius:999px; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; }"
        ".contract-created-at { margin-top:8px; font-size:11px; color:#64748b; text-align:right; }"
        ".contract-title { margin:0 0 6px; font-size:26px; line-height:1.16; color:#0b1324; }"
        ".contract-subline { font-size:12px; color:#475569; margin:0 0 14px; }"
        ".contract-meta-grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:10px; margin:0 0 14px; }"
        ".contract-card { border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; background:#f8fafc; }"
        ".contract-card-label { font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:#94a3b8; margin-bottom:5px; }"
        ".contract-card-main { font-size:12px; color:#0f172a; font-weight:600; }"
        ".contract-card-sub { font-size:11px; color:#64748b; margin-top:4px; }"
        ".contract-body { border:1px solid #e2e8f0; border-radius:12px; padding:14px; background:#ffffff; }"
        ".contract-body p { margin:0 0 10px; color:#1f2937; }"
        ".contract-body h3 { margin:14px 0 6px; font-size:13.5px; line-height:1.3; color:#0f172a; page-break-after:avoid; break-after:avoid; }"
        ".contract-body h3 + p, .contract-body h3 + ul, .contract-body h3 + ol { page-break-before:avoid; break-before:avoid; }"
        ".contract-body ul, .contract-body ol { margin:0 0 10px; padding-left:20px; }"
        ".contract-body li { margin:0 0 5px; page-break-inside:avoid; break-inside:avoid; }"
        ".contract-footer { margin-top:12px; }"
        ".contract-signatures { margin-top:20px; display:grid; grid-template-columns:1fr 1fr; gap:16px; }"
        ".contract-signature { border-top:1px solid #cbd5e1; padding-top:9px; font-size:11px; color:#64748b; }"
        ".contract-no-break { page-break-inside:avoid; break-inside:avoid; }"
        ".contract-page-break { page-break-before:always; break-before:page; }"
        "@media (max-width: 900px) {"
        "  .contract-meta-grid, .contract-signatures { grid-template-columns:1fr; }"
        "  .contract-document { padding:8px; }"
        "}"
        "@media print {"
        "  .contract-document { background:#ffffff; padding:0; }"
        "  .contract-sheet { max-width:none; border:none; border-radius:0; box-shadow:none; padding:0; }"
        "}"
        "</style>"
        "<div class=\"contract-document\">"
        "<div class=\"contract-sheet\">"
        "<div class=\"contract-header contract-no-break\">"
        "<img src=\"/QTLogo.jpg\" alt=\"Logo\" class=\"contract-logo\" />"
        "<div>"
        f"<div class=\"contract-chip\">{template_label}</div>"
        f"<div class=\"contract-created-at\">Erstellt am: <strong>{generated_at}</strong></div>"
        "</div>"
        "</div>"
        f"<h1 class=\"contract-title\">{escape(title)}</h1>"
        f"<p class=\"contract-subline\">Vertragspartner: <strong>{customer_display}</strong></p>"
        "<div class=\"contract-meta-grid contract-no-break\">"
        "<div class=\"contract-card\">"
        "<div class=\"contract-card-label\">Kunde</div>"
        f"<div class=\"contract-card-main\">{customer_display}</div>"
        f"<div class=\"contract-card-sub\">{customer_address_display}</div>"
        "</div>"
        "<div class=\"contract-card\">"
        "<div class=\"contract-card-label\">Dienstleister</div>"
        f"<div class=\"contract-card-main\">{provider_name}</div>"
        f"<div class=\"contract-card-sub\">{provider_address}</div>"
        + (f"<div class=\"contract-card-sub\">{provider_contact_line}</div>" if str(provider_contact_line or "").strip() else "")
        + "</div>"
        "<div class=\"contract-card\">"
        "<div class=\"contract-card-label\">Vertragsdaten</div>"
        f"<div class=\"contract-card-sub\">Erstellt am: <strong>{generated_at}</strong></div>"
        f"<div class=\"contract-card-sub\">Gültig ab: <strong>{valid_from}</strong></div>"
        "</div>"
        "</div>"
        f"{header_block}"
        "<div class=\"contract-body\">"
        f"{rendered_body}"
        "</div>"
        f"<div class=\"contract-footer\">{footer_block}</div>"
        "<div class=\"contract-signatures contract-no-break\">"
        f"<div class=\"contract-signature\">Ort, Datum, für den Auftraggeber<br><strong>{customer_display}</strong></div>"
        f"<div class=\"contract-signature\">Ort, Datum, für den Auftragnehmer<br><strong>{provider_name}</strong></div>"
        "</div>"
        "</div>"
        "</div>"
    )

def _get_offer_block_store(db) -> OfferBlockStore:
    store = db.query(OfferBlockStore).first()
    if not store:
        store = OfferBlockStore(data_json="{}")
        db.add(store)
        db.commit()
        db.refresh(store)
    return store

def serialize_offer_blocks(store: OfferBlockStore) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if store.data_json:
        try:
            parsed = json.loads(store.data_json)
            if isinstance(parsed, dict):
                data = parsed
        except ValueError:
            data = {}
    return {
        "serviceBlocks": data.get("serviceBlocks", []),
        "deviceBlocks": data.get("deviceBlocks", []),
        "calcBlocks": data.get("calcBlocks", []),
        "updatedAt": _offer_iso_timestamp(store.updated_at),
    }


def _offer_make_reference(number_format: str, index: int) -> str:
    template = (number_format or "AN-XXXX").strip() or "AN-XXXX"
    match = re.search(r"X+", template)
    if not match:
        return template
    width = len(match.group(0))
    number = str(max(1, int(index or 1))).zfill(width)
    start, end = match.span()
    return f"{template[:start]}{number}{template[end:]}"


def _offer_parse_reference_index(reference: str, template: str) -> Optional[int]:
    template_value = (template or "AN-XXXX").strip() or "AN-XXXX"
    match = re.search(r"X+", template_value)
    if not match:
        return None
    prefix = template_value[: match.start()]
    suffix = template_value[match.end() :]
    value = str(reference or "")
    if not value.startswith(prefix) or not value.endswith(suffix):
        return None
    number_part = value[len(prefix) : len(value) - len(suffix)]
    if not number_part or not number_part.isdigit():
        return None
    try:
        return int(number_part)
    except Exception:
        return None


def _offer_next_reference(db, number_format: str) -> str:
    template = (number_format or "AN-XXXX").strip() or "AN-XXXX"
    offers = db.query(Offer.reference).all()
    max_index = 0
    for row in offers:
        reference = str(row[0] or "").strip()
        idx = _offer_parse_reference_index(reference, template)
        if isinstance(idx, int) and idx > max_index:
            max_index = idx
    return _offer_make_reference(template, max_index + 1)


def _ensure_offer_references(db) -> int:
    settings = _get_offer_settings(db)
    number_format = (settings.offer_number_format or "AN-XXXX").strip() or "AN-XXXX"
    offers = db.query(Offer).order_by(Offer.created_at.asc(), Offer.id.asc()).all()
    if not offers:
        return 0
    max_index = 0
    for offer in offers:
        idx = _offer_parse_reference_index(str(offer.reference or ""), number_format)
        if isinstance(idx, int) and idx > max_index:
            max_index = idx
    changed = 0
    now_ms = int(time.time() * 1000)
    for offer in offers:
        if str(offer.reference or "").strip():
            continue
        payload: Dict[str, Any] = {}
        if offer.data_json:
            try:
                parsed = json.loads(offer.data_json)
                if isinstance(parsed, dict):
                    payload = parsed
            except Exception:
                payload = {}
        data_reference = str(payload.get("reference") or "").strip()
        if data_reference:
            offer.reference = data_reference
        else:
            max_index += 1
            offer.reference = _offer_make_reference(number_format, max_index)
            payload["reference"] = offer.reference
        offer.data_json = json.dumps(payload)
        offer.updated_at = now_ms
        changed += 1
    if changed:
        db.commit()
    return changed


def serialize_offer(offer: Offer) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if offer.data_json:
        try:
            parsed = json.loads(offer.data_json)
            if isinstance(parsed, dict):
                data = parsed
        except ValueError:
            data = {}
    if not data.get("id"):
        data["id"] = str(offer.id)
    data["serverId"] = offer.id
    data["confirmGuid"] = offer.guid or data.get("confirmGuid") or ""
    data["reference"] = offer.reference or data.get("reference") or ""
    data["customer"] = offer.customer or data.get("customer") or ""
    data["status"] = offer.status or data.get("status") or ""
    if offer.opened_at and not data.get("openedAt"):
        data["openedAt"] = _offer_iso_timestamp(offer.opened_at)
    if offer.opened_count and not data.get("openedCount"):
        data["openedCount"] = offer.opened_count
    if offer.sent_at and not data.get("sentAt"):
        data["sentAt"] = _offer_iso_timestamp(offer.sent_at)
    if not data.get("createdAt"):
        data["createdAt"] = _offer_iso_timestamp(offer.created_at)
    return data

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

def _get_settings(db) -> IntegrationSettings:
    settings = db.query(IntegrationSettings).first()
    if not settings:
        settings = IntegrationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def _get_marketplace_import_url(db) -> str:
    settings = _get_settings(db)
    url = (settings.marketplace_import_url or "").strip()
    if not url:
        url = os.environ.get("MARKETPLACE_IMPORT_URL", "").strip()
    if not url:
        url = "http://marketplace-import-service:8000"
    if not url:
        raise HTTPException(400, "Marketplace import URL not configured")
    return url.rstrip("/")

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
            elif not (item.get("id") or item.get("phoneBookId") or item.get("identifier")):
                if key in {"phoneBookId", "id", "uuid", "identifier"} and value:
                    item["id"] = value
    name = name or item.get("displayName") or item.get("name") or ""
    number = number or item.get("displayNumber") or item.get("number") or item.get("phoneNumber") or ""
    remote_id = item.get("id") or item.get("phoneBookId") or item.get("identifier") or ""
    if not remote_id:
        href = item.get("href")
        if not href and isinstance(item.get("links"), list):
            for link in item["links"]:
                if isinstance(link, dict) and link.get("href"):
                    href = link.get("href")
                    break
        if href:
            path = urlparse(href).path
            if path:
                candidate = path.rstrip("/").split("/")[-1]
                if candidate:
                    remote_id = candidate
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

def _nfon_phonebook_path(customer_account: str, entry_id: Optional[str] = None, query: str = "") -> str:
    base_path = f"/api/customers/{customer_account}/phone-books"
    if entry_id:
        safe_id = quote(str(entry_id), safe="")
        return f"{base_path}/{safe_id}{query}"
    return f"{base_path}{query}"

def _nfon_phonebook_body(
    name: Optional[str],
    number: Optional[str],
    is_global: Optional[bool] = None,
) -> Dict[str, Any]:
    normalized_number = _normalize_phone_for_store(number) if number else ""
    body = {
        "data": [
            {"name": "displayName", "value": name or ""},
            {"name": "displayNumber", "value": normalized_number},
        ]
    }
    if is_global is not None:
        body["isGlobal"] = bool(is_global)
    return body

def _build_nfon_string_to_sign(
    method: str,
    date: str,
    path: str,
    content_md5: str = "",
    content_type: str = "",
) -> str:
    parts = [method]
    if content_md5:
        parts.append(content_md5)
    if content_type:
        parts.append(content_type)
    parts.append(date)
    parts.append(path)
    return "\n".join(parts)

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
    string_to_sign = _build_nfon_string_to_sign(method, date, path, content_md5, content_type)
    signature = hmac.new(api_key_secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1)
    signature_b64 = base64.b64encode(signature.digest()).decode("utf-8")
    headers = {
        "Authorization": f"NFON-API {api_key_id}:{signature_b64}",
        "x-nfon-date": date,
    }
    if body:
        headers["Content-Type"] = content_type
        headers["Content-MD5"] = content_md5
    request_url = f"{base_url}{path}"
    try:
        response = requests.request(
            method,
            request_url,
            headers=headers,
            data=body if body else None,
            timeout=20,
        )
    except requests.RequestException as exc:
        logger.exception("NFON request failed: %s %s", method, request_url)
        raise HTTPException(
            502,
            {
                "error": "NFON request failed",
                "message": str(exc),
                "request_url": request_url,
                "request_path": path,
                "method": method,
            },
        )
    if not response.ok:
        response_preview = (response.text or "")[:800]
        logger.error(
            "NFON API error: %s %s -> %s %s",
            method,
            request_url,
            response.status_code,
            response_preview,
        )
        raise HTTPException(
            response.status_code,
            {
                "error": "NFON API error",
                "status_code": response.status_code,
                "request_url": request_url,
                "request_path": path,
                "response_preview": response_preview,
            },
        )
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


def _safe_nonnegative_float(value: Any) -> float:
    try:
        return max(0.0, float(value or 0.0))
    except (TypeError, ValueError):
        return 0.0


def _safe_nonnegative_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def _parse_json_object(value: Any, fallback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    fallback_value = dict(fallback or {})
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return fallback_value
        try:
            loaded = json.loads(raw)
        except Exception:
            return fallback_value
        if isinstance(loaded, dict):
            return loaded
    return fallback_value


def serialize_contract_tariff(tariff: ContractTariff) -> Dict[str, Any]:
    return {
        "id": tariff.id,
        "family_key": tariff.family_key,
        "name": tariff.name or "",
        "category": tariff.category or "",
        "version": int(tariff.version or 1),
        "is_active": bool(tariff.is_active),
        "currency": tariff.currency or "EUR",
        "base_price_monthly": round(float(tariff.base_price_monthly or 0), 2),
        "price_server_monthly": round(float(tariff.price_server_monthly or 0), 2),
        "price_client_monthly": round(float(tariff.price_client_monthly or 0), 2),
        "price_network_monthly": round(float(tariff.price_network_monthly or 0), 2),
        "price_iot_monthly": round(float(tariff.price_iot_monthly or 0), 2),
        "hourly_price": round(float(tariff.hourly_price or 0), 2),
        "notes": tariff.notes or "",
        "created_at": int(tariff.created_at or 0),
    }


def _calc_contract_total_monthly(
    tariff: ContractTariff,
    *,
    servers: int,
    clients: int,
    network_devices: int,
    iot_devices: int,
    monthly_hours_included: float = 0.0,
) -> float:
    return (
        _safe_nonnegative_float(tariff.base_price_monthly)
        + _safe_nonnegative_float(tariff.price_server_monthly) * _safe_nonnegative_int(servers)
        + _safe_nonnegative_float(tariff.price_client_monthly) * _safe_nonnegative_int(clients)
        + _safe_nonnegative_float(tariff.price_network_monthly) * _safe_nonnegative_int(network_devices)
        + _safe_nonnegative_float(tariff.price_iot_monthly) * _safe_nonnegative_int(iot_devices)
        + _safe_nonnegative_float(tariff.hourly_price) * _safe_nonnegative_float(monthly_hours_included)
    )


def serialize_customer_contract_calculation(item: CustomerContractCalculation) -> Dict[str, Any]:
    snapshot_payload: Dict[str, Any] = {}
    try:
        loaded = json.loads(item.snapshot_json or "{}")
        if isinstance(loaded, dict):
            snapshot_payload = loaded
    except Exception:
        snapshot_payload = {}
    return {
        "id": item.id,
        "customer_id": item.customer_id,
        "tariff_id": item.tariff_id,
        "tariff_name": item.tariff_name or "",
        "tariff_category": item.tariff_category or "",
        "tariff_version": int(item.tariff_version or 1),
        "servers": int(item.servers or 0),
        "clients": int(item.clients or 0),
        "network_devices": int(item.network_devices or 0),
        "iot_devices": int(item.iot_devices or 0),
        "monthly_total": round(float(item.monthly_total or 0), 2),
        "yearly_total": round(float(item.yearly_total or 0), 2),
        "note": item.note or "",
        "snapshot": snapshot_payload,
        "created_at": int(item.created_at or 0),
    }


def _days_in_month(year: int, month: int) -> int:
    if month == 2:
        leap = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0)
        return 29 if leap else 28
    if month in {4, 6, 9, 11}:
        return 30
    return 31


def _add_months_to_timestamp(timestamp_ms: int, months: int) -> int:
    base = datetime.fromtimestamp(max(0, int(timestamp_ms)) / 1000)
    total_month = int(base.month) - 1 + int(months or 0)
    year = int(base.year) + total_month // 12
    month = total_month % 12 + 1
    day = min(int(base.day), _days_in_month(year, month))
    shifted = base.replace(year=year, month=month, day=day)
    return int(shifted.timestamp() * 1000)


def _parse_contract_start_to_epoch_ms(value: Any) -> int:
    text_value = str(value or "").strip()
    if not text_value:
        return 0
    parsed = _parse_iso8601_to_epoch_ms(text_value)
    if parsed > 0:
        return parsed
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            dt = datetime.strptime(text_value, fmt)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    return 0


def _build_contract_timeline(item: CustomerContractDocument) -> Dict[str, Any]:
    now_ms = int(time.time() * 1000)
    created_at = int(item.created_at or 0)
    start_at = _parse_contract_start_to_epoch_ms(getattr(item, "valid_from", "") or "")
    if start_at <= 0:
        start_at = created_at
    runtime_months = max(1, int(_safe_nonnegative_int(getattr(item, "runtime_months", 12) or 12)))
    notice_months = max(0, int(_safe_nonnegative_int(getattr(item, "termination_notice_months", 3) or 3)))
    extension_months = max(1, int(_safe_nonnegative_int(getattr(item, "auto_extension_months", 12) or 12)))
    term_end_at = _add_months_to_timestamp(start_at, runtime_months)
    cancellation_deadline_at = _add_months_to_timestamp(term_end_at, -notice_months) if notice_months > 0 else term_end_at
    if now_ms <= cancellation_deadline_at:
        next_renewal_at = term_end_at
    else:
        next_renewal_at = _add_months_to_timestamp(term_end_at, extension_months)
    cancelled_effective_at = int(getattr(item, "cancelled_effective_at", 0) or 0)
    return {
        "start_at": int(start_at or 0),
        "runtime_months": runtime_months,
        "termination_notice_months": notice_months,
        "auto_extension_months": extension_months,
        "term_end_at": int(term_end_at or 0),
        "cancellation_deadline_at": int(cancellation_deadline_at or 0),
        "next_renewal_at": int(next_renewal_at or 0),
        "days_to_cancellation_deadline": int(math.ceil((cancellation_deadline_at - now_ms) / 86400000)) if cancellation_deadline_at > 0 else None,
        "days_to_next_renewal": int(math.ceil((next_renewal_at - now_ms) / 86400000)) if next_renewal_at > 0 else None,
        "cancelled_effective_at": cancelled_effective_at,
        "remaining_days_after_cancel": int(math.ceil((cancelled_effective_at - now_ms) / 86400000)) if cancelled_effective_at > 0 else None,
        "stop_service_immediately": bool(getattr(item, "stop_service_immediately", False)),
    }


def serialize_customer_contract_document(item: CustomerContractDocument) -> Dict[str, Any]:
    timeline = _build_contract_timeline(item)
    snapshot_payload = _parse_json_object(getattr(item, "snapshot_json", "{}"))
    pricing_payload = _parse_json_object(snapshot_payload.get("pricing"))
    counts_payload = _parse_json_object(snapshot_payload.get("counts"))
    tariff_payload = snapshot_payload.get("tariff")
    if not isinstance(tariff_payload, dict):
        tariff_payload = None
    contract_variable_values = _parse_json_object(snapshot_payload.get("contract_variable_values"))
    return {
        "id": item.id,
        "customer_id": item.customer_id,
        "title": item.title or "",
        "doc_type": item.doc_type or "wartung",
        "status": item.status or "active",
        "file_name": item.file_name or "",
        "mime_type": item.mime_type or "application/pdf",
        "template_key": item.template_key or "",
        "monthly_hours_included": round(float(item.monthly_hours_included or 0.0), 2),
        "valid_from": str(getattr(item, "valid_from", "") or ""),
        "runtime_months": int(_safe_nonnegative_int(getattr(item, "runtime_months", 12) or 12)),
        "termination_notice_months": int(_safe_nonnegative_int(getattr(item, "termination_notice_months", 3) or 3)),
        "auto_extension_months": int(_safe_nonnegative_int(getattr(item, "auto_extension_months", 12) or 12)),
        "tariff": tariff_payload,
        "counts": {
            "servers": int(_safe_nonnegative_int(counts_payload.get("servers"))),
            "clients": int(_safe_nonnegative_int(counts_payload.get("clients"))),
            "network_devices": int(_safe_nonnegative_int(counts_payload.get("network_devices"))),
            "iot_devices": int(_safe_nonnegative_int(counts_payload.get("iot_devices"))),
        },
        "pricing": {
            "monthly_total": round(float(pricing_payload.get("monthly_total") or 0.0), 2),
            "yearly_total": round(float(pricing_payload.get("yearly_total") or 0.0), 2),
            "suggested_monthly_total": round(float(pricing_payload.get("suggested_monthly_total") or 0.0), 2),
            "suggested_yearly_total": round(float(pricing_payload.get("suggested_yearly_total") or 0.0), 2),
            "individual_price_applied": bool(pricing_payload.get("individual_price_applied", False)),
        },
        "contract_variable_values": contract_variable_values,
        "snapshot": snapshot_payload,
        "has_html": bool(str(item.html_content or "").strip()),
        "html_content": item.html_content or "",
        "note": item.note or "",
        "cancel_reason": item.cancel_reason or "",
        "cancelled_at": int(item.cancelled_at or 0),
        "cancelled_effective_at": int(getattr(item, "cancelled_effective_at", 0) or 0),
        "stop_service_immediately": bool(getattr(item, "stop_service_immediately", False)),
        "created_at": int(item.created_at or 0),
        "timeline": timeline,
    }


def _contract_recurring_cost_key(value: Any) -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_")
    if normalized == "wartung":
        return "contract_wartung"
    if normalized == "monitoring":
        return "contract_monitoring"
    if normalized in {"avv", "avv_dsgvo", "dsgvo"}:
        return "contract_compliance"
    return "contract_wartung"


def _contract_document_monthly_cost(item: CustomerContractDocument) -> float:
    snapshot_payload = _parse_json_object(getattr(item, "snapshot_json", "{}"))
    pricing_payload = _parse_json_object(snapshot_payload.get("pricing"))
    monthly_total = _safe_nonnegative_float(pricing_payload.get("monthly_total"))
    if monthly_total > 0:
        return round(monthly_total, 2)
    suggested_monthly_total = _safe_nonnegative_float(pricing_payload.get("suggested_monthly_total"))
    if suggested_monthly_total > 0:
        return round(suggested_monthly_total, 2)
    yearly_total = _safe_nonnegative_float(pricing_payload.get("yearly_total"))
    if yearly_total > 0:
        return round(yearly_total / 12.0, 2)
    suggested_yearly_total = _safe_nonnegative_float(pricing_payload.get("suggested_yearly_total"))
    if suggested_yearly_total > 0:
        return round(suggested_yearly_total / 12.0, 2)
    return 0.0


def _inventory_event_recurring_cost_item(
    item: CustomerInventoryEvent,
    customer_name: str,
    customer_number: str,
) -> Optional[Dict[str, Any]]:
    monthly_cost = round(_safe_nonnegative_float(getattr(item, "monthly_cost_eur", 0.0)), 2)
    if monthly_cost <= 0:
        return None
    tags = _parse_tags_json(getattr(item, "tags_json", "[]"))
    category_key = _normalize_recurring_cost_category(
        getattr(item, "cost_category", "") or getattr(item, "event_type", ""),
        fallback_text=" ".join(
            [
                str(item.device_label or ""),
                str(item.provider or ""),
                str(item.event_type or ""),
                str(item.note or ""),
                " ".join(tags),
            ]
        ),
    )
    category_meta = _recurring_cost_category_meta(category_key)
    title = str(item.device_label or "").strip() or category_meta["label"]
    return {
        "source": "inventory",
        "customerId": int(item.customer_id or 0),
        "customerName": customer_name,
        "customerNumber": customer_number,
        "itemId": int(item.id or 0),
        "title": title,
        "provider": str(item.provider or "").strip(),
        "categoryKey": category_key,
        "categoryLabel": category_meta["label"],
        "group": category_meta["group"],
        "monthlyEur": monthly_cost,
        "yearlyEur": round(monthly_cost * 12.0, 2),
        "billingCycle": str(item.billing_cycle or "monthly").strip() or "monthly",
        "tags": tags,
        "note": str(item.note or "").strip(),
        "isExternal": bool(item.is_external),
    }


def _contract_document_recurring_cost_item(
    item: CustomerContractDocument,
    customer_name: str,
    customer_number: str,
) -> Optional[Dict[str, Any]]:
    status = str(getattr(item, "status", "") or "").strip().lower()
    if status != "active":
        return None
    monthly_cost = _contract_document_monthly_cost(item)
    if monthly_cost <= 0:
        return None
    category_key = _contract_recurring_cost_key(getattr(item, "doc_type", "") or getattr(item, "template_key", ""))
    category_meta = _recurring_cost_category_meta(category_key)
    title = str(item.title or "").strip() or category_meta["label"]
    return {
        "source": "contract",
        "customerId": int(item.customer_id or 0),
        "customerName": customer_name,
        "customerNumber": customer_number,
        "itemId": int(item.id or 0),
        "title": title,
        "provider": "QT Workbench",
        "categoryKey": category_key,
        "categoryLabel": category_meta["label"],
        "group": category_meta["group"],
        "monthlyEur": monthly_cost,
        "yearlyEur": round(monthly_cost * 12.0, 2),
        "billingCycle": "monthly",
        "tags": ["vertrag", str(getattr(item, "doc_type", "") or "").strip().lower()],
        "note": str(item.note or "").strip(),
        "isExternal": False,
    }


def _collect_recurring_cost_items(
    db: Session,
    customer_rows: List[Customer],
) -> List[Dict[str, Any]]:
    if not customer_rows:
        return []
    customer_ids = [int(customer.id) for customer in customer_rows if int(customer.id or 0) > 0]
    if not customer_ids:
        return []
    customer_meta = {
        int(customer.id): {
            "name": str(customer.name or "").strip() or f"Kunde #{customer.id}",
            "number": str(customer.creditor_number or customer.short_code or "").strip(),
        }
        for customer in customer_rows
        if int(customer.id or 0) > 0
    }
    items: List[Dict[str, Any]] = []
    inventory_rows = (
        db.query(CustomerInventoryEvent)
        .filter(CustomerInventoryEvent.customer_id.in_(customer_ids))
        .filter(
            or_(
                CustomerInventoryEvent.is_recurring == True,
                CustomerInventoryEvent.event_type.like("contract_%"),
            )
        )
        .all()
    )
    for row in inventory_rows:
        meta = customer_meta.get(int(row.customer_id or 0))
        if not meta:
            continue
        item_payload = _inventory_event_recurring_cost_item(
            row,
            meta["name"],
            meta["number"],
        )
        if item_payload:
            items.append(item_payload)
    contract_rows = (
        db.query(CustomerContractDocument)
        .filter(CustomerContractDocument.customer_id.in_(customer_ids))
        .all()
    )
    for row in contract_rows:
        meta = customer_meta.get(int(row.customer_id or 0))
        if not meta:
            continue
        item_payload = _contract_document_recurring_cost_item(
            row,
            meta["name"],
            meta["number"],
        )
        if item_payload:
            items.append(item_payload)
    items.sort(
        key=lambda entry: (
            -float(entry.get("monthlyEur") or 0.0),
            str(entry.get("customerName") or "").lower(),
            str(entry.get("title") or "").lower(),
        )
    )
    return items


def _empty_recurring_cost_overview() -> Dict[str, Any]:
    return {
        "monthlyTotalEur": 0.0,
        "yearlyTotalEur": 0.0,
        "licenseMonthlyEur": 0.0,
        "otherRecurringMonthlyEur": 0.0,
        "contractMonthlyEur": 0.0,
        "customersCount": 0,
        "itemCount": 0,
        "categoryTotals": [],
        "customerRows": [],
    }


def _build_recurring_costs_overview(
    db: Session,
    *,
    customer_id: Optional[int] = None,
    include_inactive: bool = False,
) -> Dict[str, Any]:
    customer_query = db.query(Customer)
    if customer_id:
        customer_query = customer_query.filter(Customer.id == customer_id)
    elif not include_inactive:
        customer_query = customer_query.filter(func.lower(func.coalesce(Customer.status, "active")) != "inactive")
    customer_rows = customer_query.all()
    if not customer_rows:
        return _empty_recurring_cost_overview()
    items = _collect_recurring_cost_items(db, customer_rows)
    if not items:
        return _empty_recurring_cost_overview()

    overview = _empty_recurring_cost_overview()
    category_totals: Dict[str, Dict[str, Any]] = {}
    customer_totals: Dict[int, Dict[str, Any]] = {}

    for item in items:
        customer_key = int(item.get("customerId") or 0)
        monthly_value = round(float(item.get("monthlyEur") or 0.0), 2)
        yearly_value = round(float(item.get("yearlyEur") or 0.0), 2)
        if monthly_value <= 0 or customer_key <= 0:
            continue

        overview["monthlyTotalEur"] = round(overview["monthlyTotalEur"] + monthly_value, 2)
        overview["yearlyTotalEur"] = round(overview["yearlyTotalEur"] + yearly_value, 2)
        overview["itemCount"] += 1
        group = str(item.get("group") or "other")
        if group == "contract":
            overview["contractMonthlyEur"] = round(overview["contractMonthlyEur"] + monthly_value, 2)
        elif group == "license":
            overview["licenseMonthlyEur"] = round(overview["licenseMonthlyEur"] + monthly_value, 2)
        else:
            overview["otherRecurringMonthlyEur"] = round(overview["otherRecurringMonthlyEur"] + monthly_value, 2)

        category_key = str(item.get("categoryKey") or "other")
        category_entry = category_totals.get(category_key)
        if not category_entry:
            meta = _recurring_cost_category_meta(category_key)
            category_entry = {
                "key": category_key,
                "label": meta["label"],
                "group": meta["group"],
                "monthlyEur": 0.0,
                "yearlyEur": 0.0,
                "itemCount": 0,
                "customerIds": set(),
            }
        category_entry["monthlyEur"] = round(category_entry["monthlyEur"] + monthly_value, 2)
        category_entry["yearlyEur"] = round(category_entry["yearlyEur"] + yearly_value, 2)
        category_entry["itemCount"] += 1
        category_entry["customerIds"].add(customer_key)
        category_totals[category_key] = category_entry

        customer_entry = customer_totals.get(customer_key)
        if not customer_entry:
            customer_entry = {
                "customerId": customer_key,
                "customerName": str(item.get("customerName") or "").strip() or f"Kunde #{customer_key}",
                "customerNumber": str(item.get("customerNumber") or "").strip(),
                "licenseMonthlyEur": 0.0,
                "otherRecurringMonthlyEur": 0.0,
                "contractMonthlyEur": 0.0,
                "totalMonthlyEur": 0.0,
                "totalYearlyEur": 0.0,
                "itemCount": 0,
                "items": [],
                "categoryTotals": {},
            }
        customer_entry["totalMonthlyEur"] = round(customer_entry["totalMonthlyEur"] + monthly_value, 2)
        customer_entry["totalYearlyEur"] = round(customer_entry["totalYearlyEur"] + yearly_value, 2)
        customer_entry["itemCount"] += 1
        customer_entry["items"].append(item)
        if group == "contract":
            customer_entry["contractMonthlyEur"] = round(customer_entry["contractMonthlyEur"] + monthly_value, 2)
        elif group == "license":
            customer_entry["licenseMonthlyEur"] = round(customer_entry["licenseMonthlyEur"] + monthly_value, 2)
        else:
            customer_entry["otherRecurringMonthlyEur"] = round(customer_entry["otherRecurringMonthlyEur"] + monthly_value, 2)
        customer_category_entry = customer_entry["categoryTotals"].get(category_key)
        if not customer_category_entry:
            meta = _recurring_cost_category_meta(category_key)
            customer_category_entry = {
                "key": category_key,
                "label": meta["label"],
                "group": meta["group"],
                "monthlyEur": 0.0,
                "yearlyEur": 0.0,
                "itemCount": 0,
            }
        customer_category_entry["monthlyEur"] = round(customer_category_entry["monthlyEur"] + monthly_value, 2)
        customer_category_entry["yearlyEur"] = round(customer_category_entry["yearlyEur"] + yearly_value, 2)
        customer_category_entry["itemCount"] += 1
        customer_entry["categoryTotals"][category_key] = customer_category_entry
        customer_totals[customer_key] = customer_entry

    overview["customersCount"] = len(customer_totals)
    overview["categoryTotals"] = sorted(
        [
            {
                "key": entry["key"],
                "label": entry["label"],
                "group": entry["group"],
                "monthlyEur": round(entry["monthlyEur"], 2),
                "yearlyEur": round(entry["yearlyEur"], 2),
                "itemCount": int(entry["itemCount"] or 0),
                "customersCount": len(entry["customerIds"]),
            }
            for entry in category_totals.values()
        ],
        key=lambda entry: (-float(entry.get("monthlyEur") or 0.0), str(entry.get("label") or "").lower()),
    )
    overview["customerRows"] = sorted(
        [
            {
                "customerId": entry["customerId"],
                "customerName": entry["customerName"],
                "customerNumber": entry["customerNumber"],
                "licenseMonthlyEur": round(entry["licenseMonthlyEur"], 2),
                "otherRecurringMonthlyEur": round(entry["otherRecurringMonthlyEur"], 2),
                "contractMonthlyEur": round(entry["contractMonthlyEur"], 2),
                "totalMonthlyEur": round(entry["totalMonthlyEur"], 2),
                "totalYearlyEur": round(entry["totalYearlyEur"], 2),
                "itemCount": int(entry["itemCount"] or 0),
                "categoryTotals": sorted(
                    list(entry["categoryTotals"].values()),
                    key=lambda item: (-float(item.get("monthlyEur") or 0.0), str(item.get("label") or "").lower()),
                ),
                "items": entry["items"],
            }
            for entry in customer_totals.values()
        ],
        key=lambda entry: (-float(entry.get("totalMonthlyEur") or 0.0), str(entry.get("customerName") or "").lower()),
    )
    return overview


def _build_customer_recurring_costs(db: Session, customer_id: int) -> Dict[str, Any]:
    overview = _build_recurring_costs_overview(db, customer_id=customer_id, include_inactive=True)
    if not overview["customerRows"]:
        return {
            "monthlyTotalEur": 0.0,
            "yearlyTotalEur": 0.0,
            "licenseMonthlyEur": 0.0,
            "otherRecurringMonthlyEur": 0.0,
            "contractMonthlyEur": 0.0,
            "itemCount": 0,
            "categoryTotals": [],
            "items": [],
        }
    row = overview["customerRows"][0]
    return {
        "monthlyTotalEur": round(float(row.get("totalMonthlyEur") or 0.0), 2),
        "yearlyTotalEur": round(float(row.get("totalYearlyEur") or 0.0), 2),
        "licenseMonthlyEur": round(float(row.get("licenseMonthlyEur") or 0.0), 2),
        "otherRecurringMonthlyEur": round(float(row.get("otherRecurringMonthlyEur") or 0.0), 2),
        "contractMonthlyEur": round(float(row.get("contractMonthlyEur") or 0.0), 2),
        "itemCount": int(row.get("itemCount") or 0),
        "categoryTotals": row.get("categoryTotals") or [],
        "items": row.get("items") or [],
    }


def _empty_sevdesk_customer_recurring_tags() -> Dict[str, Any]:
    return {
        "monthlyTotalEur": 0.0,
        "invoiceCount": 0,
        "tagCount": 0,
        "tagTotals": [],
        "invoices": [],
    }


def _build_customer_sevdesk_recurring_tags(client: SevdeskClient, contact_id: int) -> Dict[str, Any]:
    if int(contact_id or 0) <= 0:
        return _empty_sevdesk_customer_recurring_tags()
    invoices = client.list_recurring_invoices(
        params={"contact[id]": int(contact_id), "contact[objectName]": "Contact"},
        max_pages=25,
    )
    overview = _build_sevdesk_recurring_tag_overview(client, invoices)
    if not overview.get("customerRows"):
        return _empty_sevdesk_customer_recurring_tags()
    row = overview["customerRows"][0]
    return {
        "monthlyTotalEur": round(float(row.get("monthlyTotalEur") or 0.0), 2),
        "invoiceCount": int(row.get("invoiceCount") or 0),
        "tagCount": len(row.get("tags") or []),
        "tagTotals": row.get("tags") or [],
        "invoices": row.get("invoices") or [],
    }


def _day_task_elapsed_hours(task: Optional[DayTask], now_ms: Optional[int] = None) -> float:
    if not task:
        return 0.0
    elapsed_ms = int(task.elapsed or 0)
    start_time = int(task.startTime or 0)
    window_end = int(now_ms or int(time.time() * 1000))
    if bool(task.running) and start_time > 0 and window_end > start_time:
        elapsed_ms += max(0, window_end - start_time)
    if elapsed_ms <= 0:
        return 0.0
    return round(elapsed_ms / 3_600_000.0, 2)


def _normalize_prepaid_hours_entry_type(value: Any) -> str:
    raw = str(value or "").strip().lower()
    if raw in {"purchase", "credit", "buy", "hours_buy"}:
        return "purchase"
    if raw in {"debit", "consume", "book", "deduct"}:
        return "debit"
    return ""


def _prepaid_hours_signed_hours(entry: CustomerPrepaidHoursEntry) -> float:
    amount = round(float(entry.hours or 0.0), 2)
    if _normalize_prepaid_hours_entry_type(getattr(entry, "entry_type", "")) == "debit":
        return round(-amount, 2)
    return amount


def serialize_customer_prepaid_hours_entry(
    item: CustomerPrepaidHoursEntry,
    *,
    task: Optional[DayTask] = None,
    now_ms: Optional[int] = None,
) -> Dict[str, Any]:
    entry_type = _normalize_prepaid_hours_entry_type(getattr(item, "entry_type", "")) or "purchase"
    task_title = str(getattr(item, "task_title_snapshot", "") or "").strip()
    task_status = ""
    task_elapsed_hours = round(float(getattr(item, "task_elapsed_hours_snapshot", 0.0) or 0.0), 2)
    if task:
        task_title = str(task.title or "").strip() or task_title
        task_status = str(task.status or "").strip().lower()
        task_elapsed_hours = _day_task_elapsed_hours(task, now_ms=now_ms)
    hours_value = round(float(item.hours or 0.0), 2)
    signed_hours = round(-hours_value, 2) if entry_type == "debit" else hours_value
    label = str(getattr(item, "label", "") or "").strip()
    if not label:
        label = "Stundenkauf" if entry_type == "purchase" else (task_title or "Manuelle Abbuchung")
    return {
        "id": int(item.id or 0),
        "customer_id": int(item.customer_id or 0),
        "entry_type": entry_type,
        "entry_type_label": "Kauf" if entry_type == "purchase" else "Abbuchung",
        "hours": hours_value,
        "signed_hours": signed_hours,
        "label": label,
        "note": str(getattr(item, "note", "") or ""),
        "task_id": int(item.task_id or 0) if getattr(item, "task_id", None) else None,
        "task_title": task_title,
        "task_status": task_status,
        "task_elapsed_hours": task_elapsed_hours,
        "effective_at": int(getattr(item, "effective_at", 0) or 0),
        "created_at": int(getattr(item, "created_at", 0) or 0),
    }


def _build_customer_prepaid_hours_payload(db, customer: Customer) -> Dict[str, Any]:
    now_ms = int(time.time() * 1000)
    entry_rows = (
        db.query(CustomerPrepaidHoursEntry)
        .filter(CustomerPrepaidHoursEntry.customer_id == customer.id)
        .order_by(
            CustomerPrepaidHoursEntry.effective_at.desc(),
            CustomerPrepaidHoursEntry.created_at.desc(),
            CustomerPrepaidHoursEntry.id.desc(),
        )
        .all()
    )
    task_filters = _customer_task_filter(customer)
    task_rows: List[DayTask] = []
    if task_filters:
        task_rows = (
            db.query(DayTask)
            .filter(or_(*task_filters))
            .order_by(DayTask.completed_at.desc(), DayTask.created_at.desc(), DayTask.id.desc())
            .limit(120)
            .all()
        )
    task_by_id: Dict[int, DayTask] = {
        int(task.id): task for task in task_rows if getattr(task, "id", None) is not None
    }
    referenced_task_ids = [
        int(item.task_id)
        for item in entry_rows
        if getattr(item, "task_id", None) is not None and int(item.task_id or 0) > 0
    ]
    missing_task_ids = [task_id for task_id in referenced_task_ids if task_id not in task_by_id]
    if missing_task_ids:
        extra_rows = db.query(DayTask).filter(DayTask.id.in_(missing_task_ids)).all()
        for task in extra_rows:
            if getattr(task, "id", None) is None:
                continue
            task_by_id[int(task.id)] = task
            task_rows.append(task)
    booked_hours_by_task: Dict[int, float] = {}
    purchased_hours = 0.0
    debited_hours = 0.0
    for item in entry_rows:
        amount = round(float(item.hours or 0.0), 2)
        if _normalize_prepaid_hours_entry_type(item.entry_type) == "debit":
            debited_hours += amount
            if getattr(item, "task_id", None):
                task_id = int(item.task_id or 0)
                if task_id > 0:
                    booked_hours_by_task[task_id] = round(booked_hours_by_task.get(task_id, 0.0) + amount, 2)
        else:
            purchased_hours += amount
    serialized_entries = [
        serialize_customer_prepaid_hours_entry(item, task=task_by_id.get(int(item.task_id or 0)), now_ms=now_ms)
        for item in entry_rows
    ]
    task_options = []
    seen_task_ids: Set[int] = set()
    for task in task_rows:
        task_id = int(task.id or 0)
        if task_id <= 0 or task_id in seen_task_ids:
            continue
        seen_task_ids.add(task_id)
        elapsed_hours = _day_task_elapsed_hours(task, now_ms=now_ms)
        booked_hours = round(booked_hours_by_task.get(task_id, 0.0), 2)
        task_options.append(
            {
                "id": task_id,
                "title": str(task.title or "").strip() or "Aufgabe",
                "status": str(task.status or "").strip().lower(),
                "time_enabled": bool(task.time_enabled),
                "elapsed_hours": elapsed_hours,
                "booked_hours": booked_hours,
                "remaining_hours": round(max(0.0, elapsed_hours - booked_hours), 2),
                "details": str(task.details or "").strip(),
                "created_at": int(task.created_at or 0),
                "completed_at": int(task.completed_at or 0),
            }
        )
    task_options.sort(
        key=lambda item: (
            -int(item.get("completed_at") or 0),
            -int(item.get("created_at") or 0),
            -int(item.get("id") or 0),
        )
    )
    balance_hours = round(purchased_hours - debited_hours, 2)
    return {
        "customerId": int(customer.id),
        "purchasedHours": round(purchased_hours, 2),
        "debitedHours": round(debited_hours, 2),
        "balanceHours": balance_hours,
        "entries": serialized_entries,
        "taskOptions": task_options,
    }


def _normalize_contract_document_status(value: Any, *, allow_cancelled: bool = True) -> str:
    raw = str(value or "").strip().lower()
    if not raw:
        return ""
    aliases = {
        "proposal": "proposal",
        "vorschlag": "proposal",
        "active": "active",
        "aktiv": "active",
        "final": "active",
        "endgueltig": "active",
        "endgültig": "active",
        "cancelled": "cancelled",
        "storniert": "cancelled",
    }
    normalized = aliases.get(raw, raw)
    allowed = {"proposal", "active"}
    if allow_cancelled:
        allowed.add("cancelled")
    return normalized if normalized in allowed else ""


def _contract_download_filename(row: CustomerContractDocument) -> str:
    base_name = str(row.file_name or f"vertrag_{row.id}.pdf").strip() or f"vertrag_{row.id}.pdf"
    root, ext = os.path.splitext(base_name)
    root = str(root or "").strip() or f"vertrag_{row.id}"
    ext = str(ext or "").strip() or ".pdf"
    status = _normalize_contract_document_status(row.status, allow_cancelled=True) or "active"
    suffix = {
        "proposal": "vorschlag",
        "active": "final",
        "cancelled": "storniert",
    }.get(status, "dokument")
    if not root.lower().endswith(f"_{suffix}"):
        root = f"{root}_{suffix}"
    return f"{root}{ext}"


def _build_contract_download_response(row: CustomerContractDocument) -> Response:
    if not str(row.content_base64 or "").strip():
        raise HTTPException(404, "No document payload stored")
    try:
        content = base64.b64decode(str(row.content_base64 or "").strip())
    except Exception:
        raise HTTPException(500, "Stored document payload is invalid")
    filename = _contract_download_filename(row)
    status_value = _normalize_contract_document_status(row.status, allow_cancelled=True) or "active"
    return Response(
        content=content,
        media_type=str(row.mime_type or "application/pdf"),
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Contract-Status": status_value,
        },
    )


def _contract_counts_from_development_context(context: Dict[str, Any]) -> Dict[str, int]:
    infra = context.get("infra") if isinstance(context.get("infra"), dict) else {}
    inventory_mix = infra.get("inventoryMix") if isinstance(infra.get("inventoryMix"), dict) else {}
    server_count = _safe_nonnegative_int(inventory_mix.get("server"))
    workstation_count = _safe_nonnegative_int(inventory_mix.get("workstation"))
    other_count = _safe_nonnegative_int(inventory_mix.get("other"))
    network_count = (
        _safe_nonnegative_int(inventory_mix.get("network"))
        + _safe_nonnegative_int(inventory_mix.get("firewall"))
        + _safe_nonnegative_int(inventory_mix.get("printer"))
    )
    iot_count = _safe_nonnegative_int(inventory_mix.get("iot"))
    return {
        "servers": server_count,
        "clients": workstation_count + other_count,
        "network_devices": network_count,
        "iot_devices": iot_count,
    }


def _load_contract_counts_from_meta_hub(customer_id: int) -> Optional[Dict[str, int]]:
    try:
        payload = _resolve_customer_development_payload(
            include_inactive=True,
            customer_id=int(customer_id),
            full=True,
            refresh=False,
        )
        contexts = payload.get("contexts") if isinstance(payload.get("contexts"), list) else []
        if not contexts:
            return None
        context = contexts[0] if isinstance(contexts[0], dict) else {}
        counts = _contract_counts_from_development_context(context)
        if any(int(counts.get(key) or 0) > 0 for key in ("servers", "clients", "network_devices", "iot_devices")):
            return counts
    except Exception as exc:
        logger.info("Contract preview counts fallback via meta-hub failed for customer %s: %s", customer_id, exc)
    return None


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


def _normalize_space(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def _strip_html(value: str) -> str:
    text_value = str(value or "")
    if not text_value:
        return ""
    text_value = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text_value)
    text_value = re.sub(r"(?i)<br\s*/?>", "\n", text_value)
    text_value = re.sub(r"(?i)</p>", "\n", text_value)
    text_value = re.sub(r"<[^>]+>", " ", text_value)
    text_value = text_value.replace("&nbsp;", " ").replace("&amp;", "&")
    return _normalize_space(text_value.replace("\r", " ").replace("\n", " "))


def _strip_attachment_markers(value: str) -> str:
    text_value = str(value or "")
    if not text_value:
        return ""
    cleaned_lines: List[str] = []
    for raw_line in text_value.splitlines():
        line = raw_line.strip()
        if not line:
            cleaned_lines.append("")
            continue
        if re.match(r"^(anh[aä]nge?|attachments?)\s*:", line, flags=re.I):
            continue
        if re.match(r"^(anlage|attachment)\s*:", line, flags=re.I):
            continue
        if re.match(r"^\[cid:.*\]$", line, flags=re.I):
            continue
        cleaned_lines.append(raw_line)
    return "\n".join(cleaned_lines)


def _extract_visible_text_from_raw_email(raw_value: str) -> str:
    raw_text = str(raw_value or "")
    if not raw_text:
        return ""
    lower_raw = raw_text.lower()
    looks_like_mime = "content-type:" in lower_raw or "mime-version:" in lower_raw
    looks_like_mail_headers = re.search(r"^(from|subject|to|date):", raw_text, flags=re.I | re.M)
    if not looks_like_mime and not looks_like_mail_headers:
        return ""
    try:
        msg = Parser(policy=policy.default).parsestr(raw_text)
    except Exception:
        return ""

    def _decode_part_text(part) -> str:
        payload_bytes = part.get_payload(decode=True)
        if payload_bytes is None:
            payload_raw = part.get_payload()
            return str(payload_raw or "")
        charset = part.get_content_charset() or "utf-8"
        try:
            return payload_bytes.decode(charset, errors="replace")
        except Exception:
            try:
                return payload_bytes.decode("utf-8", errors="replace")
            except Exception:
                return payload_bytes.decode("latin-1", errors="replace")

    plain_parts: List[str] = []
    html_parts: List[str] = []
    for part in msg.walk():
        if part.is_multipart():
            continue
        disposition = str(part.get_content_disposition() or "").lower()
        if disposition == "attachment":
            continue
        content_type = str(part.get_content_type() or "").lower()
        if content_type not in {"text/plain", "text/html"}:
            continue
        decoded = _decode_part_text(part)
        if not decoded:
            continue
        if content_type == "text/html":
            html_parts.append(decoded)
        else:
            plain_parts.append(decoded)

    normalized_plain = [_normalize_space(_strip_attachment_markers(part)) for part in plain_parts]
    normalized_html = [_strip_html(part) for part in html_parts]
    merged = " ".join([*normalized_plain, *normalized_html]).strip()
    return _normalize_space(_strip_attachment_markers(merged))


def _extract_emails(value: str) -> List[str]:
    text_value = str(value or "")
    if not text_value:
        return []
    matches = re.findall(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text_value, flags=re.I)
    deduped: List[str] = []
    seen = set()
    for email in matches:
        lowered = email.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped.append(email)
    return deduped


def _extract_email_name(raw_from: str, from_email: str) -> str:
    value = str(raw_from or "")
    if not value:
        return ""
    if from_email:
        value = value.replace(from_email, " ")
    value = re.sub(r"<[^>]*>", " ", value)
    value = value.replace("\"", " ").replace("'", " ")
    return _normalize_space(value)


def _fit_task_title(value: str, max_len: int = 78) -> str:
    title = _normalize_space(value)
    if not title:
        return ""
    if len(title) <= max_len:
        return title
    return f"{title[: max_len - 1].rstrip()}…"


def _normalize_match_text(value: Any) -> str:
    text_value = str(value or "").lower()
    if not text_value:
        return ""
    text_value = (
        text_value.replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
    )
    text_value = re.sub(r"[^a-z0-9@._+\- ]+", " ", text_value)
    return _normalize_space(text_value)


def _tokenize_match(value: Any) -> List[str]:
    text_value = _normalize_match_text(value)
    if not text_value:
        return []
    tokens = []
    for token in text_value.split():
        cleaned = token.strip("._-+")
        if len(cleaned) < 2:
            continue
        if cleaned in NAME_STOPWORDS:
            continue
        tokens.append(cleaned)
    return tokens


def _extract_company_mentions(value: Any) -> List[str]:
    text_value = str(value or "")
    if not text_value:
        return []
    mentions: List[str] = []
    seen = set()

    patterns = [
        rf"\b([A-ZÄÖÜ][\w&./\-]+(?:\s+[A-ZÄÖÜ][\w&./\-]+){{0,6}}\s+{COMPANY_SUFFIX_PATTERN})\b",
        rf"\b(?:firma|company|kunde)\s*:?\s*([A-ZÄÖÜ][\w&./\-]+(?:\s+[A-ZÄÖÜ][\w&./\-]+){{0,6}})\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text_value, flags=re.I):
            candidate = _normalize_space(match.group(1))
            if not candidate:
                continue
            key = _normalize_match_text(candidate)
            if not key or key in seen:
                continue
            seen.add(key)
            mentions.append(candidate)
    return mentions[:12]


def _customer_name_aliases(name: str) -> List[str]:
    base = _normalize_space(name)
    if not base:
        return []
    aliases = [base]
    compact = _normalize_space(
        re.sub(rf"\b{COMPANY_SUFFIX_PATTERN}\b", " ", base, flags=re.I)
    )
    if compact and compact.lower() != base.lower():
        aliases.append(compact)
    deduped: List[str] = []
    seen = set()
    for alias in aliases:
        key = _normalize_match_text(alias)
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(alias)
    return deduped


def _ai_rank_customer_candidates(
    subject: str,
    sender_name: str,
    sender_email: str,
    content_text: str,
    candidates: List[str],
) -> List[str]:
    cleaned_candidates = [_normalize_space(name) for name in candidates if _normalize_space(name)]
    if not cleaned_candidates:
        return []
    content = _normalize_space(content_text)[:2600]
    subject_text = _normalize_space(subject)
    sender_name_text = _normalize_space(sender_name)
    sender_email_text = _normalize_space(sender_email)
    choices_block = "\n".join(f"- {name}" for name in cleaned_candidates[:12])
    prompt = (
        "Du bekommst eine E-Mail und eine Liste bekannter Kunden.\n"
        "Waehle den wahrscheinlichsten Kunden aus der Liste anhand von Signatur, Namen, "
        "Betreff und Inhalt.\n"
        "Antworte nur als JSON mit den Feldern primary und alternatives.\n"
        "primary: exakt ein Name aus der Liste oder leer.\n"
        "alternatives: maximal 2 weitere Namen aus der Liste.\n\n"
        f"Absender Name: {sender_name_text or 'n/a'}\n"
        f"Absender E-Mail: {sender_email_text or 'n/a'}\n"
        f"Betreff: {subject_text or 'n/a'}\n"
        f"Inhalt: {content or 'n/a'}\n\n"
        "Kundenliste:\n"
        f"{choices_block}"
    )
    try:
        model_candidates = _resolve_ai_models(
            MODEL_PREF_CUSTOMER_RANKING,
            MODEL_PREF_TASK_DRAFT,
            purpose="customer_ranking",
        )
        payload, used_model, _ = _ai_generate(
            prompt,
            model_candidates=model_candidates,
            response_format="json",
            temperature=0.05,
            max_tokens=160,
        )
        if not payload:
            return []
        raw = payload.get("response")
        loaded: Dict[str, Any] = {}
        if isinstance(raw, dict):
            loaded = raw
        elif isinstance(raw, str):
            try:
                loaded = json.loads(raw)
            except json.JSONDecodeError:
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1 and end > start:
                    try:
                        loaded = json.loads(raw[start : end + 1])
                    except json.JSONDecodeError:
                        loaded = {}
        selected = []
        primary = _normalize_space(loaded.get("primary") or "")
        if primary:
            selected.append(primary)
        alternatives_raw = loaded.get("alternatives")
        if isinstance(alternatives_raw, list):
            selected.extend(_normalize_space(item) for item in alternatives_raw)
        allowed = {_normalize_space(name).lower(): _normalize_space(name) for name in cleaned_candidates}
        deduped: List[str] = []
        seen = set()
        for item in selected:
            key = str(item or "").strip().lower()
            if not key or key not in allowed or key in seen:
                continue
            seen.add(key)
            deduped.append(allowed[key])
        return deduped
    except Exception as exc:
        logger.warning("Email customer ranking AI failed (%s): %s", used_model if 'used_model' in locals() else "n/a", exc)
    return []


def _best_customer_match(
    customers: List[Customer],
    sender_email: str,
    sender_name: str,
    subject: str,
    content_text: str,
    customer_hint: str = "",
) -> Tuple[Optional[Customer], List[str]]:
    sender_email_lower = str(sender_email or "").strip().lower()
    sender_domain = sender_email_lower.split("@", 1)[1] if "@" in sender_email_lower else ""
    sender_local = sender_email_lower.split("@", 1)[0] if "@" in sender_email_lower else ""
    sender_name_norm = _normalize_match_text(sender_name)
    context = f"{subject} {content_text} {sender_name} {sender_email}"
    context_lower = context.lower()
    context_norm = _normalize_match_text(context)
    context_tokens = set(_tokenize_match(context))
    company_mentions = _extract_company_mentions(content_text)
    company_mentions_norm = [_normalize_match_text(item) for item in company_mentions]
    company_mention_tokens = [set(_tokenize_match(item)) for item in company_mentions]
    hint = _normalize_match_text(customer_hint)
    scored: List[Tuple[int, Customer]] = []
    for customer in customers:
        name = _normalize_space(customer.name)
        if not name:
            continue
        score = 0
        customer_name_lower = name.lower()
        customer_name_norm = _normalize_match_text(name)
        name_tokens = set(_tokenize_match(name))
        name_aliases = _customer_name_aliases(name)
        alias_norms = [_normalize_match_text(alias) for alias in name_aliases]
        customer_email = _customer_effective_email(customer).lower()
        customer_domain = customer_email.split("@", 1)[1] if "@" in customer_email else ""
        customer_local = customer_email.split("@", 1)[0] if "@" in customer_email else ""
        customer_short = str(customer.short_code or "").strip().lower()

        if sender_email_lower and customer_email and sender_email_lower == customer_email:
            score += 360
        if sender_domain and customer_domain and sender_domain == customer_domain:
            score += 260 if sender_domain not in FREE_EMAIL_DOMAINS else 90
        if sender_local and customer_local and sender_local == customer_local:
            score += 170
        if customer_email and customer_email in context_lower:
            score += 220
        if customer_name_lower and customer_name_lower in context_lower:
            score += 210
        if customer_name_norm and f" {customer_name_norm} " in f" {context_norm} ":
            score += 190
        for alias_norm in alias_norms:
            if alias_norm and f" {alias_norm} " in f" {context_norm} ":
                score += 150
                break
        if customer_short and customer_short in context_lower:
            score += 95

        if name_tokens:
            overlap = len(name_tokens & context_tokens)
            if overlap > 0:
                ratio = overlap / max(1, len(name_tokens))
                score += int(160 * ratio)
        for mention_norm, mention_tokens in zip(company_mentions_norm, company_mention_tokens):
            if not mention_norm:
                continue
            if customer_name_norm and mention_norm == customer_name_norm:
                score += 260
                continue
            if mention_norm in alias_norms:
                score += 230
                continue
            if mention_tokens and name_tokens:
                overlap = len(mention_tokens & name_tokens)
                if overlap:
                    score += int(180 * (overlap / max(1, len(name_tokens))))
            if customer_name_norm:
                mention_similarity = difflib.SequenceMatcher(
                    None, mention_norm, customer_name_norm
                ).ratio()
                if mention_similarity >= 0.90:
                    score += 180
                elif mention_similarity >= 0.82:
                    score += 120

        if sender_name_norm and customer_name_norm:
            similarity = difflib.SequenceMatcher(None, sender_name_norm, customer_name_norm).ratio()
            if similarity >= 0.90:
                score += 180
            elif similarity >= 0.80:
                score += 125
            elif similarity >= 0.68:
                score += 70

        if hint:
            if hint == customer_name_norm:
                score += 220
            elif hint in customer_name_norm or customer_name_norm in hint:
                score += 110
            elif customer_name_norm:
                hint_similarity = difflib.SequenceMatcher(None, hint, customer_name_norm).ratio()
                if hint_similarity >= 0.84:
                    score += 90

        if score > 0:
            scored.append((score, customer))

    scored.sort(key=lambda item: item[0], reverse=True)
    ai_input_names = [_normalize_space(item[1].name) for item in scored[:12]]
    ai_ranked = _ai_rank_customer_candidates(
        subject=subject,
        sender_name=sender_name,
        sender_email=sender_email,
        content_text=content_text,
        candidates=ai_input_names,
    )
    if ai_ranked:
        ai_bonus_map = {name.lower(): bonus for name, bonus in zip(ai_ranked, [260, 170, 110])}
        rescored = []
        for score, customer in scored:
            bonus = ai_bonus_map.get(_normalize_space(customer.name).lower(), 0)
            rescored.append((score + bonus, customer))
        scored = rescored

    scored.sort(key=lambda item: item[0], reverse=True)
    best = scored[0][1] if scored else None
    candidates = [_normalize_space(item[1].name) for item in scored[:3]]
    return best, candidates


def _generate_task_draft_from_email(
    subject: str, sender_name: str, sender_email: str, content_text: str
) -> Dict[str, str]:
    subject_text = _normalize_space(subject)
    sender_name_text = _normalize_space(sender_name)
    sender_email_text = _normalize_space(sender_email)
    content = _normalize_space(content_text)[:4000]
    if not content and not subject_text:
        return {"title": "", "details": "", "customer_hint": ""}
    prompt = (
        "Analysiere diese E-Mail und antworte nur als JSON mit den Feldern "
        "title, details, customer_hint. "
        "title: kurz, klar, maximal 78 Zeichen, keine Floskeln. "
        "details: 1-3 saubere Sätze für eine Aufgaben-Notiz. "
        "customer_hint: vermuteter Kundenname oder leer.\n\n"
        f"Absender Name: {sender_name_text or 'n/a'}\n"
        f"Absender E-Mail: {sender_email_text or 'n/a'}\n"
        f"Betreff: {subject_text or 'n/a'}\n"
        f"Inhalt: {content or 'n/a'}"
    )
    try:
        model_candidates = _resolve_ai_models(MODEL_PREF_TASK_DRAFT, purpose="task_draft")
        payload, used_model, _ = _ai_generate(
            prompt,
            model_candidates=model_candidates,
            response_format="json",
            temperature=0.15,
            max_tokens=260,
        )
        if not payload:
            raise RuntimeError("No AI response")
        raw = payload.get("response")
        loaded: Dict[str, Any] = {}
        if isinstance(raw, dict):
            loaded = raw
        elif isinstance(raw, str):
            try:
                loaded = json.loads(raw)
            except json.JSONDecodeError:
                start = raw.find("{")
                end = raw.rfind("}")
                if start != -1 and end != -1 and end > start:
                    try:
                        loaded = json.loads(raw[start : end + 1])
                    except json.JSONDecodeError:
                        loaded = {}
        return {
            "title": _fit_task_title(str(loaded.get("title") or "")),
            "details": _normalize_space(loaded.get("details") or ""),
            "customer_hint": _normalize_space(loaded.get("customer_hint") or ""),
        }
    except Exception as exc:
        logger.warning(
            "Email draft AI failed (%s): %s",
            used_model if 'used_model' in locals() else "n/a",
            exc,
        )
    fallback_title = _fit_task_title(subject_text or content[:78] or "Neue Aufgabe aus E-Mail")
    fallback_details = _normalize_space(content[:1000])
    return {"title": fallback_title, "details": fallback_details, "customer_hint": ""}


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


def _dev_customer_match_terms(customer: Customer) -> List[str]:
    terms = []
    for value in [customer.name, customer.creditor_number, customer.short_code]:
        normalized = _dev_normalize_text(value)
        if not normalized:
            continue
        compact = normalized.replace(" ", "")
        # Avoid overly broad matches such as tiny numeric short codes ("12").
        if compact.isdigit() and len(compact) < 4:
            continue
        if len(compact) < 4:
            continue
        if normalized:
            terms.append(normalized)
    return terms


def _dev_score_to_state(score: float) -> str:
    if score >= 75:
        return "RISK"
    if score >= 50:
        return "ATTENTION"
    if score >= 25:
        return "POTENTIAL"
    return "STABLE"


def _fetch_tactical_rmm_agents(settings: Optional[IntegrationSettings]) -> Tuple[List[Dict[str, Any]], bool]:
    probe = _probe_tactical_rmm(settings)
    if not bool(probe.get("connected")):
        return [], False
    agents = probe.get("agents")
    if not isinstance(agents, list):
        return [], True
    return _enrich_tactical_agents_with_site_context(settings, agents), True


def _normalize_tactical_host(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if not re.match(r"^https?://", raw, re.IGNORECASE):
        raw = f"https://{raw}"
    parsed = urlparse(raw)
    scheme = (parsed.scheme or "https").lower()
    netloc = parsed.netloc or parsed.path
    path = parsed.path if parsed.netloc else ""
    path = str(path or "").rstrip("/")
    if not netloc:
        return ""
    return f"{scheme}://{netloc}{path}".rstrip("/")


def _tactical_request(
    session: requests.Session,
    host: str,
    method: str,
    path: str,
    *,
    timeout: int = 8,
    retries: int = 1,
    json_payload: Optional[Dict[str, Any]] = None,
) -> Tuple[Optional[requests.Response], str]:
    retryable_status = {429, 500, 502, 503, 504}
    last_error = ""
    for attempt in range(max(0, retries) + 1):
        try:
            response = session.request(
                str(method or "GET").upper(),
                _tactical_url(host, path),
                timeout=max(1, int(timeout or 8)),
                json=json_payload,
            )
        except requests.RequestException as exc:
            last_error = str(exc)
            if attempt < retries:
                time.sleep(0.2 * (attempt + 1))
                continue
            return None, last_error
        if response.status_code in retryable_status and attempt < retries:
            last_error = f"HTTP {response.status_code}"
            time.sleep(0.2 * (attempt + 1))
            continue
        return response, ""
    return None, last_error or "request_failed"


def _tactical_payload_rows(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        for key in ("results", "agents", "data", "items", "sites", "clients"):
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
        marker_keys = {
            "agent_id",
            "agentid",
            "agentId",
            "hostname",
            "name",
            "site",
            "site_name",
            "client",
            "client_name",
            "status",
            "id",
        }
        if any(key in payload for key in marker_keys):
            return [payload]
    return []


def _tactical_fetch_rows(
    session: requests.Session,
    host: str,
    path_candidates: List[str],
    *,
    timeout: int = 8,
    retries: int = 1,
) -> Tuple[List[Dict[str, Any]], str]:
    for path in path_candidates:
        res, _ = _tactical_request(session, host, "GET", path, timeout=timeout, retries=retries)
        if not res or not res.ok:
            continue
        try:
            payload = res.json()
        except ValueError:
            continue
        rows = _tactical_payload_rows(payload)
        if rows:
            return rows, path
    return [], ""


def _fetch_latest_discovery_payload_from_agent_history(
    session: requests.Session,
    host: str,
    agent_id: str,
) -> Optional[Dict[str, Any]]:
    if not str(agent_id or "").strip():
        return None
    history_res, _ = _tactical_request(
        session,
        host,
        "GET",
        f"/agents/{quote(str(agent_id).strip())}/history/",
        timeout=20,
        retries=0,
    )
    if not history_res or not history_res.ok:
        return None
    try:
        history_rows = history_res.json()
    except Exception:
        return None
    if not isinstance(history_rows, list):
        return None
    history_rows_sorted = sorted(
        [row for row in history_rows if isinstance(row, dict)],
        key=lambda row: _parse_iso8601_to_epoch_ms(row.get("time")),
        reverse=True,
    )
    for row in history_rows_sorted:
        if not isinstance(row, dict):
            continue
        if str(row.get("type") or "").strip().lower() != "script_run":
            continue
        script_name = str(row.get("script_name") or "").strip().lower()
        if "infra" not in script_name or "discover" not in script_name:
            continue
        script_results = row.get("script_results") if isinstance(row.get("script_results"), dict) else {}
        payload = _extract_discovery_payload_from_script_output(str(script_results.get("stdout") or ""))
        if not isinstance(payload, dict):
            continue
        generated_at = int(_safe_nonnegative_int(payload.get("generated_at") or 0))
        if generated_at <= 0:
            generated_at = _parse_iso8601_to_epoch_ms(row.get("time"))
        return {
            "generated_at": generated_at,
            "payload": payload,
        }
    return None


def _tactical_site_cache_key(settings: Optional[IntegrationSettings]) -> str:
    if not settings:
        return ""
    host = _normalize_tactical_host(settings.rmm_host)
    header = str(settings.rmm_api_key_header or "X-API-KEY").strip().lower() or "x-api-key"
    digest = hashlib.sha1(str(settings.rmm_api_key or "").encode("utf-8")).hexdigest()[:12]
    return f"{host}|{header}|{digest}"


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


def _resolve_tactical_site_context(
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


def _fetch_tactical_rmm_site_lookup(settings: Optional[IntegrationSettings]) -> Dict[str, Any]:
    cache_key = _tactical_site_cache_key(settings)
    now_ms = int(time.time() * 1000)
    cached = _tactical_site_lookup_cache.get(cache_key) if cache_key else None
    if cached and (now_ms - int(cached.get("cachedAt") or 0)) < TACTICAL_SITE_CACHE_TTL_MS:
        payload = cached.get("payload")
        if isinstance(payload, dict):
            return payload

    session, host = _build_tactical_rmm_session(settings)
    if not session or not host:
        return {"byId": {}, "byName": {}, "sourcePath": "", "count": 0}

    list_candidates = [
        "/clients/?detail=true&limit=1000",
        "/clients/?detail=true",
        "/clients/?limit=1000",
        "/clients/",
        "/clients",
        "/sites/?detail=true&limit=1000",
        "/sites/?detail=true",
        "/sites/?limit=1000",
        "/sites/",
        "/sites",
        "/api/v3/clients/?detail=true&limit=1000",
        "/api/v3/clients/?detail=true",
        "/api/v3/clients/?limit=1000",
        "/api/v3/clients/",
        "/api/v3/clients",
        "/api/v3/sites/?detail=true&limit=1000",
        "/api/v3/sites/?detail=true",
        "/api/v3/sites/?limit=1000",
        "/api/v3/sites/",
        "/api/v3/sites",
    ]
    rows, source_path = _tactical_fetch_rows(session, host, list_candidates, timeout=8, retries=1)

    by_id: Dict[str, Dict[str, Any]] = {}
    by_name: Dict[str, Dict[str, Any]] = {}
    for row in rows:
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

    result = {
        "byId": by_id,
        "byName": by_name,
        "sourcePath": source_path,
        "count": len(rows),
    }
    if cache_key:
        _tactical_site_lookup_cache[cache_key] = {"cachedAt": now_ms, "payload": result}
    return result


def _enrich_tactical_agents_with_site_context(
    settings: Optional[IntegrationSettings],
    agents: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    clean_agents = [row for row in agents if isinstance(row, dict)]
    if not clean_agents:
        return []
    lookup = _fetch_tactical_rmm_site_lookup(settings)
    by_id = lookup.get("byId") if isinstance(lookup.get("byId"), dict) else {}
    by_name = lookup.get("byName") if isinstance(lookup.get("byName"), dict) else {}
    if not by_id and not by_name:
        return clean_agents

    enriched: List[Dict[str, Any]] = []
    matched = 0
    for agent in clean_agents:
        row = dict(agent)
        site_context = _resolve_tactical_site_context(row, by_id=by_id, by_name=by_name)
        if isinstance(site_context, dict):
            matched += 1
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
                    row["site_custom_fields"] = field_value
                    break
        enriched.append(row)

    if matched:
        logger.info(
            "RMM site-context enrichment matched %s/%s agents (source=%s)",
            matched,
            len(enriched),
            lookup.get("sourcePath") or "unknown",
        )
    return enriched


def _build_tactical_rmm_session(settings: Optional[IntegrationSettings]) -> Tuple[Optional[requests.Session], str]:
    if not settings:
        return None, ""
    host = _normalize_tactical_host(settings.rmm_host)
    api_key = str(settings.rmm_api_key or "").strip()
    api_key_header = str(settings.rmm_api_key_header or "X-API-KEY").strip() or "X-API-KEY"
    if not host or not api_key:
        return None, host
    session = requests.Session()
    session.headers.update({"User-Agent": "QT-Workbench"})
    header_value = api_key
    if api_key_header.lower() == "authorization" and not re.match(r"^(bearer|token)\s+", api_key, re.IGNORECASE):
        header_value = f"Bearer {api_key}"
    session.headers.update({api_key_header: header_value})
    if api_key_header.lower() != "x-api-key":
        session.headers.update({"X-API-KEY": api_key})
    return session, host


def _tactical_url(host: str, path: str) -> str:
    base = str(host or "").strip().rstrip("/")
    suffix = str(path or "").strip()
    if not base or not suffix:
        return f"{base}{suffix}"
    base_lower = base.lower()
    if base_lower.endswith("/api/v3") and suffix.startswith("/api/v3/"):
        suffix = suffix[len("/api/v3") :]
    elif base_lower.endswith("/api") and suffix.startswith("/api/"):
        suffix = suffix[len("/api") :]
    return f"{base}{suffix}"


def _probe_tactical_rmm(settings: Optional[IntegrationSettings]) -> Dict[str, Any]:
    checked_at = datetime.now().isoformat()
    if not settings:
        return {
            "connected": False,
            "checkedAt": checked_at,
            "error": "Integration settings missing",
            "agents": [],
        }
    host = _normalize_tactical_host(settings.rmm_host)
    api_key = str(settings.rmm_api_key or "").strip()
    api_key_header = str(settings.rmm_api_key_header or "X-API-KEY").strip() or "X-API-KEY"
    if not host:
        return {
            "connected": False,
            "checkedAt": checked_at,
            "host": "",
            "hasUser": False,
            "hasPassword": False,
            "hasApiKey": bool(api_key),
            "apiKeyHeader": api_key_header,
            "error": "Missing rmm_host",
            "agents": [],
        }
    if not api_key:
        return {
            "connected": False,
            "checkedAt": checked_at,
            "host": host,
            "hasUser": False,
            "hasPassword": False,
            "hasApiKey": False,
            "apiKeyHeader": api_key_header,
            "error": "Missing rmm_api_key",
            "agents": [],
        }

    session, host = _build_tactical_rmm_session(settings)
    if not session:
        return {
            "connected": False,
            "checkedAt": checked_at,
            "host": host,
            "hasUser": False,
            "hasPassword": False,
            "hasApiKey": bool(api_key),
            "apiKeyHeader": api_key_header,
            "error": "RMM session init failed",
            "agents": [],
            "attemptedUrls": [],
        }

    # TacticalRMM docs use API base + /agents/ with X-API-KEY header.
    list_candidates = [
        "/agents/?detail=true",
        "/agents/?detail=false",
        "/agents/",
        "/agents",
        "/api/agents/",
        "/api/agents",
        # Compatibility fallback for older/custom deployments.
        "/api/v3/agents/",
        "/api/v3/agents",
    ]
    agents_path = ""
    agents_status_code = None
    agents_error = ""
    attempted_urls: List[str] = []
    for path in list_candidates:
        agents_path = path
        request_url = _tactical_url(host, path)
        res, req_error = _tactical_request(session, host, "GET", path, timeout=8, retries=1)
        if not res:
            agents_error = req_error or "request_failed"
            attempted_urls.append(f"{request_url} -> ERR")
            continue
        agents_status_code = res.status_code
        attempted_urls.append(f"{request_url} -> {res.status_code}")
        if not res.ok:
            agents_error = f"HTTP {res.status_code}"
            continue
        body_text = (res.text or "").strip()
        content_type = (res.headers.get("content-type") or "").lower()
        if not body_text:
            return {
                "connected": True,
                "checkedAt": checked_at,
                "host": host,
                "hasUser": False,
                "hasPassword": False,
                "hasApiKey": bool(api_key),
                "apiKeyHeader": api_key_header,
                "authPath": None,
                "authStatusCode": None,
                "agentsPath": agents_path,
                "agentsStatusCode": agents_status_code,
                "sampleCount": 0,
                "agents": [],
                "error": "",
                "attemptedUrls": attempted_urls,
            }
        if "text/html" in content_type or body_text.startswith("<!doctype") or body_text.startswith("<html"):
            agents_error = "HTML response instead of JSON (check API host/header)"
            continue
        try:
            payload = res.json()
        except ValueError:
            try:
                payload = jsonlib.loads(body_text)
            except Exception:
                agents_error = "Invalid JSON response"
                continue
        rows = _tactical_payload_rows(payload)
        if rows:
            return {
                "connected": True,
                "checkedAt": checked_at,
                "host": host,
                "hasUser": False,
                "hasPassword": False,
                "hasApiKey": bool(api_key),
                "apiKeyHeader": api_key_header,
                "authPath": None,
                "authStatusCode": None,
                "agentsPath": agents_path,
                "agentsStatusCode": agents_status_code,
                "sampleCount": len(rows),
                "agents": rows,
                "error": "",
                "attemptedUrls": attempted_urls,
            }
        if isinstance(payload, dict):
            count_value = payload.get("count")
            if isinstance(count_value, int) and count_value >= 0:
                return {
                    "connected": True,
                    "checkedAt": checked_at,
                    "host": host,
                    "hasUser": False,
                    "hasPassword": False,
                    "hasApiKey": bool(api_key),
                    "apiKeyHeader": api_key_header,
                    "authPath": None,
                    "authStatusCode": None,
                    "agentsPath": agents_path,
                    "agentsStatusCode": agents_status_code,
                    "sampleCount": int(count_value),
                    "agents": [],
                    "error": "",
                    "attemptedUrls": attempted_urls,
                }
            agents_error = "No agent list in response"
    error_parts = [part for part in [agents_error] if part]
    return {
        "connected": False,
        "checkedAt": checked_at,
        "host": host,
        "hasUser": False,
        "hasPassword": False,
        "hasApiKey": bool(api_key),
        "apiKeyHeader": api_key_header,
        "authPath": None,
        "authStatusCode": None,
        "agentsPath": agents_path or None,
        "agentsStatusCode": agents_status_code,
        "sampleCount": 0,
        "agents": [],
        "error": " | ".join(error_parts) if error_parts else "RMM API connection failed",
        "attemptedUrls": attempted_urls,
    }


def _extract_agent_id(agent: Dict[str, Any]) -> str:
    return str(
        agent.get("agent_id")
        or agent.get("agentId")
        or agent.get("agentid")
        or agent.get("agentID")
        or agent.get("id")
        or ""
    ).strip()


def _fetch_tactical_rmm_agent_detail_map(
    settings: Optional[IntegrationSettings],
    agent_ids: List[str],
) -> Dict[str, Dict[str, Any]]:
    session, host = _build_tactical_rmm_session(settings)
    if not session or not host:
        return {}
    result: Dict[str, Dict[str, Any]] = {}
    for agent_id in agent_ids[:30]:
        clean_id = str(agent_id or "").strip()
        if not clean_id:
            continue
        payload: Optional[Dict[str, Any]] = None
        for path in (
            f"/agents/{quote(clean_id)}/",
            f"/agents/{quote(clean_id)}",
            f"/api/agents/{quote(clean_id)}/",
            f"/api/agents/{quote(clean_id)}",
            f"/api/v3/agents/{quote(clean_id)}/",
            f"/api/v3/agents/{quote(clean_id)}",
        ):
            res, _ = _tactical_request(session, host, "GET", path, timeout=8, retries=1)
            if not res:
                continue
            if not res.ok:
                continue
            try:
                raw = res.json()
            except ValueError:
                continue
            if isinstance(raw, dict):
                payload = raw
                break
            if isinstance(raw, list) and raw and isinstance(raw[0], dict):
                payload = raw[0]
                break
        if not isinstance(payload, dict):
            continue
        resolved_id = _extract_agent_id(payload) or clean_id
        result[resolved_id] = payload
    return result


def _safe_version_key(value: str) -> Tuple[int, str]:
    raw = str(value or "").strip()
    if not raw:
        return (0, "")
    parts = re.findall(r"\d+", raw)
    if not parts:
        return (1, raw.lower())
    padded = ".".join(part.zfill(6) for part in parts[:6])
    return (2, padded)


def _software_compact_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _software_lookup_name_candidates(name: str) -> List[str]:
    raw = _software_compact_text(name)
    if not raw:
        return []
    seen: Set[str] = set()
    out: List[str] = []

    def push(candidate: str) -> None:
        cleaned = _software_compact_text(candidate).strip(" -_")
        if len(cleaned) < 3:
            return
        key = cleaned.lower()
        if key in seen:
            return
        seen.add(key)
        out.append(cleaned)

    push(raw)
    no_arch = re.sub(r"\((?:x64|x86|64-bit|32-bit|amd64)\)", "", raw, flags=re.I)
    push(no_arch)
    dashed_version_trimmed = re.sub(r"\s*-\s*\d+(?:\.\d+){1,5}(?:\s*\(.*?\))?$", "", no_arch, flags=re.I)
    push(dashed_version_trimmed)
    component_trimmed = re.sub(
        (
            r"\b("
            r"setup(?: support files)?|service pack \d+.*|native client|management objects|scriptdom|writer|"
            r"shared framework|common files|connection info|database engine (?:services|shared)|additional runtime|"
            r"redistributable|rsfx driver|plug-?in(?: ui)? extension|plug-?in proxy|plug-?in"
            r")\b.*$"
        ),
        "",
        no_arch,
        flags=re.I,
    )
    push(component_trimmed)
    for_match = re.search(r"\bfor\s+(.+)$", no_arch, flags=re.I)
    if for_match:
        push(for_match.group(1))
    sql_match = re.search(r"(microsoft\s+sql\s+server\s+\d{4})", no_arch, flags=re.I)
    if sql_match:
        push(sql_match.group(1))
    return out[:4]


def _software_lookup_version_candidates(name: str, version: str) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []

    def push(candidate: str) -> None:
        cleaned = _software_compact_text(candidate).strip(".- ")
        if not cleaned:
            return
        key = cleaned.lower()
        if key in seen:
            return
        seen.add(key)
        out.append(cleaned)

    for match in re.findall(r"\b\d+\.\d+(?:\.\d+){0,4}\b", str(name or "")):
        push(match)
    raw_version = _software_compact_text(version)
    # Skip timestamp-like strings as primary CVE version key.
    if raw_version and not (":" in raw_version and re.search(r"\d{4}-\d{2}-\d{2}", raw_version)):
        push(raw_version)
    return out[:3]


def _software_should_query_osv(name: str) -> bool:
    key = str(name or "").strip().lower()
    if not key:
        return False
    if any(token in key for token in ("python", "pip", "npm", "node", "nuget", "maven", "gradle", "composer", "ruby", "gem", "cargo", "crate")):
        return True
    if ("/" in key or "@" in key) and " " not in key:
        return True
    return False


def _cve_lookup_priority(name: str) -> int:
    key = str(name or "").strip().lower()
    if not key:
        return 0
    score = 50
    if any(token in key for token in ("chrome", "edge", "firefox", "java", "adobe", "office", "outlook", "teams", "browser", "openssl", "veeam", "vmware", "sql server")):
        score += 20
    if any(token in key for token in ("setup", "support files", "common files", "connection info", "native client", "management objects", "scriptdom", "redistributable", "plug-in", "extension", "proxy")):
        score -= 20
    return max(1, score)


def _software_text_value(value: Any, depth: int = 0) -> str:
    if depth > 4:
        return ""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, bool):
        return ""
    if isinstance(value, (int, float)):
        return str(value).strip()
    if isinstance(value, list):
        for item in value:
            text_value = _software_text_value(item, depth + 1)
            if text_value:
                return text_value
        return ""
    if isinstance(value, dict):
        for key in (
            "value",
            "text",
            "name",
            "display_name",
            "displayName",
            "title",
            "label",
            "software",
            "product",
            "application",
            "app",
            "program",
            "package",
            "version",
            "display_version",
            "displayVersion",
        ):
            if key not in value:
                continue
            text_value = _software_text_value(value.get(key), depth + 1)
            if text_value:
                return text_value
    return ""


def _extract_software_name_version(node: Dict[str, Any]) -> Optional[Dict[str, str]]:
    if not isinstance(node, dict):
        return None
    name = ""
    for key in (
        "name",
        "software",
        "product",
        "display_name",
        "displayName",
        "app_name",
        "appName",
        "application",
        "application_name",
        "program",
        "program_name",
        "package",
        "package_name",
        "title",
    ):
        if key not in node:
            continue
        name = _software_text_value(node.get(key))
        if name:
            break
    if not name:
        return None

    version = ""
    for key in (
        "version",
        "display_version",
        "displayVersion",
        "current_version",
        "currentVersion",
        "installed_version",
        "installedVersion",
        "product_version",
        "productVersion",
        "app_version",
        "appVersion",
        "ver",
    ):
        if key not in node:
            continue
        version = _software_text_value(node.get(key))
        if version:
            break
    return {"name": name, "version": version}


def _extract_software_entries(payload: Any) -> List[Dict[str, str]]:
    queue: List[Any] = []
    if isinstance(payload, list):
        queue.extend(payload)
    elif isinstance(payload, dict):
        queue.append(payload)
        for key in (
            "results",
            "software",
            "items",
            "data",
            "installed_software",
            "installedSoftware",
            "applications",
            "apps",
            "programs",
            "packages",
        ):
            value = payload.get(key)
            if isinstance(value, list):
                queue.extend(value)
            elif isinstance(value, dict):
                queue.append(value)
        for value in payload.values():
            if isinstance(value, list):
                queue.extend(value)

    out: List[Dict[str, str]] = []
    seen: Set[str] = set()
    visited = 0
    while queue and visited < 6000:
        visited += 1
        node = queue.pop(0)
        if isinstance(node, list):
            queue.extend(node)
            continue
        if not isinstance(node, dict):
            continue
        parsed = _extract_software_name_version(node)
        if parsed:
            dedupe_key = f"{parsed['name'].strip().lower()}|{parsed['version'].strip().lower()}"
            if dedupe_key not in seen:
                seen.add(dedupe_key)
                out.append(parsed)
        for key, value in node.items():
            key_text = str(key or "").strip().lower()
            if isinstance(value, list):
                if any(token in key_text for token in ("software", "app", "program", "package", "result", "item", "data", "installed")):
                    queue.extend(value)
            elif isinstance(value, dict):
                if any(token in key_text for token in ("software", "app", "program", "package", "product", "payload", "result", "data", "item")):
                    queue.append(value)
    return out


def _get_cached_tactical_software_endpoint_template(host: str) -> str:
    normalized_host = _normalize_tactical_host(host)
    if not normalized_host:
        return ""
    now_ms = int(time.time() * 1000)
    with _tactical_software_endpoint_lock:
        cached = _tactical_software_endpoint_cache.get(normalized_host)
        if not cached:
            return ""
        if now_ms - int(cached.get("cachedAt") or 0) >= TACTICAL_SOFTWARE_ENDPOINT_CACHE_TTL_MS:
            _tactical_software_endpoint_cache.pop(normalized_host, None)
            return ""
        return str(cached.get("template") or "").strip()


def _set_cached_tactical_software_endpoint_template(host: str, template: str) -> None:
    normalized_host = _normalize_tactical_host(host)
    normalized_template = str(template or "").strip()
    if not normalized_host or not normalized_template:
        return
    with _tactical_software_endpoint_lock:
        _tactical_software_endpoint_cache[normalized_host] = {
            "cachedAt": int(time.time() * 1000),
            "template": normalized_template,
        }


def _fetch_tactical_rmm_software(
    settings: Optional[IntegrationSettings],
    agent_ids: List[str],
    per_agent_limit: int = 80,
) -> List[Dict[str, Any]]:
    session, host = _build_tactical_rmm_session(settings)
    if not session or not host:
        return []
    candidate_templates = [
        "/software/{agent_id}/",
        "/software/{agent_id}",
        "/winsoftware/{agent_id}/",
        "/winsoftware/{agent_id}",
        "/api/v3/software/{agent_id}/",
        "/api/v3/software/{agent_id}",
        "/api/v3/winsoftware/{agent_id}/",
        "/api/v3/winsoftware/{agent_id}",
        "/agents/{agent_id}/software/",
        "/agents/{agent_id}/software",
        "/api/v3/agents/{agent_id}/software/",
        "/api/v3/agents/{agent_id}/software",
        "/software/?agent={agent_id_q}",
        "/software?agent={agent_id_q}",
        "/software/?agent_id={agent_id_q}",
        "/software?agent_id={agent_id_q}",
        "/api/software/?agent={agent_id_q}",
        "/api/software?agent={agent_id_q}",
        "/api/software/?agent_id={agent_id_q}",
        "/api/software?agent_id={agent_id_q}",
        "/api/v3/software/?agent={agent_id_q}",
        "/api/v3/software?agent={agent_id_q}",
        "/api/v3/software/?agent_id={agent_id_q}",
        "/api/v3/software?agent_id={agent_id_q}",
    ]
    preferred_template = _get_cached_tactical_software_endpoint_template(host)
    rows: List[Dict[str, Any]] = []
    for agent_id in agent_ids[:25]:
        if not agent_id:
            continue
        ordered_templates: List[str] = []
        if preferred_template and preferred_template in candidate_templates:
            ordered_templates.append(preferred_template)
        for template in candidate_templates:
            if template not in ordered_templates:
                ordered_templates.append(template)

        rendered_candidates = [
            template.format(agent_id=agent_id, agent_id_q=quote(agent_id))
            for template in ordered_templates
        ]
        software_items: List[Dict[str, str]] = []
        used_path = ""
        used_template = ""
        for idx, path in enumerate(rendered_candidates):
            timeout_value = 5 if idx == 0 else 6
            res, _ = _tactical_request(session, host, "GET", path, timeout=timeout_value, retries=0)
            if not res:
                continue
            if not res.ok:
                continue
            try:
                data = res.json()
            except ValueError:
                continue
            extracted = _extract_software_entries(data)
            if not extracted:
                continue
            software_items = extracted
            used_path = path
            used_template = ordered_templates[idx]
            break
        if not software_items:
            logger.info("RMM software inventory empty for agent %s: no endpoint matched", agent_id)
            continue
        if used_template and used_template != preferred_template:
            preferred_template = used_template
            _set_cached_tactical_software_endpoint_template(host, preferred_template)
        logger.info(
            "RMM software inventory for agent %s via %s: %s items",
            agent_id,
            used_path or "unknown",
            len(software_items),
        )
        for item in software_items[:per_agent_limit]:
            name = str(item.get("name") or "").strip()
            version = str(item.get("version") or "").strip()
            if not name:
                continue
            rows.append(
                {
                    "agent_id": agent_id,
                    "name": name,
                    "version": version,
                }
            )
    return rows


def _nvd_lookup_term(term: str) -> List[Dict[str, Any]]:
    normalized_term = _software_compact_text(term).lower()
    if not normalized_term:
        return []
    now_ms = int(time.time() * 1000)
    with _nvd_lookup_lock:
        cached = _nvd_lookup_cache.get(normalized_term)
        if cached and now_ms - int(cached.get("cachedAt") or 0) < NVD_LOOKUP_CACHE_TTL_MS:
            rows = cached.get("rows")
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
    url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    rows: List[Dict[str, Any]] = []
    try:
        res = requests.get(
            url,
            params={"keywordSearch": term, "resultsPerPage": 8},
            timeout=3,
        )
        if res.ok:
            data = res.json()
            vulns = data.get("vulnerabilities")
            if isinstance(vulns, list):
                for row in vulns[:8]:
                    cve = row.get("cve") if isinstance(row, dict) else {}
                    if not isinstance(cve, dict):
                        continue
                    cve_id = str(cve.get("id") or "").strip()
                    metrics = cve.get("metrics") if isinstance(cve.get("metrics"), dict) else {}
                    score = None
                    if metrics:
                        for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV2"):
                            values = metrics.get(key)
                            if isinstance(values, list) and values:
                                cvss_data = values[0].get("cvssData") if isinstance(values[0], dict) else {}
                                if isinstance(cvss_data, dict):
                                    score = cvss_data.get("baseScore")
                                break
                    if cve_id:
                        rows.append({"id": cve_id, "score": score})
    except Exception:
        rows = []
    with _nvd_lookup_lock:
        _nvd_lookup_cache[normalized_term] = {
            "cachedAt": now_ms,
            "rows": rows[:8],
        }
    return rows[:8]


def _nvd_lookup(name: str, version: str) -> List[Dict[str, Any]]:
    name_candidates = _software_lookup_name_candidates(name) or [_software_compact_text(name)]
    version_candidates = _software_lookup_version_candidates(name, version)
    terms: List[str] = []
    seen_terms: Set[str] = set()

    def add_term(value: str) -> None:
        term = _software_compact_text(value)
        if len(term) < 3:
            return
        key = term.lower()
        if key in seen_terms:
            return
        seen_terms.add(key)
        terms.append(term)

    for candidate_name in name_candidates[:3]:
        if version_candidates:
            for candidate_version in version_candidates[:2]:
                add_term(f"{candidate_name} {candidate_version}")
        add_term(candidate_name)

    for term in terms[:8]:
        rows = _nvd_lookup_term(term)
        if rows:
            return rows[:5]
    return []


def _osv_fixed_versions(name: str, version: str) -> List[str]:
    clean_name = _software_compact_text(name)
    clean_version = _software_compact_text(version)
    if not clean_name or not clean_version:
        return []
    cache_key = f"{clean_name.lower()}|{clean_version.lower()}"
    now_ms = int(time.time() * 1000)
    with _osv_lookup_lock:
        cached = _osv_lookup_cache.get(cache_key)
        if cached and now_ms - int(cached.get("cachedAt") or 0) < OSV_LOOKUP_CACHE_TTL_MS:
            rows = cached.get("fixedVersions")
            if isinstance(rows, list):
                return [str(entry or "").strip() for entry in rows if str(entry or "").strip()]

    payload = {
        "version": clean_version,
        "package": {"name": clean_name},
    }
    fixed: List[str] = []
    try:
        res = requests.post("https://api.osv.dev/v1/query", json=payload, timeout=3)
        if res.ok:
            data = res.json()
            vulns = data.get("vulns")
            if isinstance(vulns, list):
                for vuln in vulns:
                    affected = vuln.get("affected") if isinstance(vuln, dict) else []
                    if not isinstance(affected, list):
                        continue
                    for item in affected:
                        ranges = item.get("ranges") if isinstance(item, dict) else []
                        if not isinstance(ranges, list):
                            continue
                        for rng in ranges:
                            events = rng.get("events") if isinstance(rng, dict) else []
                            if not isinstance(events, list):
                                continue
                            for event in events:
                                fixed_version = str(event.get("fixed") or "").strip() if isinstance(event, dict) else ""
                                if fixed_version:
                                    fixed.append(fixed_version)
    except Exception:
        fixed = []
    unique = sorted(set(fixed), key=_safe_version_key)
    result = unique[-3:]
    with _osv_lookup_lock:
        _osv_lookup_cache[cache_key] = {
            "cachedAt": now_ms,
            "fixedVersions": result,
        }
    return result


def _lookup_cve_for_software(name: str, version: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    lookup_name = str(name or "").strip()
    lookup_version = str(version or "").strip()
    if not lookup_name:
        return [], []
    cves = _nvd_lookup(lookup_name, lookup_version)
    fixed_versions: List[str] = []
    if cves or _software_should_query_osv(lookup_name):
        fixed_versions = _osv_fixed_versions(lookup_name, lookup_version)
    return cves[:5], fixed_versions


def _extract_customer_number_from_contact(contact: Dict[str, Any]) -> str:
    for key in ("customerNumber", "customernumber", "number"):
        value = str(contact.get(key) or "").strip()
        if value:
            return value
    return ""


def _clean_customer_contact_value(value: Any) -> str:
    return str(value or "").strip()


def _customer_primary_email(customer: Customer) -> str:
    return _clean_customer_contact_value(getattr(customer, "email", ""))


def _customer_newsletter_email(customer: Customer) -> str:
    return _clean_customer_contact_value(getattr(customer, "newsletter_email", ""))


def _customer_billing_email(customer: Customer) -> str:
    return _clean_customer_contact_value(getattr(customer, "billing_email", ""))


def _customer_effective_email(customer: Customer) -> str:
    return _customer_primary_email(customer) or _customer_billing_email(customer)


def _customer_newsletter_effective_email(customer: Customer) -> str:
    return _customer_newsletter_email(customer) or _customer_effective_email(customer)


def _customer_general_address(customer: Customer) -> Dict[str, str]:
    return {
        "street": _clean_customer_contact_value(getattr(customer, "street", "")),
        "postal_code": _clean_customer_contact_value(getattr(customer, "postal_code", "")),
        "city": _clean_customer_contact_value(getattr(customer, "city", "")),
        "country": _clean_customer_contact_value(getattr(customer, "country", "")),
    }


def _customer_billing_address(customer: Customer) -> Dict[str, str]:
    return {
        "street": _clean_customer_contact_value(getattr(customer, "billing_street", "")),
        "postal_code": _clean_customer_contact_value(getattr(customer, "billing_postal_code", "")),
        "city": _clean_customer_contact_value(getattr(customer, "billing_city", "")),
        "country": _clean_customer_contact_value(getattr(customer, "billing_country", "")),
    }


def _customer_effective_address(customer: Customer) -> Dict[str, str]:
    general = _customer_general_address(customer)
    billing = _customer_billing_address(customer)
    return {
        "street": general["street"] or billing["street"],
        "postal_code": general["postal_code"] or billing["postal_code"],
        "city": general["city"] or billing["city"],
        "country": general["country"] or billing["country"],
    }


def _customer_primary_address_source(customer: Customer) -> str:
    general = _customer_general_address(customer)
    if any(general.values()):
        return "general"
    billing = _customer_billing_address(customer)
    return "billing" if any(billing.values()) else "general"


def _customer_address_text(address: Dict[str, Any]) -> str:
    street = _clean_customer_contact_value(address.get("street"))
    postal_code = _clean_customer_contact_value(address.get("postal_code"))
    city = _clean_customer_contact_value(address.get("city"))
    country = _clean_customer_contact_value(address.get("country"))
    return ", ".join(
        [part for part in [street, f"{postal_code} {city}".strip(), country] if part]
    )


def _sevdesk_contact_candidate_objects(contact: Dict[str, Any]) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    seen: Set[int] = set()

    def _append(value: Any) -> None:
        if isinstance(value, dict):
            marker = id(value)
            if marker not in seen:
                seen.add(marker)
                candidates.append(value)
        elif isinstance(value, list):
            for item in value:
                _append(item)

    _append(contact)
    for key in (
        "invoiceAddress",
        "invoice_address",
        "billingAddress",
        "billing_address",
        "mainAddress",
        "main_address",
        "address",
        "contactAddress",
        "contact_address",
        "addresses",
        "invoice",
        "billing",
    ):
        _append(contact.get(key))
    return candidates


def _sevdesk_extract_string(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("name", "value", "text", "label"):
            nested = _clean_customer_contact_value(value.get(key))
            if nested:
                return nested
        return ""
    return _clean_customer_contact_value(value)


def _sevdesk_find_contact_string(contact: Dict[str, Any], keys: Tuple[str, ...]) -> str:
    for candidate in _sevdesk_contact_candidate_objects(contact):
        for key in keys:
            value = _sevdesk_extract_string(candidate.get(key))
            if value:
                return value
    return ""


def _extract_sevdesk_contact_email(contact: Dict[str, Any]) -> str:
    for email in [
        _sevdesk_find_contact_string(
            contact,
            (
                "invoiceEmail",
                "invoice_email",
                "billingEmail",
                "billing_email",
                "email",
                "email1",
                "email2",
                "mainEmail",
                "freemail",
            ),
        )
    ]:
        if email and "@" in email:
            return email
    return ""


def _extract_sevdesk_contact_billing_address(contact: Dict[str, Any]) -> Dict[str, str]:
    return {
        "street": _sevdesk_find_contact_string(
            contact,
            (
                "invoiceStreet",
                "billingStreet",
                "street",
                "streetName",
                "street_name",
                "address1",
                "streetAddress",
            ),
        ),
        "postal_code": _sevdesk_find_contact_string(
            contact,
            ("invoiceZip", "billingZip", "zip", "zipcode", "postalCode", "postal_code", "postcode"),
        ),
        "city": _sevdesk_find_contact_string(
            contact,
            ("invoiceCity", "billingCity", "city", "town"),
        ),
        "country": _sevdesk_find_contact_string(
            contact,
            ("invoiceCountry", "billingCountry", "country", "countryName", "addressCountry"),
        ),
    }


def _normalize_customer_number(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    # Match customer numbers resilient against separators/spacing changes.
    return re.sub(r"[^A-Za-z0-9]+", "", raw).upper()


def _resolve_local_customer_number_by_name(db: Session, customer_name: Any) -> str:
    raw_name = str(customer_name or "").strip()
    if not raw_name:
        return ""
    target_key = _dev_normalize_text(raw_name)
    candidates = (
        db.query(Customer)
        .filter(func.lower(func.trim(Customer.name)) == func.lower(func.trim(raw_name)))
        .all()
    )
    if not candidates:
        candidates = db.query(Customer).all()
    best_number = ""
    best_score = -1
    for customer in candidates:
        number = str(customer.creditor_number or customer.short_code or "").strip()
        if not number:
            continue
        score = 0
        candidate_key = _dev_normalize_text(customer.name)
        if target_key and candidate_key:
            if candidate_key == target_key:
                score += 100
            elif target_key in candidate_key or candidate_key in target_key:
                score += 45
        if str(customer.status or "active").strip().lower() == "active":
            score += 5
        if score > best_score:
            best_score = score
            best_number = number
    return best_number


def _resolve_offer_customer_number(db: Session, offer_payload: Dict[str, Any]) -> str:
    explicit = str(offer_payload.get("customerNumber") or "").strip()
    if explicit:
        return explicit
    for key in ("customer", "recipientCompany", "recipient_company", "name"):
        number = _resolve_local_customer_number_by_name(db, offer_payload.get(key))
        if number:
            return number
    return ""


def _find_sevdesk_contact_by_customer_number(
    client: SevdeskClient, customer_number: Any
) -> Tuple[Optional[Dict[str, Any]], str]:
    raw_value = str(customer_number or "").strip()
    normalized_value = _normalize_customer_number(raw_value)
    seen: Set[str] = set()
    for candidate in (raw_value, normalized_value):
        value = str(candidate or "").strip()
        if not value:
            continue
        marker = value.lower()
        if marker in seen:
            continue
        seen.add(marker)
        contact = client.get_contact_by_customer_number(value)
        if contact:
            return contact, value
    return None, raw_value


def _build_sevdesk_customer_rows(
    integration: Optional[IntegrationSettings],
    metrics_settings: Optional[CustomerMetricsSettings],
    now_dt: datetime,
) -> List[Dict[str, Any]]:
    if not integration:
        return []
    config = _build_sevdesk_config(integration, metrics_settings)
    if not config.api_token:
        return []
    try:
        client = SevdeskClient(config, timeout=20)
        sevdesk_stats = _build_sevdesk_stats(
            client,
            now_dt,
            include_financial_overview=False,
            invoices_max_pages=60,
            resolve_contacts_limit=None,
        )
        rows = sevdesk_stats.get("customerPaymentStats")
        return rows if isinstance(rows, list) else []
    except SevdeskError:
        return []


def _match_sevdesk_row(customer: Customer, rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not rows:
        return None
    customer_number = str(customer.creditor_number or "").strip()
    customer_name = _dev_normalize_text(customer.name)
    best = None
    best_score = -1
    for row in rows:
        score = 0
        row_name = _dev_normalize_text(row.get("name"))
        if customer_number:
            row_number = _dev_normalize_text(row.get("customerNumber") or row.get("customer_number"))
            if row_number and row_number == _dev_normalize_text(customer_number):
                score += 100
        if customer_name and row_name:
            if customer_name == row_name:
                score += 80
            elif customer_name in row_name or row_name in customer_name:
                score += 45
        if score > best_score:
            best_score = score
            best = row
    return best if best_score > 0 else None


def _extract_invoice_activity_from_row(row: Optional[Dict[str, Any]], now_dt: datetime) -> Tuple[int, Optional[int], bool]:
    if not isinstance(row, dict):
        return 0, None, False
    latest = _parse_sevdesk_date(row.get("historyTo"))
    if not latest:
        return 0, None, False
    latest_ms = int(latest.timestamp() * 1000)
    days_since = max(0, (now_dt.date() - latest.date()).days)
    return latest_ms, days_since, days_since >= 75


def _clean_invoice_position_text(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _summarize_invoice_position_texts(rows: List[Dict[str, Any]], *, max_items: int = 3) -> List[str]:
    snippets: List[str] = []
    for row in rows:
        name = _clean_invoice_position_text(row.get("name"))
        body = _clean_invoice_position_text(row.get("text"))
        merged = " - ".join(part for part in [name, body] if part).strip(" -")
        if not merged:
            continue
        if len(merged) > 180:
            merged = merged[:177].rstrip() + "..."
        if merged.lower() in {item.lower() for item in snippets}:
            continue
        snippets.append(merged)
        if len(snippets) >= max_items:
            break
    return snippets


def _build_recent_work_summary_ai_text(customer_name: str, invoice_items: List[Dict[str, Any]]) -> str:
    if not invoice_items:
        return ""
    lines: List[str] = []
    for item in invoice_items[:5]:
        date_text = str(item.get("date") or "n/a")
        amount = float(item.get("amountEur") or 0.0)
        position_snippets = item.get("positionSnippets") or []
        position_text = "; ".join(str(part) for part in position_snippets[:3] if str(part).strip())
        lines.append(f"- {date_text} ({amount:.2f} EUR): {position_text or 'Keine Positionsdetails'}")
    prompt = (
        "Fasse die letzten durchgefuehrten Arbeiten bei einem IT-Kunden kurz zusammen. "
        "Antworte auf Deutsch in max. 4 Saetzen, sachlich, konkret, ohne Aufzaehlung.\n\n"
        f"Kunde: {customer_name or 'Kunde'}\n"
        f"Rechnungspositionen:\n{chr(10).join(lines)}"
    )
    try:
        model_candidates = _resolve_ai_models(MODEL_PREF_INVOICE_SUMMARY, purpose="invoice_summary")
        data, _, _ = _ai_generate(
            prompt,
            model_candidates=model_candidates,
            timeout=10,
            max_tokens=180,
        )
        return str(data.get("response") or "").strip()
    except Exception:
        return ""


def _build_customer_recent_work_summary(
    *,
    integration: Optional[IntegrationSettings],
    metrics_settings: Optional[CustomerMetricsSettings],
    customer: Customer,
    matched_sevdesk: Optional[Dict[str, Any]],
    now_dt: datetime,
    include_ai: bool = False,
) -> Dict[str, Any]:
    base = {
        "available": False,
        "source": "sevdesk",
        "contactId": "",
        "lastInvoiceAt": 0,
        "daysSinceLastInvoice": None,
        "inactivityDue": False,
        "items": [],
        "summary": "",
    }
    if not integration:
        return base
    now_ms = int(time.time() * 1000)
    config = _build_sevdesk_config(integration, metrics_settings)
    if not config.api_token:
        return base

    contact_id = str((matched_sevdesk or {}).get("contactId") or "").strip()
    if not contact_id and str(customer.creditor_number or "").strip():
        try:
            client = SevdeskClient(config, timeout=8)
            contact = client.get_contact_by_customer_number(str(customer.creditor_number or "").strip())
            contact_id = str((contact or {}).get("id") or "").strip()
        except Exception:
            contact_id = ""
    if not contact_id:
        return base

    cache_key = f"{int(customer.id)}:{contact_id}:{1 if include_ai else 0}"
    cached = _recent_work_summary_cache.get(cache_key)
    if cached and (now_ms - int(cached.get("cachedAt") or 0)) < RECENT_WORK_SUMMARY_CACHE_TTL_MS:
        payload = cached.get("payload")
        if isinstance(payload, dict):
            return payload

    try:
        client = SevdeskClient(config, timeout=8)
        invoices = client.list_invoices(
            params={
                "contact[id]": contact_id,
                "contact[objectName]": "Contact",
                "invoiceType": config.invoice_type or "RE",
            },
            max_pages=8,
            limit=50,
        )
    except Exception:
        return base
    if not invoices:
        return base

    filtered: List[Dict[str, Any]] = []
    for inv in invoices:
        status = _parse_int(inv.get("status"))
        if status in (100, 400):
            continue
        inv_date = _parse_sevdesk_date(inv.get("invoiceDate"))
        if not inv_date:
            continue
        amount = _parse_sevdesk_amount(inv)
        if amount <= 0:
            continue
        filtered.append({"invoice": inv, "date": inv_date, "amount": amount})
    if not filtered:
        return base
    filtered.sort(key=lambda item: item["date"], reverse=True)
    selected = filtered[:5]

    items: List[Dict[str, Any]] = []
    for entry in selected:
        inv = entry["invoice"]
        inv_id = str(inv.get("id") or "").strip()
        position_rows: List[Dict[str, Any]] = []
        if inv_id.isdigit():
            try:
                pos_payload = client.request(
                    "GET",
                    "/InvoicePos",
                    params={
                        "invoice[id]": inv_id,
                        "invoice[objectName]": "Invoice",
                        "limit": 120,
                        "offset": 0,
                    },
                )
                objects = pos_payload.get("objects")
                if isinstance(objects, list):
                    position_rows = [row for row in objects if isinstance(row, dict)]
                elif isinstance(objects, dict):
                    position_rows = [objects]
            except Exception:
                position_rows = []
        snippets = _summarize_invoice_position_texts(position_rows)
        items.append(
            {
                "invoiceId": int(inv_id) if inv_id.isdigit() else 0,
                "invoiceNumber": str(
                    inv.get("invoiceNumber")
                    or inv.get("invoiceNumberDefault")
                    or inv.get("number")
                    or ""
                ).strip(),
                "date": entry["date"].strftime("%Y-%m-%d"),
                "amountEur": round(float(entry["amount"] or 0.0), 2),
                "positionSnippets": snippets,
            }
        )

    newest_date = selected[0]["date"]
    newest_ms = int(newest_date.timestamp() * 1000)
    days_since = max(0, (now_dt.date() - newest_date.date()).days)
    inactivity_due = days_since >= 75
    fallback_snippets: List[str] = []
    for item in items[:3]:
        snippets = item.get("positionSnippets") or []
        if snippets:
            fallback_snippets.append(snippets[0])
    fallback_summary = (
        "Letzte Leistungen: "
        + ("; ".join(fallback_snippets) if fallback_snippets else "Zu den letzten Rechnungen sind keine Positionsdetails vorhanden.")
    )
    ai_summary = ""
    if include_ai:
        ai_summary = _build_recent_work_summary_ai_text(str(customer.name or "").strip(), items)

    result = {
        "available": True,
        "source": "sevdesk",
        "contactId": contact_id,
        "lastInvoiceAt": newest_ms,
        "daysSinceLastInvoice": days_since,
        "inactivityDue": inactivity_due,
        "items": items,
        "summary": fallback_summary,
        "aiSummary": ai_summary,
        "hasAiSummary": bool(str(ai_summary or "").strip()),
    }
    _recent_work_summary_cache[cache_key] = {"cachedAt": now_ms, "payload": result}
    return result


def _customer_task_filter(customer: Customer) -> List[Any]:
    filters = []
    customer_name = (customer.name or "").strip().lower()
    customer_number = (customer.creditor_number or "").strip()
    if customer_name:
        filters.append(func.lower(func.trim(DayTask.customer)) == customer_name)
    if customer_number:
        filters.append(func.trim(DayTask.customer_number) == customer_number)
    return filters


def _customer_telephony_metrics(phone_numbers: List[str], start_ms: int) -> Dict[str, Any]:
    phone_digits = []
    for number in phone_numbers:
        normalized = _normalize_phone(number)
        if normalized and normalized not in phone_digits:
            phone_digits.append(normalized)
    if not phone_digits:
        return {"minutes": 0, "missed": 0, "calls": 0}
    conditions = []
    params: Dict[str, Any] = {"since": start_ms}
    for idx, digits in enumerate(phone_digits):
        params[f"p{idx}"] = f"%{digits}"
        conditions.append(
            f"(regexp_replace(from_number, '\\\\D', '', 'g') LIKE :p{idx} "
            f"OR regexp_replace(to_number, '\\\\D', '', 'g') LIKE :p{idx})"
        )
    where_clause = " OR ".join(conditions)
    sql = (
        "SELECT COALESCE(SUM(duration), 0) AS total_seconds, "
        "COALESCE(SUM(CASE WHEN answered = false THEN 1 ELSE 0 END), 0) AS missed_calls, "
        "COALESCE(COUNT(*), 0) AS total_calls "
        "FROM telephony_calls "
        "WHERE start_time >= :since AND (" + where_clause + ")"
    )
    try:
        with engine.begin() as connection:
            row = connection.execute(text(sql), params).mappings().first()
            if not row:
                return {"minutes": 0, "missed": 0, "calls": 0}
            seconds = int(row.get("total_seconds") or 0)
            return {
                "minutes": round(seconds / 60, 1) if seconds else 0,
                "missed": int(row.get("missed_calls") or 0),
                "calls": int(row.get("total_calls") or 0),
            }
    except Exception:
        return {"minutes": 0, "missed": 0, "calls": 0}


def _contract_doc_type_for_budget(row: CustomerContractDocument) -> str:
    candidates = [
        str(row.doc_type or "").strip().lower(),
        str(row.template_key or "").strip().lower(),
    ]
    aliases = {
        "maintenance": "wartung",
        "wartungsvertrag": "wartung",
        "monitoringvertrag": "monitoring",
    }
    for raw in candidates:
        key = aliases.get(raw, raw)
        if key in {"wartung", "monitoring"}:
            return key
    return ""


def _month_bounds_ms(now_dt: datetime) -> Tuple[int, int]:
    month_start = datetime(now_dt.year, now_dt.month, 1)
    if now_dt.month == 12:
        next_month_start = datetime(now_dt.year + 1, 1, 1)
    else:
        next_month_start = datetime(now_dt.year, now_dt.month + 1, 1)
    return int(month_start.timestamp() * 1000), int(next_month_start.timestamp() * 1000)


def _month_bounds_with_offset(now_dt: datetime, offset_months: int = 0) -> Tuple[int, int, str]:
    year = int(now_dt.year)
    month = int(now_dt.month) + int(offset_months or 0)
    while month <= 0:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    month_start = datetime(year, month, 1)
    if month == 12:
        next_month_start = datetime(year + 1, 1, 1)
    else:
        next_month_start = datetime(year, month + 1, 1)
    return (
        int(month_start.timestamp() * 1000),
        int(next_month_start.timestamp() * 1000),
        f"{month:02d}/{year:04d}",
    )


def _customer_telephony_metrics_window(
    phone_numbers: List[str],
    start_ms: int,
    end_ms: int,
) -> Dict[str, Any]:
    phone_digits: List[str] = []
    for number in phone_numbers:
        normalized = _normalize_phone(number)
        if normalized and normalized not in phone_digits:
            phone_digits.append(normalized)
    if not phone_digits:
        return {"seconds": 0, "minutes": 0.0, "missed": 0, "calls": 0}

    params: Dict[str, Any] = {"since": int(start_ms), "until": int(end_ms)}
    conditions = []
    for idx, digits in enumerate(phone_digits):
        params[f"p{idx}"] = f"%{digits}"
        conditions.append(
            f"(regexp_replace(from_number, '\\\\D', '', 'g') LIKE :p{idx} "
            f"OR regexp_replace(to_number, '\\\\D', '', 'g') LIKE :p{idx})"
        )
    where_clause = " OR ".join(conditions)
    sql = (
        "SELECT COALESCE(SUM(duration), 0) AS total_seconds, "
        "COALESCE(SUM(CASE WHEN answered = false THEN 1 ELSE 0 END), 0) AS missed_calls, "
        "COALESCE(COUNT(*), 0) AS total_calls "
        "FROM telephony_calls "
        "WHERE start_time >= :since AND start_time < :until AND (" + where_clause + ")"
    )
    try:
        with engine.begin() as connection:
            row = connection.execute(text(sql), params).mappings().first()
            if not row:
                return {"seconds": 0, "minutes": 0.0, "missed": 0, "calls": 0}
            seconds = int(row.get("total_seconds") or 0)
            return {
                "seconds": seconds,
                "minutes": round(seconds / 60.0, 1) if seconds else 0.0,
                "missed": int(row.get("missed_calls") or 0),
                "calls": int(row.get("total_calls") or 0),
            }
    except Exception:
        return {"seconds": 0, "minutes": 0.0, "missed": 0, "calls": 0}


def _customer_timed_task_metrics_window(
    db,
    customer: Customer,
    start_ms: int,
    end_ms: int,
    now_ms: int,
    wartungsvertrag: Optional[bool] = None,
) -> Dict[str, Any]:
    task_filters = _customer_task_filter(customer)
    if not task_filters:
        return {"milliseconds": 0, "hours": 0.0, "count": 0}
    timed_tasks = (
        db.query(DayTask)
        .filter(or_(*task_filters))
        .filter(DayTask.time_enabled == True)
        .all()
    )
    total_ms = 0
    count = 0
    for task in timed_tasks:
        status = str(task.status or "").strip().lower()
        completed_at = int(task.completed_at or 0)
        created_at = int(task.created_at or 0)
        start_time = int(task.startTime or 0)
        include_task = False
        if status == "done":
            anchor = completed_at or created_at
            include_task = anchor > 0 and int(start_ms) <= anchor < int(end_ms)
        else:
            anchor = created_at or start_time
            include_task = anchor > 0 and int(start_ms) <= anchor < int(end_ms)
        if not include_task:
            continue
        if wartungsvertrag is True and not bool(task.wartungsvertrag):
            continue
        if wartungsvertrag is False and bool(task.wartungsvertrag):
            continue
        elapsed = int(task.elapsed or 0)
        if bool(task.running) and start_time > 0 and int(start_ms) <= start_time < int(end_ms):
            window_end = min(int(now_ms), int(end_ms))
            if window_end > start_time:
                elapsed += max(0, window_end - start_time)
        if elapsed <= 0:
            continue
        total_ms += elapsed
        count += 1
    return {
        "milliseconds": int(total_ms),
        "hours": round(total_ms / 3_600_000.0, 2) if total_ms else 0.0,
        "count": int(count),
    }


def _build_contracts_stats(db, now_ms: int) -> Dict[str, Any]:
    now_dt = datetime.fromtimestamp(now_ms / 1000)
    current_start_ms, current_end_ms, current_label = _month_bounds_with_offset(now_dt, 0)
    previous_start_ms, previous_end_ms, previous_label = _month_bounds_with_offset(now_dt, -1)

    customers = (
        db.query(Customer)
        .order_by(func.lower(func.trim(Customer.name)).asc(), Customer.id.asc())
        .all()
    )
    contract_docs = (
        db.query(CustomerContractDocument)
        .filter(CustomerContractDocument.status.in_(["proposal", "active"]))
        .order_by(
            CustomerContractDocument.customer_id.asc(),
            CustomerContractDocument.created_at.desc(),
            CustomerContractDocument.id.desc(),
        )
        .all()
    )
    calc_rows = (
        db.query(CustomerContractCalculation)
        .order_by(
            CustomerContractCalculation.customer_id.asc(),
            CustomerContractCalculation.created_at.desc(),
            CustomerContractCalculation.id.desc(),
        )
        .all()
    )
    docs_by_customer: Dict[int, List[CustomerContractDocument]] = {}
    for row in contract_docs:
        customer_id = int(row.customer_id or 0)
        if customer_id <= 0:
            continue
        docs_by_customer.setdefault(customer_id, []).append(row)
    latest_calc_by_customer_category: Dict[Tuple[int, str], CustomerContractCalculation] = {}
    for calc in calc_rows:
        customer_id = int(calc.customer_id or 0)
        if customer_id <= 0:
            continue
        category = str(calc.tariff_category or "").strip().lower()
        if category not in {"wartung", "monitoring"}:
            continue
        key = (customer_id, category)
        if key in latest_calc_by_customer_category:
            continue
        latest_calc_by_customer_category[key] = calc

    rows: List[Dict[str, Any]] = []
    total_contracts = 0
    unpaid_contracts = 0
    proposal_contracts = 0
    invoiced_contracts = 0
    total_hours_soll = 0.0
    total_hours_current = 0.0
    total_hours_previous = 0.0
    total_consumed_current = 0.0
    total_consumed_previous = 0.0
    total_outside_current = 0.0
    total_outside_previous = 0.0
    total_revenue_monthly = 0.0
    total_revenue_monthly_active = 0.0

    for customer in customers:
        customer_id = int(customer.id or 0)
        customer_docs = docs_by_customer.get(customer_id, [])
        if not customer_docs:
            continue

        contracts: List[Dict[str, Any]] = []
        contract_type_counts: Dict[str, int] = {}
        service_contract_counts: Dict[str, int] = {"wartung": 0, "monitoring": 0}
        customer_unpaid_contracts = 0
        customer_proposal_contracts = 0
        customer_invoiced_contracts = 0
        monthly_hours_soll = 0.0

        for doc in customer_docs:
            contract_status = _normalize_contract_document_status(doc.status, allow_cancelled=False)
            if contract_status not in {"proposal", "active"}:
                continue
            contract_type = _normalize_contract_doc_type(
                doc.doc_type or doc.template_key,
                default="wartung",
            )
            title = str(doc.title or "").strip() or "Vertrag"
            monthly_hours_included = _safe_nonnegative_float(doc.monthly_hours_included or 0.0)
            if contract_type in {"wartung", "monitoring"}:
                monthly_hours_soll += monthly_hours_included
                service_contract_counts[contract_type] = int(service_contract_counts.get(contract_type, 0)) + 1
            contract_type_counts[contract_type] = int(contract_type_counts.get(contract_type, 0)) + 1
            contracts.append(
                {
                    "id": int(doc.id),
                    "status": contract_status,
                    "type": contract_type,
                    "title": title,
                    "monthlyHoursIncluded": round(monthly_hours_included, 2),
                    "createdAt": int(doc.created_at or 0),
                    "inferred": False,
                }
            )
            if contract_status == "proposal":
                customer_proposal_contracts += 1
            else:
                customer_invoiced_contracts += 1

        if not contracts:
            continue

        contract_hours_current = monthly_hours_soll
        contract_hours_previous = monthly_hours_soll

        task_contract_current = _customer_timed_task_metrics_window(
            db,
            customer,
            current_start_ms,
            current_end_ms,
            now_ms,
            wartungsvertrag=True,
        )
        task_contract_previous = _customer_timed_task_metrics_window(
            db,
            customer,
            previous_start_ms,
            previous_end_ms,
            now_ms,
            wartungsvertrag=True,
        )
        task_outside_current = _customer_timed_task_metrics_window(
            db,
            customer,
            current_start_ms,
            current_end_ms,
            now_ms,
            wartungsvertrag=False,
        )
        task_outside_previous = _customer_timed_task_metrics_window(
            db,
            customer,
            previous_start_ms,
            previous_end_ms,
            now_ms,
            wartungsvertrag=False,
        )

        consumed_current_hours = round(float(task_contract_current.get("hours") or 0.0), 2)
        consumed_previous_hours = round(float(task_contract_previous.get("hours") or 0.0), 2)
        outside_current_hours = round(float(task_outside_current.get("hours") or 0.0), 2)
        outside_previous_hours = round(float(task_outside_previous.get("hours") or 0.0), 2)

        revenue_monthly_wartung = _safe_nonnegative_float(
            (
                latest_calc_by_customer_category.get((customer_id, "wartung")).monthly_total
                if latest_calc_by_customer_category.get((customer_id, "wartung"))
                else 0.0
            )
        )
        revenue_monthly_monitoring = _safe_nonnegative_float(
            (
                latest_calc_by_customer_category.get((customer_id, "monitoring")).monthly_total
                if latest_calc_by_customer_category.get((customer_id, "monitoring"))
                else 0.0
            )
        )
        revenue_monthly_customer = round(revenue_monthly_wartung + revenue_monthly_monitoring, 2)
        revenue_monthly_active_customer = 0.0
        service_contract_count_total = int(service_contract_counts.get("wartung", 0)) + int(
            service_contract_counts.get("monitoring", 0)
        )
        for contract in contracts:
            contract_type = str(contract.get("type") or "")
            if contract_type == "wartung":
                split_count = max(1, int(service_contract_counts.get("wartung", 0)))
                contract_value = revenue_monthly_wartung / split_count
            elif contract_type == "monitoring":
                split_count = max(1, int(service_contract_counts.get("monitoring", 0)))
                contract_value = revenue_monthly_monitoring / split_count
            else:
                contract_value = 0.0
            contract_status = str(contract.get("status") or "")
            contract["monthlyValue"] = round(contract_value, 2)
            if contract_status == "active":
                revenue_monthly_active_customer += contract_value
        revenue_monthly_active_customer = round(revenue_monthly_active_customer, 2)
        revenue_per_contract_customer = (
            round(revenue_monthly_customer / float(service_contract_count_total), 2)
            if service_contract_count_total > 0
            else 0.0
        )

        total_contracts += len(contracts)
        unpaid_contracts += customer_unpaid_contracts
        proposal_contracts += customer_proposal_contracts
        invoiced_contracts += customer_invoiced_contracts
        total_hours_soll += monthly_hours_soll
        total_hours_current += contract_hours_current
        total_hours_previous += contract_hours_previous
        total_consumed_current += consumed_current_hours
        total_consumed_previous += consumed_previous_hours
        total_outside_current += outside_current_hours
        total_outside_previous += outside_previous_hours
        total_revenue_monthly += revenue_monthly_customer
        total_revenue_monthly_active += revenue_monthly_active_customer

        primary_contract = contracts[0] if contracts else {}

        rows.append(
            {
                "customerId": customer_id,
                "customerName": str(customer.name or "").strip() or f"Kunde #{customer_id}",
                "customerNumber": str(customer.creditor_number or "").strip(),
                "customerStatus": str(customer.status or "active").strip().lower() or "active",
                "contractCount": len(contracts),
                "unpaidContractCount": int(customer_unpaid_contracts),
                "proposalContractCount": int(customer_proposal_contracts),
                "invoicedContractCount": int(customer_invoiced_contracts),
                "contractTypeCounts": _normalize_contract_type_counts(contract_type_counts),
                "contracts": contracts,
                "contractStatus": str(primary_contract.get("status") or "active"),
                "contractType": str(primary_contract.get("type") or "wartung"),
                "contractTitle": str(primary_contract.get("title") or "Vertrag"),
                "contractHoursSoll": round(monthly_hours_soll, 2),
                "contractHoursCurrentMonth": round(contract_hours_current, 2),
                "contractHoursPreviousMonth": round(contract_hours_previous, 2),
                "contractRevenueMonthly": revenue_monthly_customer,
                "contractRevenueMonthlyActive": revenue_monthly_active_customer,
                "contractRevenuePerContractMonthly": revenue_per_contract_customer,
                "consumedHoursCurrentMonth": consumed_current_hours,
                "consumedHoursPreviousMonth": consumed_previous_hours,
                "outsideContractHoursCurrentMonth": outside_current_hours,
                "outsideContractHoursPreviousMonth": outside_previous_hours,
                "taskHoursCurrentMonth": consumed_current_hours,
                "taskHoursPreviousMonth": consumed_previous_hours,
                "taskCountCurrentMonth": int(task_contract_current.get("count") or 0),
                "taskCountPreviousMonth": int(task_contract_previous.get("count") or 0),
                "outsideTaskCountCurrentMonth": int(task_outside_current.get("count") or 0),
                "outsideTaskCountPreviousMonth": int(task_outside_previous.get("count") or 0),
                "telephonyHoursCurrentMonth": 0.0,
                "telephonyHoursPreviousMonth": 0.0,
                "callCountCurrentMonth": 0,
                "callCountPreviousMonth": 0,
                "deltaHoursCurrentMonth": round(consumed_current_hours - contract_hours_current, 2),
                "deltaHoursPreviousMonth": round(consumed_previous_hours - contract_hours_previous, 2),
            }
        )

    rows.sort(key=lambda item: str(item.get("customerName") or "").lower())
    return {
        "totalContracts": int(total_contracts),
        "customersWithContract": len(rows),
        "totalContractDocuments": len(contract_docs),
        "unpaidContracts": int(unpaid_contracts),
        "proposalContracts": int(proposal_contracts),
        "invoicedContracts": int(invoiced_contracts),
        "monthLabels": {
            "current": current_label,
            "previous": previous_label,
        },
        "hours": {
            "soll": round(total_hours_soll, 2),
            "currentMonth": round(total_hours_current, 2),
            "previousMonth": round(total_hours_previous, 2),
            "consumedCurrentMonth": round(total_consumed_current, 2),
            "consumedPreviousMonth": round(total_consumed_previous, 2),
            "outsideCurrentMonth": round(total_outside_current, 2),
            "outsidePreviousMonth": round(total_outside_previous, 2),
            "deltaCurrentMonth": round(total_consumed_current - total_hours_current, 2),
            "deltaPreviousMonth": round(total_consumed_previous - total_hours_previous, 2),
        },
        "revenue": {
            "monthlyTotal": round(total_revenue_monthly, 2),
            "monthlyActiveTotal": round(total_revenue_monthly_active, 2),
            "perContractMonthly": round(total_revenue_monthly / float(total_contracts), 2)
            if total_contracts > 0
            else 0.0,
        },
        "rows": rows,
    }


def _sevdesk_row_has_unpaid_invoices(row: Dict[str, Any]) -> bool:
    if not isinstance(row, dict):
        return False
    open_invoices = _parse_int(row.get("openInvoices")) or 0
    open_overdue_invoices = _parse_int(row.get("openOverdueInvoices"))
    if open_overdue_invoices is not None:
        open_invoices = max(open_invoices, int(open_overdue_invoices))
    open_amount = _parse_float(row.get("openAmountEur"), default=0.0)
    open_overdue_amount = _parse_float(
        row.get("openOverdueAmountEur", row.get("openAmountEur")),
        default=0.0,
    )
    return open_invoices > 0 or open_amount > 0.009 or open_overdue_amount > 0.009


def _apply_contract_payment_status(
    contracts_stats: Dict[str, Any],
    customer_payment_rows: List[Dict[str, Any]],
) -> Dict[str, Any]:
    rows = contracts_stats.get("rows")
    if not isinstance(rows, list):
        return contracts_stats

    unpaid_by_number: Dict[str, bool] = {}
    unpaid_by_name: Dict[str, bool] = {}
    for payment_row in customer_payment_rows:
        if not isinstance(payment_row, dict):
            continue
        has_unpaid = _sevdesk_row_has_unpaid_invoices(payment_row)
        number_key = _normalize_customer_number(
            payment_row.get("customerNumber") or payment_row.get("customer_number")
        )
        if number_key:
            unpaid_by_number[number_key] = bool(unpaid_by_number.get(number_key) or has_unpaid)
        name_key = _dev_normalize_text(payment_row.get("name"))
        if name_key:
            unpaid_by_name[name_key] = bool(unpaid_by_name.get(name_key) or has_unpaid)

    total_unpaid_contracts = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        number_key = _normalize_customer_number(row.get("customerNumber"))
        name_key = _dev_normalize_text(row.get("customerName"))
        has_unpaid = False
        if number_key:
            has_unpaid = bool(unpaid_by_number.get(number_key, False))
        if not has_unpaid and name_key:
            has_unpaid = bool(unpaid_by_name.get(name_key, False))

        row_unpaid_contracts = 0
        contracts = row.get("contracts")
        if isinstance(contracts, list):
            for contract in contracts:
                if not isinstance(contract, dict):
                    continue
                is_active = str(contract.get("status") or "").strip().lower() == "active"
                contract_unpaid = bool(has_unpaid and is_active)
                contract["unpaidPayment"] = contract_unpaid
                if contract_unpaid:
                    row_unpaid_contracts += 1
        row["unpaidContractCount"] = int(row_unpaid_contracts)
        row["hasUnpaidPayment"] = bool(row_unpaid_contracts > 0)
        total_unpaid_contracts += row_unpaid_contracts

    contracts_stats["unpaidContracts"] = int(total_unpaid_contracts)
    return contracts_stats


def _customer_contract_time_budget(db, customer: Customer, now_ms: int) -> Dict[str, Any]:
    now_dt = datetime.fromtimestamp(now_ms / 1000)
    start_month_ms, next_month_ms = _month_bounds_ms(now_dt)
    month_label = f"{now_dt.month:02d}/{now_dt.year:04d}"

    active_contract_docs = (
        db.query(CustomerContractDocument)
        .filter(CustomerContractDocument.customer_id == int(customer.id))
        .filter(CustomerContractDocument.status == "active")
        .order_by(CustomerContractDocument.created_at.desc(), CustomerContractDocument.id.desc())
        .all()
    )
    budget_contracts: List[Dict[str, Any]] = []
    included_hours_total = 0.0
    for row in active_contract_docs:
        category = _contract_doc_type_for_budget(row)
        if category not in {"wartung", "monitoring"}:
            continue
        hours = _safe_nonnegative_float(row.monthly_hours_included or 0.0)
        included_hours_total += hours
        budget_contracts.append(
            {
                "id": int(row.id),
                "title": str(row.title or "").strip() or "Vertrag",
                "category": category,
                "monthlyHoursIncluded": round(hours, 2),
                "createdAt": int(row.created_at or 0),
            }
        )
    has_service_contract = len(budget_contracts) > 0

    task_filters = _customer_task_filter(customer)
    task_ms = 0
    task_count = 0
    if task_filters:
        timed_tasks = (
            db.query(DayTask)
            .filter(or_(*task_filters))
            .filter(DayTask.time_enabled == True)
            .all()
        )
        for task in timed_tasks:
            status = str(task.status or "").strip().lower()
            completed_at = int(task.completed_at or 0)
            created_at = int(task.created_at or 0)
            include_task = False
            if status == "done":
                if completed_at > 0:
                    include_task = start_month_ms <= completed_at < next_month_ms
                elif created_at > 0:
                    include_task = start_month_ms <= created_at < next_month_ms
            elif created_at > 0:
                include_task = start_month_ms <= created_at < next_month_ms
            if not include_task:
                continue
            elapsed = int(task.elapsed or 0)
            if bool(task.running) and int(task.startTime or 0) > 0:
                elapsed += max(0, now_ms - int(task.startTime or 0))
            if elapsed <= 0:
                continue
            task_ms += elapsed
            task_count += 1

    phone_numbers = [phone.number for phone in customer.phones]
    telephony = _customer_telephony_metrics(phone_numbers, start_month_ms)
    phone_minutes = float(telephony.get("minutes") or 0.0)
    phone_ms = int(round(phone_minutes * 60_000.0))
    call_count = int(telephony.get("calls") or 0)

    included_ms = int(round(included_hours_total * 3_600_000.0))
    total_consumed_ms = max(0, int(task_ms + phone_ms))
    balance_ms = int(included_ms - total_consumed_ms)
    overrun_ms = max(0, -balance_ms)
    remaining_ms = max(0, balance_ms)

    return {
        "monthLabel": month_label,
        "monthStartMs": start_month_ms,
        "monthEndMs": next_month_ms,
        "hasServiceContract": bool(has_service_contract),
        "activeBudgetContracts": budget_contracts,
        "activeBudgetContractsCount": len(budget_contracts),
        "includedHours": round(included_hours_total, 2),
        "includedMinutes": round(included_hours_total * 60.0, 1),
        "taskHours": round(task_ms / 3_600_000.0, 2) if task_ms else 0.0,
        "taskMinutes": round(task_ms / 60_000.0, 1) if task_ms else 0.0,
        "taskCount": int(task_count),
        "telephonyHours": round(phone_minutes / 60.0, 2) if phone_minutes else 0.0,
        "telephonyMinutes": round(phone_minutes, 1) if phone_minutes else 0.0,
        "callCount": int(call_count),
        "consumedHours": round(total_consumed_ms / 3_600_000.0, 2) if total_consumed_ms else 0.0,
        "consumedMinutes": round(total_consumed_ms / 60_000.0, 1) if total_consumed_ms else 0.0,
        "balanceHours": round(balance_ms / 3_600_000.0, 2) if balance_ms else 0.0,
        "remainingHours": round(remaining_ms / 3_600_000.0, 2) if remaining_ms else 0.0,
        "overrunHours": round(overrun_ms / 3_600_000.0, 2) if overrun_ms else 0.0,
        "isOverrun": overrun_ms > 0,
        "missingIncludedHours": bool(has_service_contract and included_hours_total <= 0.0),
    }


def _customer_last_interaction_ms(
    db,
    customer: Customer,
    phone_numbers: List[str],
) -> int:
    last_points: List[int] = []

    task_filters = _customer_task_filter(customer)
    if task_filters:
        last_task = (
            db.query(func.max(DayTask.created_at))
            .filter(or_(*task_filters))
            .scalar()
        )
        try:
            task_ms = int(last_task or 0)
            if task_ms > 0:
                last_points.append(task_ms)
        except Exception:
            pass

    customer_name = str(customer.name or "").strip().lower()
    report_query = db.query(func.max(Report.created_at))
    if customer_name:
        report_query = report_query.filter(
            or_(
                Report.customer_id == customer.id,
                func.lower(func.trim(Report.customer)) == customer_name,
            )
        )
    else:
        report_query = report_query.filter(Report.customer_id == customer.id)
    last_report = report_query.scalar()
    try:
        report_ms = int(last_report or 0)
        if report_ms > 0:
            last_points.append(report_ms)
    except Exception:
        pass

    last_delivery = (
        db.query(func.max(DeliveryNote.created_at))
        .filter(DeliveryNote.customer_id == customer.id)
        .scalar()
    )
    try:
        delivery_ms = int(last_delivery or 0)
        if delivery_ms > 0:
            last_points.append(delivery_ms)
    except Exception:
        pass

    phone_digits: List[str] = []
    for number in phone_numbers:
        normalized = _normalize_phone(number)
        if normalized and normalized not in phone_digits:
            phone_digits.append(normalized)
    if phone_digits:
        conditions = []
        params: Dict[str, Any] = {}
        for idx, digits in enumerate(phone_digits):
            params[f"p{idx}"] = f"%{digits}"
            conditions.append(
                f"(regexp_replace(from_number, '\\\\D', '', 'g') LIKE :p{idx} "
                f"OR regexp_replace(to_number, '\\\\D', '', 'g') LIKE :p{idx})"
            )
        where_clause = " OR ".join(conditions)
        sql = "SELECT COALESCE(MAX(start_time), 0) AS last_call_ms FROM telephony_calls WHERE " + where_clause
        try:
            with engine.begin() as connection:
                row = connection.execute(text(sql), params).mappings().first()
                call_ms = int((row or {}).get("last_call_ms") or 0)
                if call_ms > 0:
                    last_points.append(call_ms)
        except Exception:
            pass

    return max(last_points) if last_points else 0


def _agent_is_online(agent: Dict[str, Any]) -> bool:
    value = str(
        agent.get("status")
        or agent.get("agent_status")
        or agent.get("online")
        or agent.get("is_online")
        or ""
    ).strip().lower()
    return value in {"online", "up", "true", "1", "healthy"}


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


def _agent_matches_customer(agent: Dict[str, Any], customer: Customer) -> bool:
    customer_number_key = _normalize_customer_number(customer.creditor_number)
    if customer_number_key:
        customer_number_int: Optional[int] = None
        if customer_number_key.isdigit():
            try:
                customer_number_int = int(customer_number_key)
            except Exception:
                customer_number_int = None

        def _is_customer_number_label(raw_label: Any) -> bool:
            label_text = str(raw_label or "").strip().lower()
            if not label_text:
                return False
            compact = re.sub(r"[^a-z0-9]+", "", label_text)
            spaced = re.sub(r"[^a-z0-9]+", " ", label_text).strip()
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

        number_candidates: Set[str] = set()

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

        def _collect_numberish_fields(node: Any) -> None:
            if isinstance(node, dict):
                # Common payload shape from RMM APIs:
                # {"name":"Kundennummer","value":"1018"} or {"field":"customer_number","value":"1018"}
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
                    if not _is_customer_number_label(raw_label):
                        continue
                    for raw_value in value_candidates:
                        for candidate_value in _extract_value_candidates(raw_value):
                            normalized = _normalize_candidate_number(candidate_value)
                            if normalized:
                                number_candidates.add(normalized)

                # Tactical custom_fields often arrive as compact rows like:
                # {"id":7,"field":4,"client":12,"value":"1018"}
                # without a human-readable field label in the same object.
                # In that shape, still treat the value as customer-number candidate.
                has_compact_custom_field_shape = (
                    ("value" in node or "val" in node)
                    and any(key in node for key in ("field", "field_id", "fieldid", "custom_field", "customField"))
                    and any(key in node for key in ("client", "client_id", "site", "site_id", "agent", "agent_id"))
                )
                if has_compact_custom_field_shape:
                    for raw_value in value_candidates:
                        for candidate_value in _extract_value_candidates(raw_value):
                            normalized = _normalize_candidate_number(candidate_value)
                            if normalized:
                                number_candidates.add(normalized)

                # Pattern: {"customField":{"name":"Kundennummer"},"value":"1018"}
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
                    if not any(_is_customer_number_label(item) for item in nested_labels):
                        continue
                    for raw_value in value_candidates:
                        for candidate_value in _extract_value_candidates(raw_value):
                            normalized = _normalize_candidate_number(candidate_value)
                            if normalized:
                                number_candidates.add(normalized)

                for key, value in node.items():
                    key_text = str(key or "").strip().lower()
                    if _is_customer_number_label(key_text) and value is not None:
                        for candidate_value in _extract_value_candidates(value):
                            normalized = _normalize_candidate_number(candidate_value)
                            if normalized:
                                number_candidates.add(normalized)
                    _collect_numberish_fields(value)
                return
            if isinstance(node, list):
                for item in node:
                    _collect_numberish_fields(item)

        _collect_numberish_fields(agent)
        # Mapping rule: customer assignment must come from explicit customer-number fields
        # (e.g. custom field "Kundennummer"), not from generic site/client ids.
        if not number_candidates:
            return False
        if customer_number_key in number_candidates:
            return True
        # Also allow numeric equivalence for mappings like "0012" vs "12".
        if customer_number_int is not None:
            for candidate in number_candidates:
                if candidate.isdigit():
                    try:
                        if int(candidate) == customer_number_int:
                            return True
                    except Exception:
                        continue
        # Accept values where the customer number is embedded in a richer string,
        # e.g. "Kunde 1018" from custom fields.
        customer_digits = re.sub(r"[^0-9]+", "", customer_number_key)
        for candidate in number_candidates:
            if customer_number_key and customer_number_key in candidate:
                return True
            if customer_digits:
                candidate_digits = re.sub(r"[^0-9]+", "", candidate)
                if candidate_digits and candidate_digits == customer_digits:
                    return True

        return False

    customer_name_term = _dev_normalize_text(customer.name)
    if not customer_name_term:
        return False
    searchable = " ".join([_agent_field_text(agent, "site", "site_name"), _agent_field_text(agent, "client", "client_name", "customer")])
    haystack = _dev_normalize_text(searchable)
    padded = f" {haystack} "
    return f" {customer_name_term} " in padded


def _agent_matches_customer_name_only(agent: Dict[str, Any], customer: Customer) -> bool:
    customer_name_term = _dev_normalize_text(customer.name)
    if not customer_name_term:
        return False
    searchable = " ".join([_agent_field_text(agent, "site", "site_name"), _agent_field_text(agent, "client", "client_name", "customer")])
    haystack = _dev_normalize_text(searchable)
    padded = f" {haystack} "
    return f" {customer_name_term} " in padded


def _collect_int_values_by_key_fragments(
    node: Any,
    *,
    include_fragments: List[str],
    require_all: Optional[List[str]] = None,
    exclude_fragments: Optional[List[str]] = None,
    out: Optional[List[int]] = None,
) -> List[int]:
    if out is None:
        out = []
    req = [frag.lower() for frag in (require_all or [])]
    exc = [frag.lower() for frag in (exclude_fragments or [])]
    inc = [frag.lower() for frag in (include_fragments or [])]
    if isinstance(node, dict):
        for key, value in node.items():
            key_text = str(key or "").strip().lower()
            if key_text:
                include_ok = any(fragment in key_text for fragment in inc)
                require_ok = all(fragment in key_text for fragment in req) if req else True
                exclude_hit = any(fragment in key_text for fragment in exc) if exc else False
                if include_ok and require_ok and not exclude_hit:
                    if isinstance(value, bool):
                        out.append(1 if value else 0)
                    elif isinstance(value, (int, float)):
                        out.append(max(0, int(value)))
                    elif isinstance(value, str):
                        value_text = value.strip()
                        if value_text.isdigit():
                            out.append(max(0, int(value_text)))
            _collect_int_values_by_key_fragments(
                value,
                include_fragments=inc,
                require_all=req,
                exclude_fragments=exc,
                out=out,
            )
        return out
    if isinstance(node, list):
        for item in node:
            _collect_int_values_by_key_fragments(
                item,
                include_fragments=inc,
                require_all=req,
                exclude_fragments=exc,
                out=out,
            )
        return out
    return out


def _collect_agent_signal_items(
    node: Any,
    *,
    include_fragments: List[str],
    exclude_fragments: Optional[List[str]] = None,
    limit: int = 8,
) -> List[Dict[str, str]]:
    include = [str(fragment or "").strip().lower() for fragment in (include_fragments or []) if str(fragment or "").strip()]
    exclude = [str(fragment or "").strip().lower() for fragment in (exclude_fragments or []) if str(fragment or "").strip()]
    if not include:
        return []
    items: List[Dict[str, str]] = []
    seen: Set[str] = set()

    def _append_item(candidate: Dict[str, Any], source_key: str = "") -> None:
        if len(items) >= max(1, int(limit or 1)):
            return
        title = _agent_field_text(
            candidate,
            "title",
            "name",
            "check_name",
            "check",
            "alert_name",
            "alert",
            "service",
            "script",
            "subject",
        )
        detail = _agent_field_text(
            candidate,
            "message",
            "msg",
            "description",
            "details",
            "detail",
            "output",
            "reason",
            "error",
            "last_output",
        )
        status = _agent_field_text(candidate, "status", "state", "severity", "level", "result", "outcome")
        last_seen = _agent_field_text(
            candidate,
            "last_seen",
            "lastSeen",
            "last_run",
            "lastRun",
            "created_at",
            "createdAt",
            "updated_at",
            "updatedAt",
            "timestamp",
            "time",
        )
        if not title and detail:
            title = detail[:96]
        if not title:
            return
        unique_key = "|".join(
            [
                title.strip().lower(),
                status.strip().lower(),
                detail.strip().lower()[:120],
            ]
        )
        if unique_key in seen:
            return
        seen.add(unique_key)
        items.append(
            {
                "title": title,
                "status": status,
                "detail": detail,
                "lastSeen": last_seen,
                "source": source_key,
            }
        )

    def _walk(current: Any) -> None:
        if len(items) >= max(1, int(limit or 1)):
            return
        if isinstance(current, dict):
            for raw_key, value in current.items():
                key_text = str(raw_key or "").strip().lower()
                include_hit = any(fragment in key_text for fragment in include) if key_text else False
                exclude_hit = any(fragment in key_text for fragment in exclude) if key_text and exclude else False
                if include_hit and not exclude_hit:
                    if isinstance(value, dict):
                        _append_item(value, key_text)
                    elif isinstance(value, list):
                        for entry in value:
                            if isinstance(entry, dict):
                                _append_item(entry, key_text)
                            elif isinstance(entry, str):
                                entry_text = entry.strip()
                                if entry_text:
                                    _append_item({"title": entry_text}, key_text)
                            if len(items) >= max(1, int(limit or 1)):
                                return
                    elif isinstance(value, str):
                        value_text = value.strip()
                        if value_text:
                            _append_item({"title": value_text}, key_text)
                _walk(value)
                if len(items) >= max(1, int(limit or 1)):
                    return
            return
        if isinstance(current, list):
            for entry in current:
                _walk(entry)
                if len(items) >= max(1, int(limit or 1)):
                    return

    _walk(node)
    return items[: max(1, int(limit or 1))]


def _status_has_problem_flag(value: Any) -> bool:
    text = str(value or "").strip().lower()
    if not text:
        return False
    return any(
        marker in text
        for marker in (
            "fail",
            "error",
            "krit",
            "critical",
            "warn",
            "alert",
            "problem",
            "down",
            "offline",
            "unhealthy",
        )
    )


def _build_agent_alarm_check_summary(agent: Dict[str, Any], health: Dict[str, Any]) -> Dict[str, Any]:
    alert_items = _collect_agent_signal_items(
        agent,
        include_fragments=["alarm", "alert"],
        exclude_fragments=["last", "time", "updated", "created"],
        limit=6,
    )
    check_items = _collect_agent_signal_items(
        agent,
        include_fragments=["check"],
        exclude_fragments=["checkin", "last_check", "timestamp", "time"],
        limit=8,
    )

    alert_count_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["alarm", "alert"],
        exclude_fragments=["last", "time", "updated", "created"],
    )
    check_count_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["check"],
        exclude_fragments=["checkin", "last", "time", "timestamp"],
    )
    failing_check_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["check", "fail"],
        exclude_fragments=["checkin", "last", "time", "timestamp"],
    )
    if not failing_check_candidates:
        failing_check_candidates = _collect_int_values_by_key_fragments(
            agent,
            include_fragments=["check", "error"],
            exclude_fragments=["checkin", "last", "time", "timestamp"],
        )

    alert_floor = int(health.get("errorCount") or 0) + int(health.get("warningCount") or 0)
    alert_count = max(
        [
            len(alert_items),
            alert_floor,
            max(alert_count_candidates) if alert_count_candidates else 0,
        ]
    )
    check_count = max(
        [
            len(check_items),
            max(check_count_candidates) if check_count_candidates else 0,
        ]
    )
    failing_from_items = sum(1 for row in check_items if _status_has_problem_flag(row.get("status")))
    failing_check_count = max(
        [
            failing_from_items,
            max(failing_check_candidates) if failing_check_candidates else 0,
        ]
    )
    if check_count > 0 and failing_check_count > check_count:
        check_count = failing_check_count

    return {
        "alarmCount": int(max(0, alert_count)),
        "checkCount": int(max(0, check_count)),
        "failingCheckCount": int(max(0, failing_check_count)),
        "alertItems": alert_items,
        "checkItems": check_items,
    }


def _agent_windows_lifecycle(os_text: str, now_dt: datetime) -> Dict[str, Any]:
    text = str(os_text or "").lower()
    entries = [
        ("windows server 2012 r2", datetime(2023, 10, 10)),
        ("windows server 2012", datetime(2023, 10, 10)),
        ("windows server 2016", datetime(2027, 1, 12)),
        ("windows server 2019", datetime(2029, 1, 9)),
        ("windows server 2022", datetime(2031, 10, 14)),
    ]
    for marker, eol_date in entries:
        if marker in text:
            days_to_eol = (eol_date.date() - now_dt.date()).days
            if days_to_eol < 0:
                status = "expired"
            elif days_to_eol <= 365:
                status = "soon"
            else:
                status = "supported"
            return {
                "family": marker,
                "eol_date": eol_date.strftime("%Y-%m-%d"),
                "days_to_eol": days_to_eol,
                "status": status,
            }
    return {"family": "", "eol_date": "", "days_to_eol": None, "status": "unknown"}


def _build_agent_health_summary(agent: Dict[str, Any], now_dt: datetime) -> Dict[str, Any]:
    warning_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["warning", "warn", "attention"],
    )
    error_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["error", "failed", "critical", "alert"],
        exclude_fragments=["warning", "warn"],
    )
    windows_update_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["update"],
        require_all=["windows"],
    )
    thirdparty_update_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["update", "patch"],
        require_all=["third"],
    )
    cve_update_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["cve", "vuln"],
    )
    generic_update_candidates = _collect_int_values_by_key_fragments(
        agent,
        include_fragments=["update", "patch"],
        exclude_fragments=["last", "updated_at", "timestamp", "time"],
    )
    warning_count = max(warning_candidates) if warning_candidates else 0
    error_count = max(error_candidates) if error_candidates else 0
    windows_updates = max(windows_update_candidates) if windows_update_candidates else 0
    thirdparty_updates = max(thirdparty_update_candidates) if thirdparty_update_candidates else 0
    cve_open = max(cve_update_candidates) if cve_update_candidates else 0
    generic_updates = max(generic_update_candidates) if generic_update_candidates else 0
    open_updates = max(generic_updates, windows_updates + thirdparty_updates, cve_open)
    os_text = _agent_field_text(
        agent,
        "operating_system",
        "operatingSystem",
        "plat_name",
        "plat",
        "platform",
        "os",
    )
    lifecycle = _agent_windows_lifecycle(os_text, now_dt)
    return {
        "warningCount": warning_count,
        "errorCount": error_count,
        "openUpdates": open_updates,
        "windowsUpdates": windows_updates,
        "thirdPartyUpdates": thirdparty_updates,
        "openCves": cve_open,
        "lifecycle": lifecycle,
    }


def _normalize_inventory_category(value: str) -> str:
    key = str(value or "").strip().lower()
    if key in {"server", "firewall", "printer", "network", "iot", "workstation"}:
        return key
    return "other"


def _managed_agent_inventory_category(agent: Dict[str, Any]) -> str:
    host = _dev_normalize_text(_agent_field_text(agent, "hostname", "name"))
    os_text = _dev_normalize_text(
        _agent_field_text(agent, "operating_system", "operatingSystem", "plat_name", "plat", "platform", "os")
    )
    combined = f"{host} {os_text}".strip()
    if any(token in combined for token in ("windows server", "linux", "server", "hyper v", "esxi", "dc", "srv", "rds", "sql")):
        return "server"
    if any(token in combined for token in ("firewall", "fortigate", "sophos", "pfsense", "opnsense", "utm", "fw")):
        return "firewall"
    if any(token in combined for token in ("printer", "drucker", "laserjet", "xerox", "canon", "kyocera")):
        return "printer"
    if any(token in combined for token in ("switch", "router", "gateway", "ap", "wifi", "wlan", "network")):
        return "network"
    return "workstation"


def _discovery_row_value(row: Any, key: str) -> Any:
    if isinstance(row, dict):
        return row.get(key)
    return getattr(row, key, None)


def _normalize_discovery_mac_text(value: Any) -> str:
    text = str(value or "").strip().lower().replace("-", ":")
    if not text:
        return ""
    hex_only = re.sub(r"[^0-9a-f]", "", text)
    if len(hex_only) != 12:
        return ""
    return ":".join(hex_only[index:index + 2] for index in range(0, 12, 2))


def _discovery_row_is_active(row: Any) -> bool:
    raw = _discovery_row_value(row, "is_active")
    if raw is None:
        raw = _discovery_row_value(row, "active")
    if raw is None:
        status_text = str(_discovery_row_value(row, "status") or "").strip().lower()
        if status_text:
            return status_text != "inactive"
        return True
    if isinstance(raw, str):
        normalized = raw.strip().lower()
        if not normalized:
            return True
        return normalized not in {"0", "false", "no", "off", "inactive"}
    return bool(raw)


def _discovery_row_to_dict(row: Any) -> Dict[str, Any]:
    evidence_value = _discovery_row_value(row, "evidence")
    evidence_payload: List[str] = []
    if isinstance(evidence_value, list):
        evidence_payload = [str(item).strip() for item in evidence_value if str(item).strip()]
    elif isinstance(evidence_value, str):
        text_value = evidence_value.strip()
        if text_value:
            try:
                parsed = json.loads(text_value)
                if isinstance(parsed, list):
                    evidence_payload = [str(item).strip() for item in parsed if str(item).strip()]
            except Exception:
                evidence_payload = [text_value]
    return {
        "source": str(_discovery_row_value(row, "source") or "discovery").strip() or "discovery",
        "hostname": str(_discovery_row_value(row, "hostname") or "").strip(),
        "ip": str(_discovery_row_value(row, "ip") or "").strip(),
        "mac": str(_discovery_row_value(row, "mac") or "").strip(),
        "protocol": str(_discovery_row_value(row, "protocol") or "").strip(),
        "deviceType": str(_discovery_row_value(row, "device_type") or _discovery_row_value(row, "deviceType") or "").strip(),
        "vendor": str(_discovery_row_value(row, "vendor") or "").strip(),
        "confidence": int(_safe_nonnegative_int(_discovery_row_value(row, "confidence") or 0)),
        "evidence": evidence_payload,
        "managed": bool(_discovery_row_value(row, "managed")),
        "active": bool(_discovery_row_is_active(row)),
        "lastSeenAt": int(_safe_nonnegative_int(_discovery_row_value(row, "last_seen_at") or _discovery_row_value(row, "seen_at") or 0)),
    }


def _discovery_inventory_category(row: Any) -> str:
    normalized = _discovery_row_to_dict(row)
    device_type = _dev_normalize_text(str(normalized.get("deviceType") or ""))
    vendor = _dev_normalize_text(str(normalized.get("vendor") or ""))
    hostname = _dev_normalize_text(str(normalized.get("hostname") or ""))
    evidence_text = _dev_normalize_text(" ".join(str(item) for item in (normalized.get("evidence") or [])))
    combined = " ".join(part for part in [device_type, vendor, hostname, evidence_text] if part).strip()
    if any(token in combined for token in ("server", "windows server", "linux", "hyper v", "esxi", "dc", "srv", "rds", "sql")):
        return "server"
    if any(token in combined for token in ("firewall", "fortigate", "sophos", "pfsense", "opnsense", "utm", "fw")):
        return "firewall"
    if any(token in combined for token in ("printer", "drucker", "laserjet", "xerox", "canon", "kyocera", "brother")):
        return "printer"
    if any(token in combined for token in ("iot", "camera", "sensor", "door", "access control")):
        return "iot"
    if any(token in combined for token in ("switch", "router", "gateway", "access point", "ap", "wifi", "wlan", "network")):
        return "network"
    return "other"


def _extract_discovery_payload_from_script_output(text: str) -> Optional[Dict[str, Any]]:
    raw_text = str(text or "")
    if not raw_text:
        return None
    # Legacy clear-text payload markers.
    begin_marker = "QT_DISCOVERY_JSON_BEGIN"
    end_marker = "QT_DISCOVERY_JSON_END"
    begin = raw_text.find(begin_marker)
    if begin >= 0:
        end = raw_text.find(end_marker, begin + len(begin_marker))
        if end > begin:
            payload_text = raw_text[begin + len(begin_marker):end].strip()
            if payload_text:
                try:
                    parsed = json.loads(payload_text)
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    pass

    # Compact payload markers (gzip + base64), keeps RMM script history readable.
    compact_begin_marker = "QT_DISCOVERY_JSON_GZIP_BASE64_BEGIN"
    compact_end_marker = "QT_DISCOVERY_JSON_GZIP_BASE64_END"
    compact_begin = raw_text.find(compact_begin_marker)
    if compact_begin >= 0:
        compact_end = raw_text.find(compact_end_marker, compact_begin + len(compact_begin_marker))
        if compact_end > compact_begin:
            encoded_blob = raw_text[compact_begin + len(compact_begin_marker):compact_end]
            encoded_text = "".join(encoded_blob.split())
            if encoded_text:
                try:
                    compressed = base64.b64decode(encoded_text.encode("ascii"), validate=False)
                    decoded = gzip.decompress(compressed).decode("utf-8", errors="replace")
                    parsed = json.loads(decoded)
                    if isinstance(parsed, dict):
                        return parsed
                except Exception:
                    pass
    return None


def _parse_iso8601_to_epoch_ms(value: Any) -> int:
    text_value = str(value or "").strip()
    if not text_value:
        return 0
    try:
        if text_value.endswith("Z"):
            text_value = text_value[:-1] + "+00:00"
        return int(datetime.fromisoformat(text_value).timestamp() * 1000)
    except Exception:
        return 0


def _fetch_rmm_history_discovery_rows(
    integration: Optional[IntegrationSettings],
    customer: Customer,
    matched_agents: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not matched_agents:
        return []
    session, host = _build_tactical_rmm_session(integration)
    if not session or not host:
        return []
    customer_number_key = _normalize_customer_number(customer.creditor_number)
    customer_name_key = _dev_normalize_text(customer.name)
    out: List[Dict[str, Any]] = []
    seen_device_keys: Set[str] = set()
    for agent in matched_agents[:12]:
        agent_id = _extract_agent_id(agent)
        if not agent_id:
            continue
        history_res, _ = _tactical_request(
            session,
            host,
            "GET",
            f"/agents/{quote(agent_id)}/history/",
            timeout=25,
            retries=1,
        )
        if not history_res or not history_res.ok:
            continue
        try:
            history_rows = history_res.json()
        except Exception:
            continue
        if not isinstance(history_rows, list):
            continue
        history_rows_sorted = sorted(
            [row for row in history_rows if isinstance(row, dict)],
            key=lambda row: _parse_iso8601_to_epoch_ms(row.get("time")),
            reverse=True,
        )
        payload: Optional[Dict[str, Any]] = None
        payload_time_ms = 0
        for history_row in history_rows_sorted:
            if not isinstance(history_row, dict):
                continue
            if str(history_row.get("type") or "").strip().lower() != "script_run":
                continue
            script_name = str(history_row.get("script_name") or "").strip().lower()
            if "infra" not in script_name or "discover" not in script_name:
                continue
            script_results = history_row.get("script_results") if isinstance(history_row.get("script_results"), dict) else {}
            stdout_text = str(script_results.get("stdout") or "")
            parsed = _extract_discovery_payload_from_script_output(stdout_text)
            if not isinstance(parsed, dict):
                continue
            payload = parsed
            payload_time_ms = _parse_iso8601_to_epoch_ms(history_row.get("time")) or int(time.time() * 1000)
            break
        if not payload:
            continue
        payload_customer_id = _safe_nonnegative_int(payload.get("customer_id"))
        payload_customer_number = _normalize_customer_number(payload.get("customer_number"))
        payload_customer_name = _dev_normalize_text(payload.get("customer_name"))
        customer_matches = (
            (payload_customer_id > 0 and payload_customer_id == int(customer.id))
            or (customer_number_key and payload_customer_number and payload_customer_number == customer_number_key)
            or (customer_name_key and payload_customer_name and payload_customer_name == customer_name_key)
        )
        if not customer_matches:
            continue
        items = payload.get("items")
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            ip = str(item.get("ip") or "").strip()
            mac = str(item.get("mac") or "").strip()
            device_key = (ip or "").lower() or (mac or "").lower()
            if not device_key:
                continue
            if device_key in seen_device_keys:
                continue
            seen_device_keys.add(device_key)
            out.append(
                {
                    "source": str(item.get("source") or payload.get("source") or "rmm_history_scan").strip() or "rmm_history_scan",
                    "hostname": str(item.get("hostname") or "").strip(),
                    "ip": ip,
                    "mac": mac,
                    "protocol": str(item.get("protocol") or "").strip(),
                    "device_type": str(item.get("device_type") or item.get("deviceType") or "").strip(),
                    "vendor": str(item.get("vendor") or "").strip(),
                    "confidence": int(_safe_nonnegative_int(item.get("confidence") or 0)),
                    "evidence": list(item.get("evidence") or []) if isinstance(item.get("evidence"), list) else [],
                    "managed": bool(item.get("managed")),
                    "seen_at": int(_safe_nonnegative_int(item.get("seen_at") or payload_time_ms)),
                }
            )
    return out


def _build_customer_development_context(
    db,
    customer: Customer,
    now_ms: int,
    sevdesk_rows: List[Dict[str, Any]],
    tactical_agents: List[Dict[str, Any]],
    full: bool,
) -> Dict[str, Any]:
    now_dt = datetime.fromtimestamp(now_ms / 1000)
    contract_flags = _parse_contract_flags(customer.contract_flags)
    has_contract = bool(customer.maintenance_contract) or bool(
        set(contract_flags) & {"wartung", "monitoring"}
    )
    is_regie_customer = bool("regie" in contract_flags and not has_contract)
    task_filters = _customer_task_filter(customer)
    open_day_tasks = 0
    open_time_tasks = 0
    open_time_ms = 0
    if task_filters:
        open_day_tasks = (
            db.query(DayTask)
            .filter(DayTask.status != "done")
            .filter(DayTask.time_enabled == False)
            .filter(or_(*task_filters))
            .count()
        )
        timed_tasks = (
            db.query(DayTask)
            .filter(DayTask.status != "done")
            .filter(DayTask.time_enabled == True)
            .filter(or_(*task_filters))
            .all()
        )
        open_time_tasks = len(timed_tasks)
        for task in timed_tasks:
            elapsed = task.elapsed or 0
            if task.running and task.startTime:
                elapsed += max(0, now_ms - task.startTime)
            open_time_ms += elapsed
    open_time_minutes = round(open_time_ms / 60000, 1) if open_time_ms else 0

    phone_numbers = [phone.number for phone in customer.phones]
    telephony = _customer_telephony_metrics(phone_numbers, now_ms - 30 * 24 * 60 * 60 * 1000)
    last_interaction_ms = _customer_last_interaction_ms(db, customer, phone_numbers)
    days_since_interaction = int((now_ms - last_interaction_ms) / 86400000) if last_interaction_ms > 0 else None
    comm_load = round(float(telephony["minutes"]) + float(telephony["missed"]) * 5.0, 1)

    matched_sevdesk = _match_sevdesk_row(customer, sevdesk_rows)
    revenue_current_year = float(matched_sevdesk.get("revenueCurrentYearEur") or 0) if matched_sevdesk else 0.0
    revenue_last_year = float(matched_sevdesk.get("revenueLastYearEur") or 0) if matched_sevdesk else 0.0
    revenue_trend_pct = 0.0
    if revenue_last_year > 0:
        revenue_trend_pct = round(((revenue_current_year - revenue_last_year) / revenue_last_year) * 100.0, 1)
    elif revenue_current_year > 0:
        revenue_trend_pct = 100.0
    last_invoice_at, days_since_last_invoice, invoice_activity_due = _extract_invoice_activity_from_row(matched_sevdesk, now_dt)
    interaction_due = bool(days_since_interaction is None or days_since_interaction >= 60)
    invoice_due_for_contact = bool(days_since_last_invoice is None or days_since_last_invoice >= 60)
    contact_due = bool(interaction_due and invoice_due_for_contact)
    if isinstance(days_since_interaction, int) and days_since_interaction >= 120:
        contact_due = True

    integration = db.query(IntegrationSettings).first()

    discovery_conditions = [InfraDiscoveryDevice.customer_id == customer.id]
    if str(customer.creditor_number or "").strip():
        discovery_conditions.append(
            func.lower(func.trim(InfraDiscoveryDevice.customer_number))
            == func.lower(func.trim(customer.creditor_number))
        )
    if str(customer.name or "").strip():
        discovery_conditions.append(
            func.lower(func.trim(InfraDiscoveryDevice.customer_name))
            == func.lower(func.trim(customer.name))
        )
    customer_discovery_rows = db.query(InfraDiscoveryDevice).filter(or_(*discovery_conditions)).all()
    # Fallback match by normalized customer name for historical rows without strict id/number mapping.
    if not customer_discovery_rows and str(customer.name or "").strip():
        normalized_customer_name = _dev_normalize_text(customer.name)
        if normalized_customer_name:
            name_candidates = db.query(InfraDiscoveryDevice).filter(InfraDiscoveryDevice.customer_id.is_(None)).all()
            customer_discovery_rows = [
                row
                for row in name_candidates
                if _dev_normalize_text(str(row.customer_name or "")) == normalized_customer_name
            ]
    active_discovery_rows = [row for row in customer_discovery_rows if _discovery_row_is_active(row)]
    managed_agents = [agent for agent in tactical_agents if _agent_matches_customer(agent, customer)]
    name_only_matches = [agent for agent in tactical_agents if _agent_matches_customer_name_only(agent, customer)]
    if full and managed_agents:
        managed_agent_ids = [_extract_agent_id(agent) for agent in managed_agents if _extract_agent_id(agent)]
        if managed_agent_ids:
            managed_agent_details = _fetch_tactical_rmm_agent_detail_map(integration, managed_agent_ids)
            managed_agents = [{**agent, **(managed_agent_details.get(_extract_agent_id(agent), {}))} for agent in managed_agents]
    discovered_total = len(active_discovery_rows)
    discovered_unmanaged = sum(
        1 for row in active_discovery_rows if not bool(_discovery_row_value(row, "managed"))
    )
    managed_count = len(managed_agents)
    offline_count = sum(1 for agent in managed_agents if not _agent_is_online(agent))
    managed_health = [_build_agent_health_summary(agent, now_dt) for agent in managed_agents]
    total_agent_warnings = sum(int(item.get("warningCount") or 0) for item in managed_health)
    total_agent_errors = sum(int(item.get("errorCount") or 0) for item in managed_health)
    total_open_updates = sum(int(item.get("openUpdates") or 0) for item in managed_health)
    total_windows_updates = sum(int(item.get("windowsUpdates") or 0) for item in managed_health)
    total_thirdparty_updates = sum(int(item.get("thirdPartyUpdates") or 0) for item in managed_health)
    total_open_cves = sum(int(item.get("openCves") or 0) for item in managed_health)
    lifecycle_expired = sum(1 for item in managed_health if str((item.get("lifecycle") or {}).get("status")) == "expired")
    lifecycle_soon = sum(1 for item in managed_health if str((item.get("lifecycle") or {}).get("status")) == "soon")
    offline_rate = round((offline_count / managed_count), 2) if managed_count else 0.0
    discovered_base = discovered_total if discovered_total > 0 else managed_count
    coverage_ratio = round((managed_count / discovered_base), 2) if discovered_base > 0 else 0.0
    unmanaged_count = max(discovered_base - managed_count, 0) + discovered_unmanaged
    inventory_mix = {
        "server": 0,
        "firewall": 0,
        "printer": 0,
        "network": 0,
        "iot": 0,
        "workstation": 0,
        "other": 0,
    }
    for agent in managed_agents:
        key = _normalize_inventory_category(_managed_agent_inventory_category(agent))
        inventory_mix[key] = int(inventory_mix.get(key) or 0) + 1
    for row in active_discovery_rows:
        # Managed entries are likely duplicates of RMM agents.
        if bool(_discovery_row_value(row, "managed")):
            continue
        key = _normalize_inventory_category(_discovery_inventory_category(row))
        inventory_mix[key] = int(inventory_mix.get(key) or 0) + 1

    business_risk = 0
    infra_risk = 0
    signals: List[str] = []
    recommendations: List[Dict[str, str]] = []

    def _add_recommendation(rec_type: str, title: str, why: str) -> None:
        normalized_title = str(title or "").strip().lower()
        if not normalized_title:
            return
        for existing in recommendations:
            if str(existing.get("title") or "").strip().lower() == normalized_title:
                return
        recommendations.append({"type": rec_type, "title": title, "why": why})

    if not has_contract and not is_regie_customer:
        business_risk += 20
        signals.append("Kein Wartungs-/Monitoringvertrag hinterlegt")
        _add_recommendation("betreuung", "Vertragslage prüfen", "Kein Wartungs- oder Monitoringvertrag im Kundenstamm.")
    elif is_regie_customer:
        signals.append("Regie-Kunde hinterlegt (kein Wartungsvertrag, intern niedriger Aktivierungsfokus)")
    # Engagement-Signale: viele kleine Anfragen und regelmäßige Kommunikation
    # sind typischerweise positiv und sollen nicht als Risiko gewertet werden.
    interaction_load = open_day_tasks + open_time_tasks
    is_engaged_customer = (
        comm_load >= 90
        or telephony["calls"] >= 8
        or interaction_load >= 4
    )
    if is_engaged_customer and not contact_due and not invoice_activity_due:
        business_risk = max(0, business_risk - 12)
        if not has_contract and not is_regie_customer:
            _add_recommendation(
                "betreuung",
                "Aktive Betreuung vertraglich absichern",
                "Der Kunde nutzt Leistungen regelmäßig, aber ohne Wartungs-/Monitoringvertrag.",
            )

    if interaction_load >= 8:
        business_risk += 10
        signals.append("Viele offene Aufgaben")
        _add_recommendation("betreuung", "Offene Aufgaben bündeln", "Mehrere offene Punkte beim Kunden.")
    if contact_due:
        if days_since_interaction is None or int(days_since_interaction or 0) >= 90:
            business_risk += 14
        elif int(days_since_interaction or 0) >= 60:
            business_risk += 10
        else:
            business_risk += 6
        if days_since_interaction is None:
            inactivity_label = "keine dokumentierte Aktivität"
        else:
            inactivity_label = f"letzte Aktivität vor {days_since_interaction} Tagen"
        signals.append(f"Kontaktfällig ({inactivity_label})")
        _add_recommendation(
            "betreuung",
            "Proaktiven Kundenkontakt einplanen",
            f"Es besteht seit Längerem geringe Aktivität ({inactivity_label}).",
        )
    if days_since_last_invoice is not None and days_since_last_invoice >= 120:
        business_risk += 20
        signals.append(f"Lange ohne umgesetzte Leistung ({days_since_last_invoice} Tage seit letzter Rechnung)")
        _add_recommendation(
            "betreuung",
            "Leistungs-Review mit Reaktivierung anbieten",
            f"Seit {days_since_last_invoice} Tagen wurde keine neue Leistung fakturiert.",
        )
    elif days_since_last_invoice is not None and days_since_last_invoice >= 75:
        business_risk += 12
        signals.append(f"Längere Umsetzungspause ({days_since_last_invoice} Tage seit letzter Rechnung)")
    elif (
        days_since_last_invoice is not None
        and days_since_last_invoice >= 45
        and not is_engaged_customer
    ):
        business_risk += 6
        signals.append(f"Umsetzungsrhythmus nimmt ab ({days_since_last_invoice} Tage seit letzter Rechnung)")
    if is_regie_customer:
        # Regie-Kunden sollen sichtbar bleiben, aber intern niedriger priorisiert werden.
        business_risk = max(0, business_risk - 18)

    has_low_coverage = discovered_base > 0 and coverage_ratio < 0.7
    if unmanaged_count > 0:
        infra_risk += 35
        signals.append(f"Unmanaged Geräte erkannt ({unmanaged_count})")
        if has_low_coverage:
            _add_recommendation(
                "security",
                "SNMP-/Discovery-Abdeckung erhöhen",
                (
                    f"{unmanaged_count} unmanaged Geräte erkannt und geringe Monitoring-Abdeckung "
                    f"({int(coverage_ratio * 100)}%). Nicht-agentfähige Geräte per SNMP/Discovery einbinden."
                ),
            )
        else:
            _add_recommendation(
                "security",
                "Unmanaged Geräte via SNMP inventarisieren",
                "Nicht alle Gerätetypen sind agentfähig. Unmanaged Geräte über SNMP/Discovery erfassen und überwachen.",
            )
    if has_low_coverage:
        infra_risk += 25
        signals.append(f"Niedrige Monitoring-Abdeckung ({int(coverage_ratio * 100)}%)")
        if unmanaged_count <= 0:
            _add_recommendation(
                "lifecycle",
                "SNMP-/Discovery-Abdeckung erhöhen",
                "Managed/Discovered Verhältnis ist niedrig; nicht-agentfähige Geräte per SNMP einbinden.",
            )
    if managed_count > 0 and offline_rate >= 0.3:
        infra_risk += 25
        signals.append(f"Viele Offline-Agents ({int(offline_rate * 100)}%)")
        _add_recommendation("security", "Offline-Agents prüfen", "Ein signifikanter Teil meldet sich nicht.")
    if total_agent_errors > 0:
        infra_risk += 20
        signals.append(f"RMM meldet Fehler auf Agents ({total_agent_errors})")
        _add_recommendation(
            "security",
            "Agent-Fehler priorisiert beheben",
            f"Es liegen {total_agent_errors} Fehlerhinweise auf den zugeordneten RMM-Agents vor.",
        )
    if total_agent_warnings > 0:
        infra_risk += 10
        signals.append(f"RMM meldet Warnungen ({total_agent_warnings})")
        _add_recommendation(
            "lifecycle",
            "Agent-Warnungen prüfen",
            f"Es liegen {total_agent_warnings} Warnhinweise auf den zugeordneten RMM-Agents vor.",
        )
    if total_open_updates > 0:
        infra_risk += 20
        signals.append(f"Offene Updates erkannt ({total_open_updates})")
        _add_recommendation(
            "security",
            "3rd party software updates",
            (
                f"Offene Updates: Windows {total_windows_updates}, "
                f"3rd-Party {total_thirdparty_updates}, CVE-bezogen {total_open_cves}."
            ),
        )
    if lifecycle_expired > 0:
        infra_risk += 25
        signals.append(f"Veraltete Betriebssysteme erkannt ({lifecycle_expired})")
        _add_recommendation(
            "lifecycle",
            "OS-Migration sofort planen",
            f"{lifecycle_expired} Systeme sind außerhalb des Supports (EOL überschritten).",
        )
    elif lifecycle_soon > 0:
        infra_risk += 12
        signals.append(f"Betriebssysteme kurz vor EOL ({lifecycle_soon})")
        _add_recommendation(
            "lifecycle",
            "OS-Upgrade-Roadmap festlegen",
            f"{lifecycle_soon} Systeme erreichen innerhalb von 12 Monaten das Supportende.",
        )

    total_risk = min(100, business_risk + infra_risk)
    mapping_hint = ""
    if managed_count == 0:
        if _normalize_customer_number(customer.creditor_number) and name_only_matches:
            mapping_hint = (
                "RMM-Agenten gefunden, aber ohne passende Kundennummer-Zuordnung. "
                "Bitte Kundennummer im RMM (Client/Site/Agent-Felder) hinterlegen."
            )
        else:
            mapping_hint = "Keine zugeordneten RMM-Agenten für diesen Kunden gefunden."
    development_state = "INACTIVE" if (customer.status or "active").lower() == "inactive" else _dev_score_to_state(total_risk)
    priority_score_raw = float(total_risk)
    if contact_due:
        priority_score_raw += 12
    if invoice_activity_due:
        priority_score_raw += 16
    if not has_contract and not is_regie_customer:
        priority_score_raw += 6
    if is_regie_customer:
        priority_score_raw -= 16
    if is_engaged_customer and not contact_due and not invoice_activity_due:
        priority_score_raw -= 10
    priority_score = round(max(0.0, min(100.0, priority_score_raw)), 1)
    top_recommendations = recommendations[:3]

    light = {
        "customerId": customer.id,
        "customerName": customer.name or "",
        "customerNumber": customer.creditor_number or "",
        "customerEmail": _customer_effective_email(customer),
        "status": (customer.status or "active").lower(),
        "hasMaintenanceContract": has_contract,
        "isRegieCustomer": is_regie_customer,
        "serviceModel": "regie" if is_regie_customer else ("vertrag" if has_contract else "kein_vertrag"),
        "contractFlags": contract_flags,
        "revenueCurrentYearEur": round(revenue_current_year, 2),
        "revenueLastYearEur": round(revenue_last_year, 2),
        "revenueTrendPct": revenue_trend_pct,
        "ticketLoad": open_day_tasks + open_time_tasks,
        "openTimeMinutes": open_time_minutes,
        "communicationFrequency": telephony["calls"],
        "communicationLoad": comm_load,
        "missedCalls": telephony["missed"],
        "lastInteractionAt": last_interaction_ms or 0,
        "daysSinceInteraction": days_since_interaction,
        "contactDue": contact_due,
        "lastInvoiceAt": last_invoice_at,
        "daysSinceLastInvoice": days_since_last_invoice,
        "invoiceActivityDue": invoice_activity_due,
        "infra": {
            "managedAssets": managed_count,
            "discoveredAssets": discovered_base,
            "coverageRatio": coverage_ratio,
            "offlineRate": offline_rate,
            "unmanagedCount": unmanaged_count,
            "warningCount": total_agent_warnings,
            "errorCount": total_agent_errors,
            "openUpdates": total_open_updates,
            "windowsUpdates": total_windows_updates,
            "thirdPartyUpdates": total_thirdparty_updates,
            "openCves": total_open_cves,
            "alarmCount": 0,
            "checkCount": 0,
            "failingCheckCount": 0,
            "osExpiredCount": lifecycle_expired,
            "osEolSoonCount": lifecycle_soon,
            "rmmMappingHint": mapping_hint,
            "nameOnlyCandidateCount": len(name_only_matches),
            "inventoryMix": inventory_mix,
        },
        "businessRisk": business_risk,
        "infrastructureRisk": infra_risk,
        "riskScore": total_risk,
        "developmentState": development_state,
        "priority": priority_score,
        "signals": signals[:4],
        "topRecommendations": top_recommendations,
    }
    if not full:
        return light
    managed_devices = []
    total_agent_alarm_count = 0
    total_agent_check_count = 0
    total_agent_failing_check_count = 0
    for agent in managed_agents:
        health = _build_agent_health_summary(agent, now_dt)
        alarm_check_summary = _build_agent_alarm_check_summary(agent, health)
        total_agent_alarm_count += int(alarm_check_summary.get("alarmCount") or 0)
        total_agent_check_count += int(alarm_check_summary.get("checkCount") or 0)
        total_agent_failing_check_count += int(alarm_check_summary.get("failingCheckCount") or 0)
        managed_devices.append(
            {
                "source": "tactical_rmm",
                "hostname": _agent_field_text(agent, "hostname", "name"),
                "agentId": _extract_agent_id(agent),
                "site": _agent_field_text(agent, "site", "site_name"),
                "client": _agent_field_text(agent, "client", "client_name", "customer"),
                "online": bool(_agent_is_online(agent)),
                "os": _agent_field_text(agent, "operating_system", "operatingSystem", "plat_name", "plat", "platform", "os"),
                "version": _agent_field_text(agent, "version", "agent_version", "agentVersion"),
                "lastSeen": _agent_field_text(agent, "last_seen", "last_seen_time", "lastseen", "last_checkin", "last_ping"),
                "warningCount": int(health.get("warningCount") or 0),
                "errorCount": int(health.get("errorCount") or 0),
                "openUpdates": int(health.get("openUpdates") or 0),
                "windowsUpdates": int(health.get("windowsUpdates") or 0),
                "thirdPartyUpdates": int(health.get("thirdPartyUpdates") or 0),
                "openCves": int(health.get("openCves") or 0),
                "alarmCount": int(alarm_check_summary.get("alarmCount") or 0),
                "checkCount": int(alarm_check_summary.get("checkCount") or 0),
                "failingCheckCount": int(alarm_check_summary.get("failingCheckCount") or 0),
                "alertItems": alarm_check_summary.get("alertItems") or [],
                "checkItems": alarm_check_summary.get("checkItems") or [],
                "lifecycle": health.get("lifecycle") or {},
            }
        )
    if isinstance(light.get("infra"), dict):
        light["infra"]["alarmCount"] = int(max(0, total_agent_alarm_count))
        light["infra"]["checkCount"] = int(max(0, total_agent_check_count))
        light["infra"]["failingCheckCount"] = int(max(0, total_agent_failing_check_count))
    discovered_devices = []
    for row in customer_discovery_rows:
        normalized_row = _discovery_row_to_dict(row)
        discovered_devices.append(
            {
                "source": str(normalized_row.get("source") or "discovery").strip() or "discovery",
                "hostname": str(normalized_row.get("hostname") or "").strip(),
                "ip": str(normalized_row.get("ip") or "").strip(),
                "mac": str(normalized_row.get("mac") or "").strip(),
                "protocol": str(normalized_row.get("protocol") or "").strip(),
                "deviceType": str(normalized_row.get("deviceType") or "").strip(),
                "vendor": str(normalized_row.get("vendor") or "").strip(),
                "confidence": int(normalized_row.get("confidence") or 0),
                "evidence": list(normalized_row.get("evidence") or []),
                "managed": bool(normalized_row.get("managed")),
                "active": bool(normalized_row.get("active", True)),
                "lastSeenAt": int(normalized_row.get("lastSeenAt") or 0),
            }
        )
    light["recommendations"] = recommendations
    light["telephony"] = telephony
    light["reasons"] = signals
    light["infraActionHints"] = [
        rec
        for rec in recommendations
        if str((rec or {}).get("type") or "").strip().lower() in {"security", "lifecycle"}
    ][:6]
    light["managedInfrastructureDevices"] = managed_devices
    light["discoveredInfrastructureDevices"] = discovered_devices
    light["infrastructureDevices"] = managed_devices + discovered_devices
    light["source"] = {
        "sevdesk": bool(sevdesk_rows),
        "tacticalRmm": bool(tactical_agents),
        "discovery": discovered_total,
    }
    integration = db.query(IntegrationSettings).first()
    metrics_settings = _get_customer_metrics_settings(db)
    work_summary = _build_customer_recent_work_summary(
        integration=integration,
        metrics_settings=metrics_settings,
        customer=customer,
        matched_sevdesk=matched_sevdesk,
        now_dt=now_dt,
    )
    light["workSummary"] = work_summary
    if work_summary.get("available"):
        ws_days = work_summary.get("daysSinceLastInvoice")
        if isinstance(ws_days, int):
            light["daysSinceLastInvoice"] = ws_days
            light["invoiceActivityDue"] = bool(work_summary.get("inactivityDue"))
            light["lastInvoiceAt"] = int(work_summary.get("lastInvoiceAt") or 0)
    return light


def _build_customer_development_payload(
    include_inactive: bool = False,
    customer_id: Optional[int] = None,
    full: bool = False,
    refresh: bool = False,
) -> Dict[str, Any]:
    cache_key = json.dumps(
        {
            "include_inactive": bool(include_inactive),
            "customer_id": int(customer_id) if customer_id is not None else None,
            "full": bool(full),
        },
        sort_keys=True,
    )
    now_ms = int(time.time() * 1000)
    cached = _customer_development_cache.get(cache_key)
    if not refresh and cached and now_ms - int(cached.get("cachedAt") or 0) < CUSTOMER_DEVELOPMENT_CACHE_TTL_MS:
        payload = cached.get("payload")
        if isinstance(payload, dict):
            payload["fromCache"] = True
            return payload
    now_dt = datetime.now()
    with SessionLocal() as db:
        customers_query = db.query(Customer)
        if customer_id is not None:
            customers_query = customers_query.filter(Customer.id == customer_id)
        elif not include_inactive:
            customers_query = customers_query.filter(
                or_(Customer.status.is_(None), func.lower(func.trim(Customer.status)) != "inactive")
            )
        customers = customers_query.all()
        integration = db.query(IntegrationSettings).first()
        metrics_settings = _get_customer_metrics_settings(db)
        sevdesk_rows = _build_sevdesk_customer_rows(integration, metrics_settings, now_dt)
        tactical_agents, tactical_connected = _fetch_tactical_rmm_agents(integration)
        contexts = [
            _build_customer_development_context(db, customer, now_ms, sevdesk_rows, tactical_agents, full)
            for customer in customers
        ]
        contexts.sort(key=lambda item: (-(item.get("priority") or 0), -(item.get("riskScore") or 0)))
        payload = {
            "generatedAt": now_ms,
            "count": len(contexts),
            "contexts": contexts,
            "sources": {
                "sevdesk": bool(sevdesk_rows),
                "tacticalRmm": bool(tactical_connected),
            },
            "fromCache": False,
        }
        _customer_development_cache[cache_key] = {"cachedAt": now_ms, "payload": payload}
        return payload


def _meta_hub_bypass_requested(request: Optional[Request]) -> bool:
    if request is None:
        return False
    raw = str(request.headers.get(CUSTOMER_META_HUB_BYPASS_HEADER) or "").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def _fetch_customer_development_payload_from_meta_hub(
    *,
    include_inactive: bool = False,
    customer_id: Optional[int] = None,
    full: bool = False,
    refresh: bool = False,
) -> Dict[str, Any]:
    if not CUSTOMER_META_HUB_ENABLED:
        raise HTTPException(503, "Customer Meta-Hub is disabled")
    if not CUSTOMER_META_HUB_URL:
        raise HTTPException(503, "Customer Meta-Hub URL is not configured")
    try:
        if refresh:
            # Trigger refresh non-blocking: UI can continue with last snapshot while hub updates in background.
            try:
                refresh_timeout = max(3, min(CUSTOMER_META_HUB_TIMEOUT_SECONDS, 8))
                refresh_res = requests.post(
                    f"{CUSTOMER_META_HUB_URL}/refresh",
                    json={"force": True, "background": True},
                    timeout=refresh_timeout,
                )
                if not refresh_res.ok:
                    logger.warning("Meta-hub refresh trigger failed (%s)", refresh_res.status_code)
            except Exception as refresh_exc:
                logger.warning("Meta-hub refresh trigger exception: %s", refresh_exc)
        params: Dict[str, Any] = {"include_inactive": "1" if include_inactive else "0"}
        if customer_id is not None:
            params["customer_id"] = int(customer_id)
        response = requests.get(
            f"{CUSTOMER_META_HUB_URL}/snapshot",
            params=params,
            timeout=CUSTOMER_META_HUB_TIMEOUT_SECONDS,
        )
        if not response.ok:
            raise HTTPException(503, f"Meta-Hub snapshot unavailable ({response.status_code})")
        payload = response.json()
        if not isinstance(payload, dict):
            raise HTTPException(503, "Meta-Hub returned invalid payload")
        contexts = payload.get("contexts")
        if not isinstance(contexts, list):
            raise HTTPException(503, "Meta-Hub payload missing contexts")
        if full and contexts:
            sample = contexts[0] if isinstance(contexts[0], dict) else {}
            if not isinstance(sample.get("managedInfrastructureDevices"), list):
                raise HTTPException(503, "Meta-Hub snapshot is not prepared in full mode")
        payload["fromCache"] = True
        payload["fromMetaHub"] = True
        sources = payload.get("sources") if isinstance(payload.get("sources"), dict) else {}
        payload["sources"] = {**sources, "metaHub": True}
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Meta-hub fetch failed: %s", exc)
        raise HTTPException(503, "Customer Meta-Hub unavailable")


def _resolve_customer_development_payload(
    *,
    include_inactive: bool = False,
    customer_id: Optional[int] = None,
    full: bool = False,
    refresh: bool = False,
    request: Optional[Request] = None,
) -> Dict[str, Any]:
    if _meta_hub_bypass_requested(request):
        return _build_customer_development_payload(
            include_inactive=include_inactive,
            customer_id=customer_id,
            full=full,
            refresh=refresh,
        )
    return _fetch_customer_development_payload_from_meta_hub(
        include_inactive=include_inactive,
        customer_id=customer_id,
        full=full,
        refresh=refresh,
    )


def _resolve_customer_development_payload_with_fallback(
    *,
    include_inactive: bool = False,
    customer_id: Optional[int] = None,
    full: bool = False,
    refresh: bool = False,
    request: Optional[Request] = None,
) -> Dict[str, Any]:
    try:
        return _resolve_customer_development_payload(
            include_inactive=include_inactive,
            customer_id=customer_id,
            full=full,
            refresh=refresh,
            request=request,
        )
    except HTTPException as exc:
        if int(exc.status_code or 500) == 404:
            raise
        logger.warning(
            "Customer development payload fallback to local snapshot (status=%s, detail=%s)",
            exc.status_code,
            getattr(exc, "detail", ""),
        )
    except Exception as exc:
        logger.warning("Customer development payload fallback to local snapshot: %s", exc)
    return _build_customer_development_payload(
        include_inactive=include_inactive,
        customer_id=customer_id,
        full=full,
        refresh=refresh,
    )


def _customer_development_ai_sources(context: Dict[str, Any]) -> Dict[str, Dict[str, str]]:
    source = context.get("source") if isinstance(context, dict) else {}
    source = source if isinstance(source, dict) else {}
    infra = context.get("infra") if isinstance(context, dict) else {}
    infra = infra if isinstance(infra, dict) else {}
    work_summary = context.get("workSummary") if isinstance(context, dict) else {}
    work_summary = work_summary if isinstance(work_summary, dict) else {}

    managed_assets = int(infra.get("managedAssets") or 0)
    discovered_assets = int(infra.get("discoveredAssets") or 0)
    uncovered_assets = int(infra.get("unmanagedCount") or 0)
    coverage_pct = int(float(infra.get("coverageRatio") or 0) * 100)
    phone_calls = int(context.get("communicationFrequency") or 0)
    open_tasks = int(context.get("ticketLoad") or 0)
    customer_email = str(context.get("customerEmail") or "").strip()

    has_invoice_data = (
        context.get("daysSinceLastInvoice") is not None
        or bool(context.get("lastInvoiceAt"))
        or bool(source.get("sevdesk"))
        or bool(work_summary.get("available"))
    )
    sevdesk_status = "available" if has_invoice_data else "missing"
    sevdesk_detail = (
        f"Rechnungs-/Leistungsdaten vorhanden (letzte Rechnung: {context.get('daysSinceLastInvoice')} Tage)."
        if has_invoice_data and isinstance(context.get("daysSinceLastInvoice"), int)
        else ("Rechnungs-/Leistungsdaten vorhanden." if has_invoice_data else "Keine verwertbaren Faktura-Daten.")
    )

    rmm_connected = bool(source.get("tacticalRmm")) or managed_assets > 0 or int(infra.get("nameOnlyCandidateCount") or 0) > 0
    if managed_assets > 0:
        rmm_status = "available"
    elif rmm_connected:
        rmm_status = "partial"
    else:
        rmm_status = "missing"
    rmm_detail = (
        f"{managed_assets} gemanagte Agents, {coverage_pct}% Coverage."
        if managed_assets > 0
        else ("RMM erreichbar, aber keine eindeutige Agent-Zuordnung." if rmm_connected else "Keine RMM-Daten.")
    )

    if discovered_assets > 0:
        discovery_status = "available"
    elif bool(source.get("discovery")):
        discovery_status = "partial"
    else:
        discovery_status = "missing"
    discovery_detail = (
        f"{discovered_assets} Discovery-Assets, davon {uncovered_assets} unmanaged."
        if discovered_assets > 0
        else "Keine Discovery-Assets vorhanden."
    )

    telephony_status = "available" if phone_calls > 0 else "partial"
    telephony_detail = (
        f"{phone_calls} Calls in der Auswertung."
        if phone_calls > 0
        else "Keine aktuellen Call-Events fuer den Zeitraum."
    )

    task_status = "available"
    task_detail = f"{open_tasks} offene Aufgaben in der Auswertung."

    email_status = "planned"
    if customer_email:
        email_detail = (
            f"Kundenadresse vorhanden ({customer_email}), IMAP-Sync geplant."
        )
    else:
        email_detail = "Keine Kundenadresse hinterlegt, IMAP-Sync geplant."

    return {
        "sevdesk": {"status": sevdesk_status, "detail": sevdesk_detail},
        "rmm": {"status": rmm_status, "detail": rmm_detail},
        "discovery": {"status": discovery_status, "detail": discovery_detail},
        "telephony": {"status": telephony_status, "detail": telephony_detail},
        "tasks": {"status": task_status, "detail": task_detail},
        "email_imap": {"status": email_status, "detail": email_detail},
    }


def _customer_development_ai_source_lines(sources: Dict[str, Dict[str, str]]) -> List[str]:
    labels = {
        "sevdesk": "sevdesk",
        "rmm": "RMM",
        "discovery": "Discovery",
        "telephony": "Telefonie",
        "tasks": "Aufgaben",
        "email_imap": "E-Mail/IMAP",
    }
    ordered_keys = ["sevdesk", "rmm", "discovery", "telephony", "tasks", "email_imap"]
    lines: List[str] = []
    for key in ordered_keys:
        entry = sources.get(key) if isinstance(sources, dict) else None
        entry = entry if isinstance(entry, dict) else {}
        status = str(entry.get("status") or "missing").strip().lower() or "missing"
        detail = str(entry.get("detail") or "").strip()
        label = labels.get(key, key)
        if detail:
            lines.append(f"- {label}: {status} - {detail}")
        else:
            lines.append(f"- {label}: {status}")
    return lines


def _aggregate_customer_development_ai_sources(contexts: List[Dict[str, Any]]) -> Dict[str, Dict[str, str]]:
    if not contexts:
        return _customer_development_ai_sources({})
    snapshots = [_customer_development_ai_sources(item) for item in contexts if isinstance(item, dict)]
    if not snapshots:
        return _customer_development_ai_sources({})
    ordered_keys = ["sevdesk", "rmm", "discovery", "telephony", "tasks", "email_imap"]
    rank = {"missing": 0, "planned": 1, "partial": 2, "available": 3}
    total = len(snapshots)
    aggregated: Dict[str, Dict[str, str]] = {}
    for key in ordered_keys:
        statuses: List[str] = []
        for snap in snapshots:
            entry = snap.get(key) if isinstance(snap, dict) else {}
            status = str((entry or {}).get("status") or "missing").strip().lower() or "missing"
            statuses.append(status)
        best_status = max(statuses, key=lambda value: rank.get(value, 0)) if statuses else "missing"
        available_count = sum(1 for status in statuses if status in {"available", "partial"})
        if key == "email_imap":
            detail = "IMAP-Integration vorbereitet, in dieser Version noch nicht aktiv."
        else:
            detail = f"{available_count}/{total} Kunden mit verwertbaren Daten."
        aggregated[key] = {"status": best_status, "detail": detail}
    return aggregated


def _compact_customer_development_ai_text(value: Any, limit: int = 120) -> str:
    text = _normalize_space(value)
    if not text:
        return ""
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 3)].rstrip(" ,;:-") + "..."


def _customer_development_ai_prompt(
    context: Dict[str, Any],
    mode: str,
    tone: str,
) -> str:
    customer_name = str(context.get("customerName") or "Kunde")
    state = str(context.get("developmentState") or "STABLE")
    risk = int(context.get("riskScore") or 0)
    has_contract = bool(context.get("hasMaintenanceContract"))
    contract_flags = [str(item or "").strip().lower() for item in (context.get("contractFlags") or []) if str(item or "").strip()]
    is_regie_customer = bool(context.get("isRegieCustomer")) or (("regie" in contract_flags) and not has_contract)
    service_model_label = "Regie (nach Aufwand)" if is_regie_customer else ("Wartung/Monitoring" if has_contract else "Kein Vertrag")
    infra = context.get("infra") or {}
    work_summary = context.get("workSummary") or {}
    days_since_interaction = context.get("daysSinceInteraction")
    contact_due = bool(context.get("contactDue"))
    days_since_invoice = context.get("daysSinceLastInvoice")
    invoice_due = bool(context.get("invoiceActivityDue"))
    recommendations = context.get("recommendations") or context.get("topRecommendations") or []
    recommendation_lines = []
    for rec in recommendations[:3]:
        title = str(rec.get("title") or "").strip()
        why = _compact_customer_development_ai_text(rec.get("why"), 90)
        if title:
            recommendation_lines.append(f"- {title}: {why}")
    if not recommendation_lines:
        recommendation_lines.append("- Keine konkreten Empfehlungen vorhanden.")
    signals = context.get("signals") or context.get("reasons") or []
    signal_lines = [
        f"- {_compact_customer_development_ai_text(item, 72)}"
        for item in signals[:4]
        if str(item).strip()
    ] or ["- Keine kritischen Signale."]
    work_topics: List[str] = []
    summary_text = _compact_customer_development_ai_text(work_summary.get("summary"), 120)
    if summary_text:
        work_topics.append(f"- Zusammenfassung letzte Arbeiten: {summary_text}")
    for row in (work_summary.get("items") or [])[:2]:
        snippets = [str(part).strip() for part in (row.get("positionSnippets") or []) if str(part).strip()]
        if not snippets:
            continue
        label = str(row.get("date") or "").strip() or "letzte Rechnung"
        work_topics.append(
            f"- {label}: {_compact_customer_development_ai_text(snippets[0], 92)}"
        )
    if not work_topics:
        work_topics.append("- Keine konkreten Rechnungspositionen vorhanden.")
    mode_key = str(mode or "summary").strip().lower()
    tone_key = str(tone or "sachlich").strip()
    ai_sources = _customer_development_ai_sources(context)
    source_lines = [
        line
        for line in _customer_development_ai_source_lines(ai_sources)
        if "missing" not in line.lower()
    ][:4]
    if not source_lines:
        source_lines = ["- Quellenlage: teilweise unvollständig."]

    if mode_key == "mail":
        task_text = (
            "Erstelle eine kurze Kundenmail auf Deutsch mit Betreff und kompaktem Nachrichtentext. "
            "Ziel: proaktiv Betreuung anbieten und naechsten Schritt ausloesen."
        )
    elif mode_key == "angebot":
        task_text = (
            "Erstelle 3 kurze, konkrete Angebotsvorschlaege auf Deutsch. "
            "Je Vorschlag: Titel, Nutzen, naechste Aktion."
        )
    elif mode_key == "kundenbericht":
        task_text = (
            "Erstelle 3 spezifische Vorschlaege fuer den naechsten Kundenbericht. "
            "Je Vorschlag: Problembezug, warum jetzt, empfohlene Massnahme."
        )
    elif mode_key == "newsletter":
        task_text = (
            "Erstelle 3 allgemein nutzbare Newsletter-Themen auf Deutsch. "
            "Je Thema: Ueberschrift und 1-2 kurze Saetze."
        )
    elif mode_key == "leitfaden":
        task_text = (
            "Erstelle einen Gespraechsleitfaden auf Deutsch mit 5-6 Stichpunkten und Abschlussfrage."
        )
    elif mode_key == "aktivierung_mail":
        task_text = (
            "Erstelle eine aktivierende Kundenmail auf Deutsch mit Betreff und kurzem Fliesstext. "
            "Fokus: Reaktivierung und klarer Call-to-Action."
        )
    elif mode_key == "aktivierung_call":
        task_text = (
            "Erstelle einen Telefonleitfaden zur Kundenreaktivierung mit 6 klaren Punkten "
            "inklusive Abschlussfrage."
        )
    elif mode_key == "analyse":
        task_text = (
            "Erstelle eine strukturierte Kundenanalyse auf Deutsch in 4 kurzen Abschnitten: "
            "Kurzlage, Chancen, Risiken, naechster Schritt."
        )
    else:
        task_text = (
            "Erstelle eine kompakte Management-Zusammenfassung auf Deutsch in 3-4 Saetzen "
            "mit klarer Priorisierung und naechster Aktion."
        )

    return (
        f"{task_text}\n"
        "Nutze die verfuegbaren Quellen gemeinsam. Fehlende Daten kurz benennen.\n"
        f"Ton: {tone_key}\n\n"
        f"Kunde: {customer_name} | Status: {state} | Risiko: {risk}/100 | Modell: {service_model_label}\n"
        f"Kontakt: {days_since_interaction if isinstance(days_since_interaction, int) else 'n/a'} Tage seit Interaktion, faellig={'ja' if contact_due else 'nein'}\n"
        f"Rechnung: {days_since_invoice if isinstance(days_since_invoice, int) else 'n/a'} Tage, Reaktivierung={'ja' if invoice_due else 'nein'}\n"
        f"Infrastruktur: Coverage {int(float(infra.get('coverageRatio') or 0) * 100)}%, Unmanaged {int(infra.get('unmanagedCount') or 0)}, Offline {int(float(infra.get('offlineRate') or 0) * 100)}%\n\n"
        f"Quellenlage:\n{chr(10).join(source_lines)}\n\n"
        f"Aktuelle Themen:\n{chr(10).join(work_topics)}\n\n"
        f"Signale:\n{chr(10).join(signal_lines)}\n\n"
        f"Empfehlungen:\n{chr(10).join(recommendation_lines)}\n\n"
        "Antwort als reiner Text, kein JSON, kein Markdown."
    )


def _customer_development_ai_max_tokens(mode: str) -> int:
    mode_key = str(mode or "summary").strip().lower()
    if mode_key == "analyse":
        return 160
    if mode_key in {"angebot", "kundenbericht", "leitfaden", "newsletter"}:
        return 140
    if mode_key in {"aktivierung_mail", "aktivierung_call", "mail"}:
        return 120
    return 110


def _customer_development_ai_fallback(context: Dict[str, Any], mode: str) -> str:
    mode_key = str(mode or "summary").strip().lower()
    customer_name = str(context.get("customerName") or "Kunde")
    has_contract = bool(context.get("hasMaintenanceContract"))
    contract_flags = [str(item or "").strip().lower() for item in (context.get("contractFlags") or []) if str(item or "").strip()]
    is_regie_customer = bool(context.get("isRegieCustomer")) or (("regie" in contract_flags) and not has_contract)
    infra = context.get("infra") or {}
    unmanaged = int(infra.get("unmanagedCount") or 0)
    coverage = int(float(infra.get("coverageRatio") or 0) * 100)
    missed = int(context.get("missedCalls") or 0)
    days_since_invoice = context.get("daysSinceLastInvoice")
    recommendations = context.get("recommendations") or context.get("topRecommendations") or []
    rec_lines = [str((rec or {}).get("title") or "").strip() for rec in recommendations if str((rec or {}).get("title") or "").strip()]
    top = rec_lines[:3] if rec_lines else ["Betreuungs-Check", "Infrastruktur-Bestand prüfen", "Sicherheitsbasis aktualisieren"]

    if mode_key == "kundenbericht":
        return (
            f"1) {top[0]}: Für {customer_name} im Bericht als priorisierte Maßnahme aufnehmen.\n"
            f"2) Infrastrukturtransparenz erhöhen: Coverage aktuell bei {coverage}% mit {unmanaged} unmanaged Geräten.\n"
            f"3) Kommunikationsstabilität: Verpasste Anrufe ({missed}) als Anlass für klaren Betreuungsrhythmus nutzen."
        )
    if mode_key == "newsletter":
        return (
            "Thema 1: Warum Asset-Transparenz Kosten spart – unmanaged Geräte früh erkennen.\n"
            "Thema 2: Wartung statt Feuerwehr – wie regelmäßige Betreuung Störungen reduziert.\n"
            "Thema 3: Kommunikationsklarheit im IT-Service – feste Touchpoints statt Ad-hoc-Reaktionen."
        )
    if mode_key == "angebot":
        if is_regie_customer:
            return (
                f"Angebot 1: Regie-Service-Review fuer {customer_name} mit priorisierter Maßnahmenliste.\n"
                f"Angebot 2: Infrastruktur-Basispaket – Asset-Abgleich, Coverage-Plan (aktuell {coverage}%), Übergabebericht.\n"
                "Angebot 3: Sicherheits-Quickwins nach Aufwand – klarer Maßnahmenkatalog mit optionalen Folgeterminen."
            )
        return (
            f"Angebot 1: {top[0]} – kompaktes Maßnahmenpaket mit klarer Priorisierung.\n"
            f"Angebot 2: Infrastruktur-Basispaket – Asset-Abgleich, Coverage-Plan (aktuell {coverage}%), Übergabebericht.\n"
            "Angebot 3: Betreuungs-/SLA-Paket – definierte Reaktionszeiten und regelmäßige Service-Reviews."
        )
    if mode_key == "aktivierung_mail":
        days_label = f"{days_since_invoice} Tagen" if isinstance(days_since_invoice, int) else "längerer Zeit"
        return (
            f"Betreff: Kurzer IT-Statusabgleich für {customer_name}\n\n"
            f"Guten Tag,\n\n"
            f"wir möchten den aktuellen IT-Status mit Ihnen abstimmen, da seit {days_label} keine neue Leistung umgesetzt wurde. "
            f"Ein kurzer Termin hilft, {top[0]} strukturiert einzuplanen und konkrete nächste Schritte festzulegen.\n\n"
            "Passt Ihnen ein 20-minütiger Termin in dieser oder nächster Woche?"
        )
    if mode_key == "aktivierung_call":
        return (
            f"1) Einstieg: Kurzbezug auf letzten Kontakt mit {customer_name}.\n"
            f"2) Anlass: Aktuelle Lage mit Fokus auf {top[0]}.\n"
            f"3) Nutzen: Risiken reduzieren und Stabilität erhöhen.\n"
            "4) Bedarf klären: Welche Themen haben aktuell Priorität?\n"
            "5) Vorschlag: Konkreten nächsten Schritt mit Aufwand nennen.\n"
            "6) Abschlussfrage: Termin für 20-30 Minuten Abstimmung fixieren."
        )
    return (
        f"Kurzlage {customer_name}: Priorität bei {top[0]}. "
        f"Infrastruktur: {unmanaged} unmanaged Geräte, Coverage {coverage}%. "
        "Nächster Schritt: konkrete Maßnahme terminieren."
    )


def _generate_customer_development_ai_text(
    *,
    context: Dict[str, Any],
    prompt: str,
    mode: str,
    timeout_seconds: Optional[int] = None,
) -> Tuple[str, bool, int]:
    mode_key = str(mode or "summary").strip().lower()
    resolved_timeout = max(
        3,
        int(
            timeout_seconds
            if timeout_seconds is not None
            else CUSTOMER_DEVELOPMENT_AI_TIMEOUT_SECONDS
        ),
    )
    text_result, _, _ = _ai_generate_text(
        prompt,
        model_candidates=_resolve_ai_models(
            MODEL_PREF_CUSTOMER_DEVELOPMENT,
            MODEL_PREF_ACTION,
            MODEL_PREF_TASK_DRAFT,
            purpose="customer_development",
        ),
        timeout=resolved_timeout,
        max_tokens=_customer_development_ai_max_tokens(mode_key),
    )
    text_result = text_result.strip()
    if text_result:
        return text_result, False, resolved_timeout
    resolved_customer_id = _safe_int(context.get("customerId"))
    logger.info(
        "Customer development AI fallback used customer_id=%s mode=%s timeout_seconds=%s",
        resolved_customer_id if resolved_customer_id > 0 else "n/a",
        mode_key,
        resolved_timeout,
    )
    return _customer_development_ai_fallback(context, mode_key), True, resolved_timeout


def _build_customer_development_ai_response(
    *,
    context: Dict[str, Any],
    mode: str,
    tone: str,
    customer_id: Optional[int] = None,
    timeout_seconds: Optional[int] = None,
) -> Dict[str, Any]:
    mode_key = str(mode or "summary").strip().lower()
    if mode_key not in {
        "summary",
        "mail",
        "leitfaden",
        "analyse",
        "angebot",
        "kundenbericht",
        "newsletter",
        "aktivierung_mail",
        "aktivierung_call",
    }:
        mode_key = "summary"
    tone_value = str(tone or "sachlich")
    ai_sources = _customer_development_ai_sources(context)
    prompt = _customer_development_ai_prompt(context, mode=mode_key, tone=tone_value)
    text_result, used_fallback, resolved_timeout = _generate_customer_development_ai_text(
        context=context,
        prompt=prompt,
        mode=mode_key,
        timeout_seconds=timeout_seconds,
    )
    resolved_customer_id = int(customer_id) if customer_id is not None else _safe_int(context.get("customerId"))
    return {
        "customer_id": resolved_customer_id if resolved_customer_id > 0 else None,
        "mode": mode_key,
        "tone": tone_value,
        "text": text_result,
        "sources": ai_sources,
        "provider": "fallback" if used_fallback else _get_ai_config_snapshot().get("provider", AI_PROVIDER_OLLAMA),
        "used_fallback": bool(used_fallback),
        "timeout_seconds": int(resolved_timeout),
        "generated_at": int(time.time() * 1000),
    }


def _build_report_item_from_recommendation(
    context: Dict[str, Any],
    recommendation_index: int = 0,
) -> Dict[str, Any]:
    recommendations = context.get("recommendations") or context.get("topRecommendations") or []
    if not recommendations:
        raise HTTPException(404, "No recommendations available for this customer")
    idx = max(0, min(int(recommendation_index or 0), len(recommendations) - 1))
    rec = recommendations[idx] or {}
    title = str(rec.get("title") or "Empfehlung").strip() or "Empfehlung"
    why = str(rec.get("why") or "").strip()
    rec_type = str(rec.get("type") or "betreuung").strip().lower()
    customer_name = str(context.get("customerName") or "Kunde")

    impact_map = {
        "security": "Reduziert Ausfall- und Sicherheitsrisiken, erhöht Nachvollziehbarkeit.",
        "lifecycle": "Verbessert Stabilität und Planbarkeit der IT-Infrastruktur.",
        "betreuung": "Senkt Reibungsverluste im Alltag und schafft klare Verantwortlichkeiten.",
    }
    duration_map = {
        "security": "ca. 2-4 Stunden",
        "lifecycle": "ca. 2-6 Stunden",
        "betreuung": "ca. 1-3 Stunden",
    }
    cost_map = {
        "security": "nach Aufwand / Angebotsposition",
        "lifecycle": "nach Aufwand / Angebotsposition",
        "betreuung": "monatlich oder nach Aufwand",
    }
    priority = "Hoch" if float(context.get("riskScore") or 0) >= 50 else "Planbar"
    preview_text = (
        f"Vorschlag für {customer_name}: {title}. "
        f"Begründung: {why or 'Aus den aktuellen Kundensignalen abgeleitet.'} "
        f"Empfohlener nächster Schritt: mit dem Kunden terminieren und als Maßnahme priorisieren."
    )
    return {
        "priority": priority,
        "title": title,
        "system": "Kundenentwicklung",
        "why_text": why or "Aus Kundenentwicklungssignalen abgeleitet.",
        "impact": impact_map.get(rec_type, impact_map["betreuung"]),
        "duration": duration_map.get(rec_type, "ca. 1-3 Stunden"),
        "cost": cost_map.get(rec_type, "nach Aufwand"),
        "action_type": "standard",
        "custom_html": "",
        "custom_text": "",
        "custom_data": {
            "source": "customer_development",
            "recommendation_type": rec_type,
            "customer_id": context.get("customerId"),
            "customer_name": customer_name,
        },
        "preview_text": preview_text,
    }


# ================= CUSTOMERS =================
@app.get("/api/customers")
def get_customers():
    with SessionLocal() as db:
        customers = db.query(Customer).all()
        customer_ids = [int(c.id) for c in customers if c.id is not None]
        contract_document_flags_by_customer, contract_type_counts_by_customer = (
            _load_contract_document_meta_for_customers(db, customer_ids)
        )
        return [
            serialize_customer(
                c,
                contract_document_flags=contract_document_flags_by_customer.get(int(c.id), []),
                contract_type_counts=contract_type_counts_by_customer.get(int(c.id), {}),
            )
            for c in customers
        ]


@app.get("/api/customer_development")
def get_customer_development(
    request: Request,
    include_inactive: bool = False,
    full: bool = False,
    refresh: bool = False,
):
    return _resolve_customer_development_payload(
        include_inactive=include_inactive,
        full=full,
        refresh=refresh,
        request=request,
    )


@app.get("/api/customers/{customer_id}/development")
def get_customer_development_for_customer(customer_id: int, request: Request, refresh: bool = False):
    payload = _resolve_customer_development_payload(
        include_inactive=True,
        customer_id=customer_id,
        full=True,
        refresh=refresh,
        request=request,
    )
    contexts = payload.get("contexts") or []
    if not contexts:
        raise HTTPException(404, "Customer not found")
    return contexts[0]


@app.get("/api/customers/{customer_id}/development/work_summary_ai")
def get_customer_development_work_summary_ai(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        integration = db.query(IntegrationSettings).first()
        metrics_settings = _get_customer_metrics_settings(db)
        now_dt = datetime.now()
        summary = _build_customer_recent_work_summary(
            integration=integration,
            metrics_settings=metrics_settings,
            customer=customer,
            matched_sevdesk=None,
            now_dt=now_dt,
            include_ai=True,
        )
        return {
            "customerId": customer.id,
            "available": bool(summary.get("available")),
            "summary": str(summary.get("summary") or ""),
            "aiSummary": str(summary.get("aiSummary") or ""),
            "hasAiSummary": bool(summary.get("hasAiSummary")),
        }


@app.get("/api/customers/{customer_id}/development/cve_scan")
def get_customer_development_cve_scan(customer_id: int, request: Request, refresh: bool = False):
    now_ms = int(time.time() * 1000)
    cached = _customer_cve_cache.get(int(customer_id))
    if not refresh and cached and now_ms - int(cached.get("cachedAt") or 0) < CUSTOMER_CVE_CACHE_TTL_MS:
        payload = cached.get("payload")
        if isinstance(payload, dict):
            cached_at = int(cached.get("cachedAt") or 0)
            matched_agents = int(payload.get("matchedAgents") or 0)
            if matched_agents == 0 and now_ms - cached_at > CUSTOMER_CVE_EMPTY_CACHE_TTL_MS:
                payload = None
            if isinstance(payload, dict):
                payload["fromCache"] = True
                return payload

    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        integration = db.query(IntegrationSettings).first()
    development_payload = _resolve_customer_development_payload(
        include_inactive=True,
        customer_id=customer_id,
        full=True,
        refresh=refresh,
        request=request,
    )
    contexts = development_payload.get("contexts") if isinstance(development_payload.get("contexts"), list) else []
    if not contexts:
        raise HTTPException(404, "Customer not found")
    context = contexts[0] if isinstance(contexts[0], dict) else {}
    infra = context.get("infra") if isinstance(context.get("infra"), dict) else {}
    source = context.get("source") if isinstance(context.get("source"), dict) else {}

    managed_devices_raw = context.get("managedInfrastructureDevices")
    managed_devices_raw = managed_devices_raw if isinstance(managed_devices_raw, list) else []
    managed_devices = [row for row in managed_devices_raw if isinstance(row, dict)]

    deduped_agents: List[Dict[str, Any]] = []
    seen_agent_ids: Set[str] = set()
    for device in managed_devices:
        agent_id = str(device.get("agentId") or "").strip()
        if agent_id:
            if agent_id in seen_agent_ids:
                continue
            seen_agent_ids.add(agent_id)
        deduped_agents.append(device)

    query_agent_ids = [str(row.get("agentId") or "").strip() for row in deduped_agents if str(row.get("agentId") or "").strip()]
    software_rows = _fetch_tactical_rmm_software(integration, query_agent_ids, per_agent_limit=120)

    agent_meta: Dict[str, Dict[str, Any]] = {}
    ordered_agent_keys: List[str] = []
    for index, agent in enumerate(deduped_agents):
        agent_id = str(agent.get("agentId") or "").strip()
        stable_key = agent_id or f"idx:{index}"
        ordered_agent_keys.append(stable_key)
        agent_meta[stable_key] = {
            "agentId": agent_id,
            "hostname": str(agent.get("hostname") or "").strip(),
            "site": str(agent.get("site") or "").strip(),
            "client": str(agent.get("client") or "").strip(),
            "online": bool(agent.get("online")),
            "os": str(agent.get("os") or "").strip(),
            "version": str(agent.get("version") or "").strip(),
            "lastSeen": str(agent.get("lastSeen") or "").strip(),
        }

    per_agent_software: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for row in software_rows:
        agent_id = str(row.get("agent_id") or "").strip()
        name = str(row.get("name") or "").strip()
        version = str(row.get("version") or "").strip()
        if not agent_id or not name:
            continue
        software_by_name = per_agent_software.setdefault(agent_id, {})
        key = name.lower()
        existing = software_by_name.get(key)
        if not existing or _safe_version_key(version) > _safe_version_key(str(existing.get("version") or "")):
            software_by_name[key] = {"name": name, "version": version}

    agents_payload: List[Dict[str, Any]] = []
    lookup_started_at = time.time()
    lookup_budget_seconds = float(CVE_LOOKUP_BUDGET_SECONDS)
    lookup_max_unique = int(CVE_LOOKUP_MAX_UNIQUE)
    lookup_max_workers = int(CVE_LOOKUP_MAX_WORKERS)
    scanned = 0

    agent_scan_rows: List[Dict[str, Any]] = []
    lookup_candidates: Dict[Tuple[str, str], Dict[str, Any]] = {}
    for agent_key in ordered_agent_keys:
        meta = agent_meta.get(agent_key, {"agentId": "", "hostname": "", "site": "", "client": "", "online": None})
        agent_id = str(meta.get("agentId") or "").strip()
        software_map = per_agent_software.get(agent_id, {}) if agent_id else {}
        software_list = sorted(
            list(software_map.values()),
            key=lambda item: (
                -_cve_lookup_priority(str(item.get("name") or "")),
                str(item.get("name") or "").lower(),
            ),
        )[:40]
        software_scan_rows: List[Dict[str, Any]] = []
        for item in software_list:
            scanned += 1
            name = str(item.get("name") or "").strip()
            version = str(item.get("version") or "").strip()
            lookup_name_candidates = _software_lookup_name_candidates(name) or [name]
            lookup_version_candidates = _software_lookup_version_candidates(name, version)
            lookup_name = str(lookup_name_candidates[0] or name).strip() or name
            lookup_version = (
                str(lookup_version_candidates[0] or "").strip()
                if lookup_version_candidates
                else version
            )
            lookup_key = (lookup_name.lower(), lookup_version.lower())
            software_scan_rows.append(
                {
                    "name": name,
                    "version": version,
                    "lookupKey": lookup_key,
                }
            )
            lookup_priority = _cve_lookup_priority(name)
            existing_lookup = lookup_candidates.get(lookup_key)
            if not existing_lookup or lookup_priority > int(existing_lookup.get("priority") or 0):
                lookup_candidates[lookup_key] = {
                    "lookupKey": lookup_key,
                    "lookupName": lookup_name,
                    "lookupVersion": lookup_version,
                    "priority": lookup_priority,
                }
        agent_scan_rows.append(
            {
                "meta": meta,
                "software": software_list,
                "scanRows": software_scan_rows,
            }
        )

    ordered_lookup_candidates = sorted(
        list(lookup_candidates.values()),
        key=lambda item: (
            -int(item.get("priority") or 0),
            str(item.get("lookupName") or "").lower(),
            str(item.get("lookupVersion") or "").lower(),
        ),
    )
    selected_lookup_candidates = ordered_lookup_candidates[:lookup_max_unique]
    lookup_skipped = max(0, len(ordered_lookup_candidates) - len(selected_lookup_candidates))
    lookup_results: Dict[Tuple[str, str], Tuple[List[Dict[str, Any]], List[str]]] = {}
    if selected_lookup_candidates:
        max_workers = min(max(1, lookup_max_workers), len(selected_lookup_candidates))
        executor = ThreadPoolExecutor(max_workers=max_workers)
        future_map: Dict[Any, Tuple[str, str]] = {}
        completed_futures: Set[Any] = set()
        try:
            for candidate in selected_lookup_candidates:
                lookup_key = candidate.get("lookupKey")
                if not isinstance(lookup_key, tuple) or len(lookup_key) != 2:
                    continue
                future = executor.submit(
                    _lookup_cve_for_software,
                    str(candidate.get("lookupName") or ""),
                    str(candidate.get("lookupVersion") or ""),
                )
                future_map[future] = (str(lookup_key[0]), str(lookup_key[1]))

            if future_map:
                timeout_seconds = max(1.0, lookup_budget_seconds - max(0.0, time.time() - lookup_started_at))
                try:
                    for future in as_completed(list(future_map.keys()), timeout=timeout_seconds):
                        completed_futures.add(future)
                        lookup_key = future_map.get(future)
                        if not lookup_key:
                            continue
                        try:
                            cves, fixed_versions = future.result()
                        except Exception:
                            cves, fixed_versions = [], []
                        lookup_results[lookup_key] = (cves[:5], fixed_versions)
                except FuturesTimeoutError:
                    pass

            for future, lookup_key in future_map.items():
                if future in completed_futures:
                    continue
                if future.done():
                    try:
                        cves, fixed_versions = future.result()
                    except Exception:
                        cves, fixed_versions = [], []
                    lookup_results[lookup_key] = (cves[:5], fixed_versions)
                    continue
                future.cancel()
                lookup_skipped += 1
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    for agent_scan in agent_scan_rows:
        meta = agent_scan.get("meta") if isinstance(agent_scan.get("meta"), dict) else {}
        software_list = agent_scan.get("software") if isinstance(agent_scan.get("software"), list) else []
        scan_rows = agent_scan.get("scanRows") if isinstance(agent_scan.get("scanRows"), list) else []
        agent_findings: List[Dict[str, Any]] = []
        for scan_row in scan_rows:
            if not isinstance(scan_row, dict):
                continue
            lookup_key = scan_row.get("lookupKey")
            if not isinstance(lookup_key, tuple) or len(lookup_key) != 2:
                continue
            normalized_lookup_key = (str(lookup_key[0]), str(lookup_key[1]))
            cves, fixed_versions = lookup_results.get(normalized_lookup_key, ([], []))
            if not cves and not fixed_versions:
                continue
            agent_findings.append(
                {
                    "name": str(scan_row.get("name") or "").strip(),
                    "version": str(scan_row.get("version") or "").strip(),
                    "cves": cves[:5],
                    "fixedVersions": fixed_versions,
                }
            )
        agent_findings.sort(
            key=lambda item: max(
                [float(entry.get("score") or 0) for entry in (item.get("cves") or [])] or [0]
            ),
            reverse=True,
        )
        agents_payload.append(
            {
                **meta,
                "softwareCount": len(software_list),
                "software": software_list,
                "findingCount": len(agent_findings),
                "findings": agent_findings,
            }
        )
    agents_payload.sort(key=lambda row: (-(row.get("findingCount") or 0), str(row.get("hostname") or "")))

    matched_agents_count = len(deduped_agents)
    name_only_candidates = int(_safe_nonnegative_int(infra.get("nameOnlyCandidateCount") or 0))
    mapping_hint = str(infra.get("rmmMappingHint") or "").strip()
    if matched_agents_count > 0:
        mapping_mode = "exact"
    elif name_only_candidates > 0:
        mapping_mode = "name_only"
    else:
        mapping_mode = "none"
    if mapping_mode == "name_only" and not mapping_hint:
        mapping_hint = "RMM-Agenten via Name gefunden, aber ohne Kundennummer-Zuordnung im RMM."

    payload = {
        "customerId": customer_id,
        "scannedSoftware": scanned,
        "matchedAgents": matched_agents_count,
        "nameOnlyCandidates": name_only_candidates,
        "mappingMode": mapping_mode,
        "mappingHint": mapping_hint,
        "rmmConnected": bool(source.get("tacticalRmm")) or matched_agents_count > 0 or name_only_candidates > 0,
        "agents": agents_payload,
        "lookupSkipped": int(lookup_skipped),
        "lookupMaxUnique": int(lookup_max_unique),
        "lookupBudgetSeconds": int(lookup_budget_seconds),
        "generatedAt": now_ms,
        "fromCache": False,
    }
    _customer_cve_cache[int(customer_id)] = {"cachedAt": now_ms, "payload": payload}
    return payload


@app.post("/api/customers/{customer_id}/development/discovery_run")
def run_customer_development_discovery(customer_id: int, request: Request):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        integration = db.query(IntegrationSettings).first()

    session, host = _build_tactical_rmm_session(integration)
    if not session or not host:
        raise HTTPException(400, "RMM integration missing host or API key")

    tactical_agents, connected = _fetch_tactical_rmm_agents(integration)
    if not connected:
        raise HTTPException(502, "RMM agent list unavailable")
    matched_agents = [agent for agent in tactical_agents if _agent_matches_customer(agent, customer)]
    name_only_matches = [agent for agent in tactical_agents if _agent_matches_customer_name_only(agent, customer)]
    mapping_mode = "exact"
    selection_hint = ""
    candidate_agents = matched_agents
    if not candidate_agents and name_only_matches:
        # Fallback: still allow discovery on exactly one best name-match agent.
        # The hint keeps the missing customer-number mapping transparent.
        mapping_mode = "name_only"
        candidate_agents = name_only_matches
        selection_hint = (
            "Hinweis: Discovery wurde auf einem Namens-Treffer gestartet, "
            "weil im RMM keine eindeutige Kundennummer-Zuordnung gefunden wurde."
        )
    if not candidate_agents:
        hint = "Keine zugeordneten RMM-Agenten für diesen Kunden gefunden."
        if _normalize_customer_number(customer.creditor_number) and name_only_matches:
            hint = (
                "Hinweis: Im RMM sind passende Sites/Agenten per Name vorhanden, "
                "aber ohne Kundennummer im Customfield (z. B. 'Kundennummer'). "
                "Bitte Kundennummer je Site/Kunde im RMM hinterlegen."
            )
        return {
            "started": False,
            "hint": hint,
            "matchedAgents": 0,
            "nameOnlyCandidates": len(name_only_matches),
            "mappingMode": "none",
            "singleAgentPerCustomer": True,
        }
    deduped_agents: List[Dict[str, Any]] = []
    seen_agent_ids: Set[str] = set()
    for agent in candidate_agents:
        agent_id = _extract_agent_id(agent)
        if not agent_id or agent_id in seen_agent_ids:
            continue
        seen_agent_ids.add(agent_id)
        deduped_agents.append(agent)
    if not deduped_agents:
        raise HTTPException(404, "Matched RMM agent has no agent id")
    deduped_agents.sort(key=lambda agent: (not _agent_is_online(agent), str(agent.get("hostname") or "")))
    target_agent = deduped_agents[0]
    target_agent_id = _extract_agent_id(target_agent)
    if not target_agent_id:
        raise HTTPException(404, "Matched RMM agent has no agent id")

    scripts_payload: Optional[List[Dict[str, Any]]] = None
    for path in (
        "/scripts/?limit=1000",
        "/scripts/",
        "/scripts",
        "/api/scripts/?limit=1000",
        "/api/scripts/",
        "/api/scripts",
        "/api/v3/scripts/?limit=1000",
        "/api/v3/scripts/",
        "/api/v3/scripts",
    ):
        scripts_res, _ = _tactical_request(session, host, "GET", path, timeout=25, retries=1)
        if not scripts_res or not scripts_res.ok:
            continue
        try:
            raw_payload = scripts_res.json()
        except Exception:
            continue
        parsed_rows = _tactical_payload_rows(raw_payload)
        if parsed_rows:
            scripts_payload = parsed_rows
            break
    if scripts_payload is None:
        raise HTTPException(502, "Unexpected script list response from RMM")

    target_script = None
    for script in scripts_payload:
        name = str(script.get("name") or "").strip().lower()
        if name == "workbench_infradiscover":
            target_script = script
            break
    if target_script is None:
        for script in scripts_payload:
            name = str(script.get("name") or "").strip().lower()
            if "infra" in name and "discover" in name:
                target_script = script
                break
    if target_script is None:
        raise HTTPException(404, "Discovery script not found in RMM (expected Workbench_InfraDiscover)")

    script_id = target_script.get("id")
    if not isinstance(script_id, int):
        raise HTTPException(502, "Invalid discovery script id from RMM")

    api_url_override = str(os.environ.get("INFRA_DISCOVERY_API_URL") or "").strip()
    if api_url_override:
        api_url = str(api_url_override).rstrip("/")
    else:
        forwarded_proto = str(request.headers.get("x-forwarded-proto") or "").split(",")[0].strip().lower()
        forwarded_host = str(request.headers.get("x-forwarded-host") or "").split(",")[0].strip()
        host_header = forwarded_host or str(request.headers.get("host") or "").strip()
        if not host_header:
            host_header = str(urlparse(str(request.base_url)).netloc or "").strip()
        scheme = forwarded_proto or str(request.url.scheme or "http").strip().lower() or "http"
        host_lc = host_header.lower()
        if scheme == "http" and host_lc and not (
            host_lc.startswith("localhost")
            or host_lc.startswith("127.0.0.1")
            or host_lc.startswith("0.0.0.0")
            or host_lc.startswith("::1")
        ):
            scheme = "https"
        api_url = f"{scheme}://{host_header.rstrip('/')}/api"
    discovery_token = str(os.environ.get("INFRA_DISCOVERY_TOKEN") or "").strip()
    args = [
        "--api-url", api_url,
        "--customer-id", str(customer.id),
        "--customer-number", str(customer.creditor_number or "").strip(),
        "--customer-name", str(customer.name or "").strip(),
        "--source", "rmm_agent_scan",
        "--rmm-host", host,
        "--rmm-api-key", str(integration.rmm_api_key or "").strip() if integration else "",
        "--rmm-api-key-header", str((integration.rmm_api_key_header or "X-API-KEY") if integration else "X-API-KEY"),
        "--rmm-agent-id", target_agent_id,
        "--derive-prefix", "24",
        "--cache-ttl-seconds", "1800",
        "--force",
    ]
    if discovery_token:
        args.extend(["--discovery-token", discovery_token])

    # Do not block the API request on long-running discovery scripts.
    # Trigger in background to avoid reverse-proxy 504 timeouts.
    run_payload_base = {
        "emails": [],
        "emailMode": "default",
        "custom_field": None,
        "script": script_id,
        "args": args,
        "env_vars": [],
        "run_as_user": False,
        "timeout": 1500,
    }
    run_payload_variants = [
        {
            **run_payload_base,
            "output": "forget",
            "save_all_output": False,
        },
        {
            **run_payload_base,
            "output": "wait",
            "save_all_output": True,
        },
    ]

    def _trigger_discovery_background() -> None:
        bg_session, bg_host = _build_tactical_rmm_session(integration)
        if not bg_session or not bg_host:
            logger.warning("Discovery background trigger failed: missing RMM session/host")
            return
        run_error = ""
        attempted_paths: List[str] = []
        for path in (
            f"/agents/{quote(target_agent_id)}/runscript/",
            f"/agents/{quote(target_agent_id)}/runscript",
            f"/api/agents/{quote(target_agent_id)}/runscript/",
            f"/api/agents/{quote(target_agent_id)}/runscript",
            f"/api/v3/agents/{quote(target_agent_id)}/runscript/",
            f"/api/v3/agents/{quote(target_agent_id)}/runscript",
        ):
            for payload in run_payload_variants:
                mode = str(payload.get("output") or "wait").strip().lower() or "wait"
                run_res, req_error = _tactical_request(
                    bg_session,
                    bg_host,
                    "POST",
                    path,
                    timeout=1800,
                    retries=0,
                    json_payload=payload,
                )
                if not run_res:
                    run_error = req_error or f"request_failed on {path}"
                    attempted_paths.append(f"{path}[{mode}] -> ERR")
                    continue
                attempted_paths.append(f"{path}[{mode}] -> {run_res.status_code}")
                if not run_res.ok:
                    run_error = f"HTTP {run_res.status_code} on {path}"
                    continue
                logger.info(
                    "Discovery run triggered for customer %s via %s (output=%s)",
                    customer.id,
                    path,
                    mode,
                )
                return
        logger.warning(
            "Discovery background trigger failed for customer %s agent %s: %s (attempts=%s)",
            customer.id,
            target_agent_id,
            run_error or "unknown API error",
            "; ".join(attempted_paths[:16]) or "none",
        )

    threading.Thread(target=_trigger_discovery_background, daemon=True).start()
    logger.info(
        "Discovery queued for customer %s on agent %s using api_url=%s (mode=%s, exact=%s, name_only=%s)",
        customer.id,
        target_agent_id,
        api_url,
        mapping_mode,
        len(matched_agents),
        len(name_only_matches),
    )

    response_message = (
        f"Discovery gestartet auf {str(target_agent.get('hostname') or target_agent.get('name') or '').strip() or target_agent_id}."
    )
    if selection_hint:
        response_message = f"{response_message} {selection_hint}"
    return {
        "status": "queued",
        "started": True,
        "customerId": customer.id,
        "customerName": customer.name or "",
        "agentId": target_agent_id,
        "agentHostname": str(target_agent.get("hostname") or target_agent.get("name") or "").strip(),
        "matchedAgents": len(matched_agents),
        "nameOnlyCandidates": len(name_only_matches),
        "mappingMode": mapping_mode,
        "singleAgentPerCustomer": True,
        "hint": selection_hint,
        "message": response_message,
        "scriptId": script_id,
        "scriptName": str(target_script.get("name") or "").strip(),
        "apiUrl": api_url,
        "rmmResponse": {},
    }


@app.post("/api/customer_development/ai_assist")
def customer_development_ai_assist(data: CustomerDevelopmentAiRequest, request: Request):
    mode = str(data.mode or "summary").strip().lower()
    if mode not in {"summary", "mail", "leitfaden", "analyse", "angebot", "kundenbericht", "newsletter", "aktivierung_mail", "aktivierung_call"}:
        mode = "summary"

    if mode == "newsletter":
        payload = _resolve_customer_development_payload_with_fallback(
            include_inactive=False,
            full=False,
            request=request,
        )
        contexts = payload.get("contexts") or []
        if not contexts:
            raise HTTPException(404, "No customer contexts available")
        top = contexts[:10]
        aggregated_sources = _aggregate_customer_development_ai_sources(top)
        source_lines = _customer_development_ai_source_lines(aggregated_sources)
        avg_risk = round(
            sum(float(item.get("riskScore") or 0) for item in top) / max(1, len(top)),
            1,
        )
        signals: Dict[str, int] = {}
        for item in top:
            for signal in (item.get("signals") or [])[:3]:
                label = str(signal or "").strip()
                if not label:
                    continue
                signals[label] = signals.get(label, 0) + 1
        signal_lines = sorted(signals.items(), key=lambda pair: pair[1], reverse=True)[:8]
        prompt = (
            "Erstelle 3 allgemein nutzbare Newsletter-Themen fuer IT-Kunden.\n"
            "Die Themen sollen auf den haeufigsten Kundensignalen basieren.\n"
            "Pro Thema: Ueberschrift + 2-3 Saetze Nutzen/Problembezug.\n"
            "Nutze die verfuegbare Quellenlage und benenne fehlende Quellen transparent.\n"
            f"Ton: {str(data.tone or 'sachlich')}\n"
            f"Durchschnittliches Risiko (Top-Kunden): {avg_risk}\n"
            "Quellenlage:\n"
            + "\n".join(source_lines)
            + "\n"
            "Haeufige Signale:\n"
            + "\n".join([f"- {name} ({count}x)" for name, count in signal_lines])
            + "\nAntwort als reiner Text, kein JSON, kein Markdown."
        )
        text_result, used_fallback, resolved_timeout = _generate_customer_development_ai_text(
            context=top[0],
            prompt=prompt,
            mode=mode,
            timeout_seconds=CUSTOMER_DEVELOPMENT_AI_TIMEOUT_SECONDS,
        )
        return {
            "customer_id": None,
            "mode": mode,
            "tone": str(data.tone or "sachlich"),
            "text": text_result,
            "sources": aggregated_sources,
            "provider": "fallback" if used_fallback else _get_ai_config_snapshot().get("provider", AI_PROVIDER_OLLAMA),
            "used_fallback": bool(used_fallback),
            "timeout_seconds": int(resolved_timeout),
            "generated_at": int(time.time() * 1000),
        }

    if data.customer_id is None:
        raise HTTPException(400, "customer_id required for this mode")
    payload = _resolve_customer_development_payload_with_fallback(
        include_inactive=True,
        customer_id=int(data.customer_id),
        full=True,
        request=request,
    )
    contexts = payload.get("contexts") or []
    if not contexts:
        raise HTTPException(404, "Customer not found")
    context = contexts[0]
    return _build_customer_development_ai_response(
        context=context,
        mode=mode,
        tone=str(data.tone or "sachlich"),
        customer_id=int(data.customer_id) if data.customer_id is not None else None,
        timeout_seconds=CUSTOMER_DEVELOPMENT_AI_TIMEOUT_SECONDS,
    )


@app.post("/api/internal/customer_development/ai_assist_context")
def customer_development_ai_assist_context(data: CustomerDevelopmentAiInternalRequest, request: Request):
    if not _meta_hub_internal_authorized(request):
        raise HTTPException(403, "Meta-Hub internal access denied")
    context = data.context if isinstance(data.context, dict) else {}
    if not context:
        raise HTTPException(400, "context required")
    return _build_customer_development_ai_response(
        context=context,
        mode=str(data.mode or "summary"),
        tone=str(data.tone or "sachlich"),
        customer_id=int(data.customer_id) if data.customer_id is not None else None,
        timeout_seconds=CUSTOMER_DEVELOPMENT_AI_INTERNAL_TIMEOUT_SECONDS,
    )


@app.post("/api/customer_development/report_suggestion_preview")
def customer_development_report_suggestion_preview(
    data: CustomerDevelopmentReportSuggestionPreviewRequest,
):
    payload = _resolve_customer_development_payload(
        include_inactive=True,
        customer_id=int(data.customer_id),
        full=True,
    )
    contexts = payload.get("contexts") or []
    if not contexts:
        raise HTTPException(404, "Customer not found")
    context = contexts[0]
    suggestion = _build_report_item_from_recommendation(
        context,
        recommendation_index=int(data.recommendation_index or 0),
    )
    return {
        "reportUnchanged": True,
        "customer_id": int(data.customer_id),
        "customer_name": context.get("customerName") or "",
        "suggestion": suggestion,
        "generated_at": int(time.time() * 1000),
    }


@app.post("/api/customer_development/report_suggestion_import")
def customer_development_report_suggestion_import(
    data: CustomerDevelopmentReportSuggestionImportRequest,
):
    if not bool(data.confirm):
        raise HTTPException(400, "confirm=true required for report import")
    payload = _resolve_customer_development_payload(
        include_inactive=True,
        customer_id=int(data.customer_id),
        full=True,
    )
    contexts = payload.get("contexts") or []
    if not contexts:
        raise HTTPException(404, "Customer not found")
    context = contexts[0]
    suggestion = _build_report_item_from_recommendation(
        context,
        recommendation_index=int(data.recommendation_index or 0),
    )
    with SessionLocal() as db:
        report = db.query(Report).get(int(data.report_id))
        if not report:
            raise HTTPException(404, "Report not found")
        custom_data = ""
        raw_custom_data = suggestion.get("custom_data")
        if isinstance(raw_custom_data, dict) and raw_custom_data:
            custom_data = json.dumps(raw_custom_data)
        report_item = ReportItem(
            report_id=report.id,
            priority=str(suggestion.get("priority") or "Planbar"),
            title=str(suggestion.get("title") or ""),
            system=str(suggestion.get("system") or ""),
            why_text=str(suggestion.get("why_text") or ""),
            impact=str(suggestion.get("impact") or ""),
            duration=str(suggestion.get("duration") or ""),
            cost=str(suggestion.get("cost") or ""),
            action_type=str(suggestion.get("action_type") or "standard"),
            custom_html=str(suggestion.get("custom_html") or ""),
            custom_text=str(suggestion.get("custom_text") or ""),
            custom_data=custom_data,
        )
        db.add(report_item)
        db.commit()
        db.refresh(report_item)
        return {
            "status": "imported",
            "report_id": report.id,
            "report_item": serialize_report_item(report_item),
        }


def _sevdesk_contact_display_name(contact: Dict[str, Any]) -> str:
    for key in ("name", "name2", "contactName"):
        value = str(contact.get(key) or "").strip()
        if value:
            return value
    first_name = str(contact.get("firstName") or "").strip()
    last_name = str(contact.get("surename") or contact.get("lastName") or "").strip()
    joined = " ".join([part for part in [first_name, last_name] if part]).strip()
    return joined


@app.post("/api/customers/sync_sevdesk")
def sync_customers_from_sevdesk():
    with SessionLocal() as db:
        integration = db.query(IntegrationSettings).first()
        if not integration:
            raise HTTPException(400, "Integration settings missing")
        metrics = _get_customer_metrics_settings(db)
        config = _build_sevdesk_config(integration, metrics)
        if not config.api_token:
            raise HTTPException(400, "Sevdesk settings missing: sevdesk_api_token")
        try:
            contacts = SevdeskClient(config, timeout=25).list_contacts(limit=200, max_pages=25)
        except SevdeskError as exc:
            raise HTTPException(502, f"Sevdesk sync failed: {exc}") from exc

        existing = db.query(Customer).all()
        by_number: Dict[str, Customer] = {}
        for customer in existing:
            raw_number = str(customer.creditor_number or "").strip()
            normalized_number = _normalize_customer_number(raw_number)
            if raw_number:
                by_number[raw_number] = customer
            if normalized_number and normalized_number not in by_number:
                by_number[normalized_number] = customer
        by_name = {
            _dev_normalize_text(customer.name): customer
            for customer in existing
            if _dev_normalize_text(customer.name)
        }

        created = 0
        updated = 0
        seen_numbers: set[str] = set()
        for contact in contacts:
            number = _extract_customer_number_from_contact(contact)
            normalized_number = _normalize_customer_number(number)
            name = _sevdesk_contact_display_name(contact)
            billing_email = _extract_sevdesk_contact_email(contact)
            billing_address = _extract_sevdesk_contact_billing_address(contact)
            if number:
                seen_numbers.add(number)
            if normalized_number:
                seen_numbers.add(normalized_number)
            if not name and not number:
                continue
            customer = None
            if number:
                customer = by_number.get(number)
            if not customer and normalized_number:
                customer = by_number.get(normalized_number)
            if not customer and name:
                customer = by_name.get(_dev_normalize_text(name))
            if customer:
                changed = False
                if number and not str(customer.creditor_number or "").strip():
                    customer.creditor_number = number
                    changed = True
                if name and _dev_normalize_text(name) != _dev_normalize_text(customer.name):
                    customer.name = name
                    changed = True
                if billing_email != _customer_billing_email(customer):
                    customer.billing_email = billing_email
                    changed = True
                if billing_address["street"] != _clean_customer_contact_value(customer.billing_street):
                    customer.billing_street = billing_address["street"]
                    changed = True
                if billing_address["postal_code"] != _clean_customer_contact_value(customer.billing_postal_code):
                    customer.billing_postal_code = billing_address["postal_code"]
                    changed = True
                if billing_address["city"] != _clean_customer_contact_value(customer.billing_city):
                    customer.billing_city = billing_address["city"]
                    changed = True
                if billing_address["country"] != _clean_customer_contact_value(customer.billing_country):
                    customer.billing_country = billing_address["country"]
                    changed = True
                if changed:
                    updated += 1
                continue
            created_customer = Customer(
                name=name or f"Kunde {number}",
                creditor_number=number or "",
                billing_email=billing_email,
                billing_street=billing_address["street"],
                billing_postal_code=billing_address["postal_code"],
                billing_city=billing_address["city"],
                billing_country=billing_address["country"],
                status="active",
                contract_flags="[]",
            )
            db.add(created_customer)
            created += 1

        inactivated = 0
        if seen_numbers:
            for customer in existing:
                number_raw = str(customer.creditor_number or "").strip()
                number_normalized = _normalize_customer_number(number_raw)
                if not number_raw and not number_normalized:
                    continue
                if (
                    number_raw not in seen_numbers
                    and number_normalized not in seen_numbers
                    and (customer.status or "active").lower() != "inactive"
                ):
                    customer.status = "inactive"
                    inactivated += 1
        db.commit()
        return {
            "status": "ok",
            "created": created,
            "updated": updated,
            "reactivated": 0,
            "inactivated": inactivated,
            "contacts": len(contacts),
        }


def _find_existing_discovery_device(
    db,
    *,
    customer_id: Optional[int],
    source: str,
    hostname: str,
    ip: str,
    mac: str,
) -> Optional[InfraDiscoveryDevice]:
    query = db.query(InfraDiscoveryDevice).filter(
        InfraDiscoveryDevice.customer_id == customer_id,
        func.lower(func.trim(InfraDiscoveryDevice.source)) == source.lower(),
    )
    mac_no_sep = mac.replace(":", "")
    if mac_no_sep:
        row = (
            query.filter(
                func.replace(func.replace(func.lower(func.trim(InfraDiscoveryDevice.mac)), "-", ""), ":", "") == mac_no_sep
            )
            .order_by(InfraDiscoveryDevice.last_seen_at.desc(), InfraDiscoveryDevice.id.desc())
            .first()
        )
        if row:
            return row
    if ip:
        row = (
            query.filter(func.lower(func.trim(InfraDiscoveryDevice.ip)) == ip.lower())
            .order_by(InfraDiscoveryDevice.last_seen_at.desc(), InfraDiscoveryDevice.id.desc())
            .first()
        )
        if row:
            return row
    if hostname:
        row = (
            query.filter(func.lower(func.trim(InfraDiscoveryDevice.hostname)) == hostname.lower())
            .order_by(InfraDiscoveryDevice.last_seen_at.desc(), InfraDiscoveryDevice.id.desc())
            .first()
        )
        if row:
            return row
    return (
        query.filter(
            func.lower(func.trim(InfraDiscoveryDevice.ip)) == ip.lower(),
            func.replace(func.replace(func.lower(func.trim(InfraDiscoveryDevice.mac)), "-", ""), ":", "") == mac_no_sep,
        )
        .order_by(InfraDiscoveryDevice.last_seen_at.desc(), InfraDiscoveryDevice.id.desc())
        .first()
    )


@app.post("/api/infrastructure/discovery")
def ingest_infrastructure_discovery(
    payload: InfraDiscoveryIngestRequest,
    x_discovery_token: Optional[str] = Header(default=None, alias="X-Discovery-Token"),
):
    expected_token = str(os.environ.get("INFRA_DISCOVERY_TOKEN") or "").strip()
    if expected_token and str(x_discovery_token or "").strip() != expected_token:
        raise HTTPException(401, "Invalid discovery token")
    now_ms = int(time.time() * 1000)
    created = 0
    updated = 0
    inactivated = 0
    reactivated = 0
    skipped = 0
    touched_ids_by_scope: Dict[Tuple[int, str], Set[int]] = {}
    with SessionLocal() as db:
        for item in payload.items:
            resolved_customer_id = item.customer_id
            if resolved_customer_id is None:
                number_value = str(item.customer_number or "").strip()
                name_value = str(item.customer_name or "").strip()
                customer_match = None
                if number_value:
                    normalized_number = _normalize_customer_number(number_value)
                    customer_match = (
                        db.query(Customer)
                        .filter(
                            or_(
                                func.lower(func.trim(Customer.creditor_number))
                                == func.lower(func.trim(number_value)),
                                func.lower(func.trim(Customer.creditor_number))
                                == func.lower(func.trim(normalized_number)),
                            )
                        )
                        .first()
                    )
                if not customer_match and name_value:
                    customer_match = (
                        db.query(Customer)
                        .filter(func.lower(func.trim(Customer.name)) == func.lower(func.trim(name_value)))
                        .first()
                    )
                if customer_match:
                    resolved_customer_id = customer_match.id

            source_value = str(item.source or "agent").strip() or "agent"
            source_key = source_value.lower()
            hostname_value = str(item.hostname or "").strip()
            ip_value = str(item.ip or "").strip()
            mac_value = _normalize_discovery_mac_text(item.mac)
            protocol_value = str(item.protocol or "").strip()
            device_type_value = str(item.device_type or "").strip()
            vendor_value = str(item.vendor or "").strip()
            evidence_payload = (
                [str(entry).strip() for entry in item.evidence if str(entry).strip()]
                if isinstance(item.evidence, list)
                else None
            )
            seen_at = int(item.seen_at or now_ms)
            if not hostname_value and not ip_value and not mac_value:
                skipped += 1
                continue

            existing = _find_existing_discovery_device(
                db,
                customer_id=resolved_customer_id,
                source=source_value,
                hostname=hostname_value,
                ip=ip_value,
                mac=mac_value,
            )

            if existing:
                was_active = bool(existing.is_active)
                existing.customer_id = resolved_customer_id
                if str(item.customer_number or "").strip():
                    existing.customer_number = str(item.customer_number or "").strip()
                if str(item.customer_name or "").strip():
                    existing.customer_name = str(item.customer_name or "").strip()
                if hostname_value:
                    existing.hostname = hostname_value
                if ip_value:
                    existing.ip = ip_value
                if mac_value:
                    existing.mac = mac_value
                if protocol_value:
                    existing.protocol = protocol_value
                if device_type_value:
                    existing.device_type = device_type_value
                if vendor_value:
                    existing.vendor = vendor_value
                if item.confidence is not None:
                    existing.confidence = max(0, min(100, int(item.confidence or 0)))
                if evidence_payload is not None:
                    existing.evidence = json.dumps(evidence_payload)
                existing.managed = bool(item.managed)
                existing.source = source_value
                existing.last_seen_at = seen_at
                existing.is_active = True
                if not was_active:
                    reactivated += 1
                updated += 1
                row = existing
            else:
                row = InfraDiscoveryDevice(
                    customer_id=resolved_customer_id,
                    customer_number=str(item.customer_number or "").strip(),
                    customer_name=str(item.customer_name or "").strip(),
                    source=source_value,
                    hostname=hostname_value,
                    ip=ip_value,
                    mac=mac_value,
                    protocol=protocol_value,
                    device_type=device_type_value,
                    vendor=vendor_value,
                    confidence=max(0, min(100, int(item.confidence or 0))),
                    evidence=json.dumps(evidence_payload or []),
                    managed=bool(item.managed),
                    is_active=True,
                    last_seen_at=seen_at,
                )
                db.add(row)
                db.flush()
                created += 1

            if resolved_customer_id is not None:
                scope = (int(resolved_customer_id), source_key)
                touched = touched_ids_by_scope.get(scope)
                if touched is None:
                    touched = set()
                    touched_ids_by_scope[scope] = touched
                touched.add(int(row.id))

        for (scope_customer_id, scope_source), seen_ids in touched_ids_by_scope.items():
            stale_rows = (
                db.query(InfraDiscoveryDevice)
                .filter(
                    InfraDiscoveryDevice.customer_id == scope_customer_id,
                    func.lower(func.trim(InfraDiscoveryDevice.source)) == scope_source,
                    or_(InfraDiscoveryDevice.is_active == True, InfraDiscoveryDevice.is_active.is_(None)),
                    ~InfraDiscoveryDevice.id.in_(list(seen_ids) or [-1]),
                )
                .all()
            )
            for stale in stale_rows:
                stale.is_active = False
                inactivated += 1

        db.commit()
    return {
        "status": "ok",
        "created": created,
        "updated": updated,
        "reactivated": reactivated,
        "inactivated": inactivated,
        "skipped": skipped,
    }


# ============ REPORT CUSTOMERS (DUMMY) ============
@app.get("/api/report_customers")
def get_report_customers():
    return []


@app.post("/api/customers")
def create_customer(data: CustomerCreate):
    with SessionLocal() as db:
        status_value = str(data.status or "active").strip().lower()
        if status_value not in {"active", "inactive"}:
            status_value = "active"
        contract_flags = _normalize_contract_flags(data.contract_flags)
        customer = Customer(
            name=data.name,
            creditor_number=data.creditor_number or "",
            short_code=data.short_code or "",
            email=data.email or "",
            newsletter_email=data.newsletter_email or "",
            time_tracking_enabled=bool(data.time_tracking_enabled),
            customer_report=True if data.customer_report is None else bool(data.customer_report),
            newsletter=True if data.newsletter is None else bool(data.newsletter),
            status=status_value,
            maintenance_contract=bool(data.maintenance_contract) or ("wartung" in contract_flags),
            contract_flags=json.dumps(contract_flags),
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
        contract_document_flags_by_customer, contract_type_counts_by_customer = (
            _load_contract_document_meta_for_customers(db, [int(customer.id)])
        )
        return serialize_customer(
            customer,
            contract_document_flags=contract_document_flags_by_customer.get(int(customer.id), []),
            contract_type_counts=contract_type_counts_by_customer.get(int(customer.id), {}),
        )


@app.patch("/api/customers/{customer_id}")
def update_customer(customer_id: int, data: CustomerUpdate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")

        previous_name = customer.name
        update_fields = data.dict(exclude_unset=True, exclude={"phones"})
        if "status" in update_fields:
            normalized_status = str(update_fields.get("status") or "").strip().lower()
            update_fields["status"] = normalized_status if normalized_status in {"active", "inactive"} else "active"
        if "contract_flags" in update_fields:
            flags = _normalize_contract_flags(update_fields.get("contract_flags"))
            update_fields["contract_flags"] = json.dumps(flags)
            update_fields["maintenance_contract"] = bool(update_fields.get("maintenance_contract")) or ("wartung" in flags)
        for field, value in update_fields.items():
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

        if customer.name != previous_name:
            db.query(DayTask).filter(
                func.lower(func.trim(DayTask.customer)) == func.lower(func.trim(previous_name))
            ).update({DayTask.customer: customer.name}, synchronize_session=False)

        db.commit()
        db.refresh(customer)
        contract_document_flags_by_customer, contract_type_counts_by_customer = (
            _load_contract_document_meta_for_customers(db, [int(customer.id)])
        )
        return serialize_customer(
            customer,
            contract_document_flags=contract_document_flags_by_customer.get(int(customer.id), []),
            contract_type_counts=contract_type_counts_by_customer.get(int(customer.id), {}),
        )


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
def get_customer_metrics(customer_id: int, kpi_month_offset: int = 0):
    contract_time_budget: Dict[str, Any] = {}
    sevdesk_recurring_tags: Dict[str, Any] = {
        "monthlyTotalEur": 0.0,
        "itemCount": 0,
        "tagCount": 0,
        "tagTotals": [],
        "invoices": [],
    }
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        now_ms = int(time.time() * 1000)
        now_dt = datetime.fromtimestamp(now_ms / 1000)
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
        address = _customer_address_text(_customer_effective_address(customer))
        phone_numbers = [phone.number for phone in customer.phones]
        contract_time_budget = _customer_contract_time_budget(db, customer, now_ms)

    with SessionLocal() as db:
        metrics_settings = _get_customer_metrics_settings(db)
        integration_settings = db.query(IntegrationSettings).first()
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
    total_calls = 0
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
            "COALESCE(SUM(CASE WHEN answered = false THEN 1 ELSE 0 END), 0) AS missed_calls, "
            "COALESCE(COUNT(*), 0) AS total_calls "
            "FROM telephony_calls "
            "WHERE start_time >= :since AND (" + where_clause + ")"
        )
        try:
            with engine.begin() as connection:
                row = connection.execute(text(sql), params).mappings().first()
                if row:
                    total_seconds = int(row.get("total_seconds") or 0)
                    missed_calls = int(row.get("missed_calls") or 0)
                    total_calls = int(row.get("total_calls") or 0)
        except Exception:
            total_seconds = 0
            missed_calls = 0
            total_calls = 0

    total_minutes = round(total_seconds / 60, 1) if total_seconds else 0
    try:
        km_rate = float(metrics_settings.km_rate_eur or 0)
        min_distance_km = float(metrics_settings.min_distance_km or 0)
        min_fee_eur = float(metrics_settings.min_fee_eur or 0)
    except ValueError:
        km_rate = 0.0
        min_distance_km = 0.0
        min_fee_eur = 0.0
    hourly_rate = _resolve_configured_hourly_rate(integration_settings, metrics_settings)
    mileage_eur = None
    round_trip_km = None
    if distance_km is not None:
        round_trip_km = round(distance_km * 2, 1)
        if min_distance_km and round_trip_km < min_distance_km and min_fee_eur:
            mileage_eur = round(min_fee_eur, 2)
        else:
            mileage_eur = round(round_trip_km * km_rate, 2)
    open_time_minutes = round(open_time_ms / 60000, 1) if open_time_ms else 0
    open_time_hours = round(open_time_ms / 3600000, 2) if open_time_ms else 0
    estimated_revenue = round(open_time_hours * hourly_rate, 2) if hourly_rate else 0
    selected_month_offset = max(-120, min(0, int(kpi_month_offset or 0)))
    selected_month_start_ms, selected_month_end_ms, selected_month_label = _month_bounds_with_offset(
        now_dt,
        selected_month_offset,
    )
    with SessionLocal() as db:
        monthly_task_metrics = _customer_timed_task_metrics_window(
            db,
            customer,
            selected_month_start_ms,
            selected_month_end_ms,
            now_ms,
        )
    monthly_telephony = _customer_telephony_metrics_window(
        phone_numbers,
        selected_month_start_ms,
        selected_month_end_ms,
    )
    monthly_task_hours = round(float(monthly_task_metrics.get("hours") or 0.0), 2)
    monthly_telephony_hours = round(float(monthly_telephony.get("minutes") or 0.0) / 60.0, 2)
    monthly_consumed_hours = round(monthly_task_hours + monthly_telephony_hours, 2)
    monthly_task_revenue = round(monthly_task_hours * hourly_rate, 2) if hourly_rate > 0 else 0.0
    monthly_consumed_revenue = round(monthly_consumed_hours * hourly_rate, 2) if hourly_rate > 0 else 0.0

    revenue_current_year = None
    revenue_last_year = None
    revenue_total = None
    revenue_delta = None
    revenue_delta_pct = None
    period_stats = {
        "currentYear": {
            "key": "currentYear",
            "label": f"Lfd. Jahr {datetime.now().year}",
            "workHours": None,
            "workRevenueEur": None,
            "materialRevenueEur": None,
            "serviceRevenueEur": None,
            "totalRevenueEur": None,
            "invoiceCount": 0,
        },
        "lastYear": {
            "key": "lastYear",
            "label": f"Vorjahr {datetime.now().year - 1}",
            "workHours": None,
            "workRevenueEur": None,
            "materialRevenueEur": None,
            "serviceRevenueEur": None,
            "totalRevenueEur": None,
            "invoiceCount": 0,
        },
    }
    if integration_settings:
        sevdesk_config = _build_sevdesk_config(integration_settings, metrics_settings)
        if sevdesk_config.api_token:
            customer_number = (customer.creditor_number or customer.short_code or "").strip()
            contact = None
            if customer_number:
                try:
                    contact = SevdeskClient(sevdesk_config).get_contact_by_customer_number(customer_number)
                except SevdeskError:
                    contact = None
            contact_id = None
            if isinstance(contact, dict):
                try:
                    contact_id = int(contact.get("id"))
                except (TypeError, ValueError):
                    contact_id = None
            if contact_id:
                try:
                    client = SevdeskClient(sevdesk_config)
                    invoices = client.list_invoices(
                        params={
                            "contact[id]": contact_id,
                            "contact[objectName]": "Contact"
                        },
                        max_pages=25
                    )
                    now_dt = datetime.now()
                    start_current_year = datetime(now_dt.year, 1, 1)
                    start_last_year = datetime(now_dt.year - 1, 1, 1)
                    end_last_year = datetime(now_dt.year - 1, 12, 31, 23, 59, 59)
                    sum_total = 0.0
                    sum_current = 0.0
                    sum_last = 0.0
                    period_invoice_refs: Dict[str, List[int]] = {"currentYear": [], "lastYear": []}
                    for invoice in invoices:
                        if not _invoice_is_paid(invoice):
                            continue
                        amount = _invoice_paid_amount(invoice)
                        if amount <= 0:
                            continue
                        sum_total += amount
                        paid_date = _invoice_date_for_paid(invoice)
                        if not paid_date:
                            continue
                        invoice_id = _parse_int(invoice.get("id"))
                        if start_current_year <= paid_date <= now_dt:
                            sum_current += amount
                            period_stats["currentYear"]["totalRevenueEur"] = round(sum_current, 2)
                            period_stats["currentYear"]["invoiceCount"] += 1
                            if invoice_id:
                                period_invoice_refs["currentYear"].append(invoice_id)
                        elif start_last_year <= paid_date <= end_last_year:
                            sum_last += amount
                            period_stats["lastYear"]["totalRevenueEur"] = round(sum_last, 2)
                            period_stats["lastYear"]["invoiceCount"] += 1
                            if invoice_id:
                                period_invoice_refs["lastYear"].append(invoice_id)
                    revenue_total = round(sum_total, 2)
                    revenue_current_year = round(sum_current, 2)
                    revenue_last_year = round(sum_last, 2)
                    revenue_delta = round(revenue_current_year - revenue_last_year, 2)
                    if revenue_last_year and revenue_last_year > 0:
                        revenue_delta_pct = round((revenue_delta / revenue_last_year) * 100, 1)
                    sevdesk_recurring_tags = _build_customer_sevdesk_recurring_tags(client, contact_id)

                    for period_key, invoice_ids in period_invoice_refs.items():
                        work_hours = 0.0
                        work_revenue = 0.0
                        material_revenue = 0.0
                        service_revenue = 0.0
                        for invoice_id in invoice_ids:
                            pos_payload = client.request(
                                "GET",
                                "/InvoicePos",
                                params={
                                    "invoice[id]": invoice_id,
                                    "invoice[objectName]": "Invoice",
                                    "limit": 250,
                                    "offset": 0,
                                },
                            )
                            objects = pos_payload.get("objects")
                            if isinstance(objects, list):
                                position_rows = [row for row in objects if isinstance(row, dict)]
                            elif isinstance(objects, dict):
                                position_rows = [objects]
                            else:
                                position_rows = []
                            for row in position_rows:
                                amount = _parse_sevdesk_amount(row)
                                quantity = _parse_float(row.get("quantity"), default=0.0)
                                is_worktime = _is_worktime_invoice_position(row, config=sevdesk_config)
                                is_travel = _is_travel_invoice_position(row)
                                if _is_material_invoice_position(row, config=sevdesk_config):
                                    material_revenue += amount
                                    continue
                                if is_worktime:
                                    work_revenue += amount
                                    service_revenue += amount
                                    if quantity > 0 and not is_travel:
                                        work_hours += quantity
                                    continue
                                if _is_service_invoice_position(row, config=sevdesk_config):
                                    service_revenue += amount
                        period_stats[period_key]["workHours"] = round(work_hours, 2)
                        period_stats[period_key]["workRevenueEur"] = round(work_revenue, 2)
                        period_stats[period_key]["materialRevenueEur"] = round(material_revenue, 2)
                        period_stats[period_key]["serviceRevenueEur"] = round(service_revenue, 2)
                        total_value = period_stats[period_key].get("totalRevenueEur")
                        if total_value is None:
                            period_stats[period_key]["totalRevenueEur"] = 0.0
                except SevdeskError:
                    revenue_current_year = None
                    revenue_last_year = None
                    revenue_total = None
                    revenue_delta = None
                    revenue_delta_pct = None
                    sevdesk_recurring_tags = {
                        "monthlyTotalEur": 0.0,
                        "invoiceCount": 0,
                        "tagCount": 0,
                        "tagTotals": [],
                        "invoices": [],
                    }
                    period_stats = {
                        "currentYear": {
                            "key": "currentYear",
                            "label": f"Lfd. Jahr {datetime.now().year}",
                            "workHours": None,
                            "workRevenueEur": None,
                            "materialRevenueEur": None,
                            "serviceRevenueEur": None,
                            "totalRevenueEur": None,
                            "invoiceCount": 0,
                        },
                        "lastYear": {
                            "key": "lastYear",
                            "label": f"Vorjahr {datetime.now().year - 1}",
                            "workHours": None,
                            "workRevenueEur": None,
                            "materialRevenueEur": None,
                            "serviceRevenueEur": None,
                            "totalRevenueEur": None,
                            "invoiceCount": 0,
                        },
                    }

    return {
        "customerId": int(customer_id),
        "openTasks": open_tasks,
        "openTimeTasks": open_time_tasks,
        "openDayTasks": open_day_tasks,
        "openTimeMinutes": open_time_minutes,
        "estimatedRevenueEur": estimated_revenue,
        "distanceKm": distance_km,
        "distanceRoundTripKm": round_trip_km,
        "mileageEur": mileage_eur,
        "missedCalls": missed_calls,
        "totalCalls": total_calls,
        "totalMinutes": total_minutes,
        "revenueTotalEur": revenue_total,
        "revenueCurrentYearEur": revenue_current_year,
        "revenueLastYearEur": revenue_last_year,
        "revenueDeltaEur": revenue_delta,
        "revenueDeltaPct": revenue_delta_pct,
        "monthlyActivity": {
            "monthOffset": int(selected_month_offset),
            "monthLabel": selected_month_label,
            "monthStartMs": int(selected_month_start_ms),
            "monthEndMs": int(selected_month_end_ms),
            "taskHours": monthly_task_hours,
            "taskRevenueEur": monthly_task_revenue,
            "taskCount": int(monthly_task_metrics.get("count") or 0),
            "telephonyHours": monthly_telephony_hours,
            "telephonyMinutes": round(float(monthly_telephony.get("minutes") or 0.0), 1),
            "callCount": int(monthly_telephony.get("calls") or 0),
            "missedCalls": int(monthly_telephony.get("missed") or 0),
            "consumedHours": monthly_consumed_hours,
            "consumedRevenueEur": monthly_consumed_revenue,
        },
        "periodStats": period_stats,
        "contractTimeBudget": contract_time_budget,
        "sevdeskRecurringTags": {
            **sevdesk_recurring_tags,
            "itemCount": int(sevdesk_recurring_tags.get("invoiceCount") or 0),
        },
    }


# ================= DAY PLAN TASKS =================
@app.get("/api/day_tasks")
def get_day_tasks():
    with SessionLocal() as db:
        tasks = db.query(DayTask).order_by(DayTask.created_at.desc()).all()
        return [serialize_day_task(t) for t in tasks]


@app.post("/api/day_tasks/email_draft")
def analyze_day_task_email_draft(data: DayTaskEmailDraftRequest):
    subject = _normalize_space(data.subject)
    sender_email = _normalize_space(data.fromEmail).lower()
    sender_name = _normalize_space(data.fromName)
    raw_text = str(data.text or "")
    extracted_text = _extract_visible_text_from_raw_email(raw_text)
    plain_text = _normalize_space(extracted_text or raw_text)
    plain_text = _normalize_space(_strip_attachment_markers(plain_text))
    html_text = _strip_html(_strip_attachment_markers(data.html or ""))
    if extracted_text:
        # MIME parsing already extracted visible non-attachment text.
        html_text = ""
    merged_text = _normalize_space(f"{plain_text} {html_text}")

    if not subject and not merged_text:
        raise HTTPException(400, "No email content provided")

    if (not sender_email or not sender_name) and raw_text:
        from_match = re.search(r"^From:\s*(.+)$", raw_text, flags=re.I | re.M)
        if from_match:
            from_raw = _normalize_space(from_match.group(1))
            extracted = _extract_emails(from_raw)
            if extracted and not sender_email:
                sender_email = extracted[0].lower()
            if not sender_name:
                sender_name = _extract_email_name(from_raw, sender_email)
        if not subject:
            subject_match = re.search(r"^Subject:\s*(.+)$", raw_text, flags=re.I | re.M)
            if subject_match:
                subject = _normalize_space(subject_match.group(1))

    with SessionLocal() as db:
        customers = db.query(Customer).all()

    ai_draft = _generate_task_draft_from_email(subject, sender_name, sender_email, merged_text)
    ai_title = _fit_task_title(ai_draft.get("title") or subject or "Neue Aufgabe aus E-Mail")
    ai_details = _normalize_space(ai_draft.get("details") or merged_text[:1000])
    customer_hint = _normalize_space(ai_draft.get("customer_hint"))

    matched_customer, customer_candidates = _best_customer_match(
        customers=customers,
        sender_email=sender_email,
        sender_name=sender_name,
        subject=subject,
        content_text=merged_text,
        customer_hint=customer_hint,
    )
    if not matched_customer and customer_hint:
        hint_lower = customer_hint.lower()
        matched_customer = next(
            (
                customer
                for customer in customers
                if _normalize_space(customer.name).lower() == hint_lower
                or hint_lower in _normalize_space(customer.name).lower()
            ),
            None,
        )
        if matched_customer and _normalize_space(matched_customer.name) not in customer_candidates:
            customer_candidates.insert(0, _normalize_space(matched_customer.name))

    return {
        "title": ai_title,
        "details": ai_details,
        "customer": _normalize_space(matched_customer.name) if matched_customer else "",
        "customer_number": _normalize_space(matched_customer.creditor_number) if matched_customer else "",
        "customer_candidates": customer_candidates,
        "customer_hint": customer_hint,
        "subject": subject,
        "from_email": sender_email,
        "from_name": sender_name,
    }


@app.get("/api/delivery_notes")
def get_delivery_notes(customer_id: Optional[int] = None):
    with SessionLocal() as db:
        query = db.query(DeliveryNote)
        if customer_id:
            query = query.filter(DeliveryNote.customer_id == customer_id)
        notes = query.order_by(DeliveryNote.created_at.desc()).all()
        return [serialize_delivery_note(note) for note in notes]


@app.post("/api/delivery_notes")
def create_delivery_note(data: DeliveryNoteCreate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(data.customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        note = DeliveryNote(
            customer_id=data.customer_id,
            note=(data.note or "").strip(),
            signature_base64=(data.signature_base64 or "").strip(),
            time_from=(data.time_from or "").strip(),
            time_to=(data.time_to or "").strip(),
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        return serialize_delivery_note(note)


@app.delete("/api/delivery_notes/{note_id}")
def delete_delivery_note(note_id: int):
    with SessionLocal() as db:
        note = db.query(DeliveryNote).get(note_id)
        if not note:
            raise HTTPException(404, "Delivery note not found")
        db.delete(note)
        db.commit()
    return {"status": "ok"}


@app.get("/api/customers/{customer_id}/inventory_events")
def get_customer_inventory_events(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        rows = (
            db.query(CustomerInventoryEvent)
            .filter(CustomerInventoryEvent.customer_id == customer_id)
            .order_by(
                CustomerInventoryEvent.event_date.desc(),
                CustomerInventoryEvent.updated_at.desc(),
                CustomerInventoryEvent.created_at.desc(),
            )
            .all()
        )
        return [serialize_customer_inventory_event(item) for item in rows]


@app.post("/api/customers/{customer_id}/inventory_events")
def create_customer_inventory_event(customer_id: int, data: CustomerInventoryEventCreate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        now_ms = int(time.time() * 1000)
        event_type = str(data.event_type or "wartung").strip().lower() or "wartung"
        cancellation_date = _normalize_inventory_event_date(data.cancellation_date or data.event_date)
        event_date = _normalize_inventory_event_date(data.event_date or cancellation_date)
        if not cancellation_date and event_date:
            cancellation_date = event_date
        if not event_date and cancellation_date:
            event_date = cancellation_date
        is_recurring = bool(data.is_recurring)
        if event_type.startswith("contract_"):
            is_recurring = True
        tags = _normalize_tags(data.tags)
        cost_category = _normalize_recurring_cost_category(
            data.cost_category or event_type,
            fallback_text=" ".join(
                [
                    str(data.device_label or ""),
                    str(data.provider or ""),
                    str(event_type or ""),
                    str(data.note or ""),
                    " ".join(tags),
                ]
            ),
        )
        row = CustomerInventoryEvent(
            customer_id=customer_id,
            device_label=str(data.device_label or "").strip(),
            event_type=event_type,
            event_date=event_date,
            cancellation_date=cancellation_date,
            provider=str(data.provider or "").strip(),
            billing_cycle=_normalize_inventory_event_billing_cycle(data.billing_cycle),
            reminder_days=_normalize_inventory_event_reminder_days(data.reminder_days),
            is_external=bool(data.is_external),
            is_recurring=is_recurring,
            cost_category=cost_category,
            monthly_cost_eur=_safe_nonnegative_float(data.monthly_cost_eur or 0.0),
            tags_json=json.dumps(tags, ensure_ascii=False),
            note=str(data.note or "").strip(),
            created_at=now_ms,
            updated_at=now_ms,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_customer_inventory_event(row)


@app.patch("/api/customers/{customer_id}/inventory_events/{event_id}")
def update_customer_inventory_event(customer_id: int, event_id: int, data: CustomerInventoryEventUpdate):
    with SessionLocal() as db:
        row = (
            db.query(CustomerInventoryEvent)
            .filter(CustomerInventoryEvent.id == event_id, CustomerInventoryEvent.customer_id == customer_id)
            .first()
        )
        if not row:
            raise HTTPException(404, "Inventory event not found")
        updates = data.dict(exclude_unset=True)
        if "device_label" in updates:
            row.device_label = str(updates.get("device_label") or "").strip()
        if "event_type" in updates:
            row.event_type = str(updates.get("event_type") or "wartung").strip().lower() or "wartung"
            if row.event_type.startswith("contract_") and "is_recurring" not in updates:
                row.is_recurring = True
        if "event_date" in updates or "cancellation_date" in updates:
            raw_event_date = updates.get("event_date") if "event_date" in updates else updates.get("cancellation_date")
            raw_cancellation_date = updates.get("cancellation_date") if "cancellation_date" in updates else updates.get("event_date")
            event_date = _normalize_inventory_event_date(raw_event_date)
            cancellation_date = _normalize_inventory_event_date(raw_cancellation_date)
            if not cancellation_date and event_date:
                cancellation_date = event_date
            if not event_date and cancellation_date:
                event_date = cancellation_date
            row.event_date = event_date
            row.cancellation_date = cancellation_date
        if "provider" in updates:
            row.provider = str(updates.get("provider") or "").strip()
        if "billing_cycle" in updates:
            row.billing_cycle = _normalize_inventory_event_billing_cycle(updates.get("billing_cycle"))
        if "reminder_days" in updates:
            row.reminder_days = _normalize_inventory_event_reminder_days(updates.get("reminder_days"))
        if "is_external" in updates:
            row.is_external = bool(updates.get("is_external"))
        if "is_recurring" in updates:
            row.is_recurring = bool(updates.get("is_recurring"))
        if "cost_category" in updates or "tags" in updates or "device_label" in updates or "provider" in updates or "note" in updates:
            tags = _normalize_tags(
                updates.get("tags") if "tags" in updates else _parse_tags_json(getattr(row, "tags_json", "[]"))
            )
            if "tags" in updates:
                row.tags_json = json.dumps(tags, ensure_ascii=False)
            cost_category = updates.get("cost_category") if "cost_category" in updates else getattr(row, "cost_category", "")
            row.cost_category = _normalize_recurring_cost_category(
                cost_category or row.event_type,
                fallback_text=" ".join(
                    [
                        str(row.device_label or ""),
                        str(row.provider or ""),
                        str(row.event_type or ""),
                        str(updates.get("note") if "note" in updates else row.note or ""),
                        " ".join(tags),
                    ]
                ),
            )
        if "monthly_cost_eur" in updates:
            row.monthly_cost_eur = _safe_nonnegative_float(updates.get("monthly_cost_eur"))
        if "note" in updates:
            row.note = str(updates.get("note") or "").strip()
        row.updated_at = int(time.time() * 1000)
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_customer_inventory_event(row)


@app.delete("/api/customers/{customer_id}/inventory_events/{event_id}")
def delete_customer_inventory_event(customer_id: int, event_id: int):
    with SessionLocal() as db:
        row = (
            db.query(CustomerInventoryEvent)
            .filter(CustomerInventoryEvent.id == event_id, CustomerInventoryEvent.customer_id == customer_id)
            .first()
        )
        if not row:
            raise HTTPException(404, "Inventory event not found")
        db.delete(row)
        db.commit()
    return {"status": "ok"}


@app.get("/api/customers/{customer_id}/inventory_device_states")
def get_customer_inventory_device_states(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        rows = (
            db.query(CustomerInventoryDeviceState)
            .filter(CustomerInventoryDeviceState.customer_id == customer_id)
            .order_by(CustomerInventoryDeviceState.updated_at.desc(), CustomerInventoryDeviceState.id.desc())
            .all()
        )
        return [serialize_customer_inventory_device_state(item) for item in rows]


@app.put("/api/customers/{customer_id}/inventory_device_states")
def upsert_customer_inventory_device_state(customer_id: int, data: CustomerInventoryDeviceStateUpsert):
    source = str(data.source or "").strip().lower()
    device_key = str(data.device_key or "").strip()
    if not source or not device_key:
        raise HTTPException(400, "source and device_key are required")
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerInventoryDeviceState)
            .filter(
                CustomerInventoryDeviceState.customer_id == customer_id,
                CustomerInventoryDeviceState.source == source,
                CustomerInventoryDeviceState.device_key == device_key,
            )
            .first()
        )
        if not row:
            row = CustomerInventoryDeviceState(
                customer_id=customer_id,
                source=source,
                device_key=device_key,
            )
        row.device_label = str(data.device_label or "").strip()
        row.retired = bool(data.retired)
        row.note = str(data.note or "").strip()
        row.updated_at = int(time.time() * 1000)
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_customer_inventory_device_state(row)


@app.delete("/api/customers/{customer_id}/inventory_device_states/{state_id}")
def delete_customer_inventory_device_state(customer_id: int, state_id: int):
    with SessionLocal() as db:
        row = (
            db.query(CustomerInventoryDeviceState)
            .filter(CustomerInventoryDeviceState.id == state_id, CustomerInventoryDeviceState.customer_id == customer_id)
            .first()
        )
        if not row:
            raise HTTPException(404, "Inventory device state not found")
        db.delete(row)
        db.commit()
    return {"status": "ok"}


@app.get("/api/day_task_groups")
def get_day_task_groups():
    with SessionLocal() as db:
        groups = (
            db.query(DayTaskGroup)
            .order_by(DayTaskGroup.column.asc(), DayTaskGroup.position.asc(), DayTaskGroup.created_at.asc())
            .all()
        )
        return [serialize_day_task_group(g) for g in groups]


@app.get("/api/employees")
def get_employees():
    with SessionLocal() as db:
        employees = db.query(Employee).order_by(Employee.created_at.asc()).all()
        return [serialize_employee(employee) for employee in employees]


@app.post("/api/employees")
def create_employee(data: EmployeeCreate):
    with SessionLocal() as db:
        employee = Employee(
            name=data.name.strip(),
            short_code=(data.short_code or "").strip(),
            color=(data.color or "#111827").strip() or "#111827",
        )
        db.add(employee)
        db.commit()
        db.refresh(employee)
        return serialize_employee(employee)


@app.patch("/api/employees/{employee_id}")
def update_employee(employee_id: int, data: EmployeeUpdate):
    with SessionLocal() as db:
        employee = db.query(Employee).get(employee_id)
        if not employee:
            raise HTTPException(404, "employee not found")
        for field, value in data.dict(exclude_unset=True).items():
            if field == "color" and value:
                value = str(value).strip() or "#111827"
            setattr(employee, field, value)
        db.commit()
        return serialize_employee(employee)


@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int):
    with SessionLocal() as db:
        employee = db.query(Employee).get(employee_id)
        if not employee:
            raise HTTPException(404, "employee not found")
        db.query(DayTask).filter(DayTask.employee_id == employee_id).update(
            {DayTask.employee_id: None}
        )
        db.delete(employee)
        db.commit()
    return {"status": "ok"}


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
        kulant = bool(data.kulant)
        wartungsvertrag = bool(data.wartungsvertrag)
        urgency_flag = _normalize_urgency_flag(data.urgency_flag)
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
            aberechnet=bool(data.aberechnet) and not kulant and not wartungsvertrag,
            kulant=kulant,
            wartungsvertrag=wartungsvertrag,
            details=data.details or "",
            arrival_time=data.arrival_time or "",
            departure_time=data.departure_time or "",
            deadline=data.deadline or "",
            urgency_flag=urgency_flag,
            billing_note=data.billing_note or "",
            billing_min_hours=max(0.0, float(data.billing_min_hours or 0.0)),
            employee_id=data.employee_id,
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
            "urgency_flag",
            "billing_note",
        }
        payload = data.dict(exclude_unset=True)
        for field, value in payload.items():
            if value is None and field in string_fields:
                setattr(task, field, "")
            else:
                setattr(task, field, value)
        if "billing_min_hours" in payload:
            task.billing_min_hours = max(0.0, float(task.billing_min_hours or 0.0))
        if "urgency_flag" in payload:
            task.urgency_flag = _normalize_urgency_flag(task.urgency_flag)
        if data.erledigt is not None and data.status is None:
            task.status = "done" if data.erledigt else "todo"
        if data.status is not None or data.erledigt is not None:
            is_done = task.status == "done"
            task.erledigt = is_done
            task.completed_at = now_ms if is_done else 0
        if bool(task.kulant) or bool(task.wartungsvertrag):
            task.aberechnet = False
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


@app.post("/api/day_tasks/{task_id}/scope_estimate")
def estimate_day_task_scope(task_id: int, data: Optional[DayTaskScopeEstimateRequest] = None):
    with SessionLocal() as db:
        task = db.query(DayTask).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        now_ms = int(time.time() * 1000)
        elapsed_ms = int(task.elapsed or 0)
        if task.running and task.startTime:
            elapsed_ms = max(0, elapsed_ms + (now_ms - int(task.startTime or 0)))
        actual_hours = elapsed_ms / 3_600_000 if elapsed_ms > 0 else 0.0
        analysis_text = _normalize_space(
            (data.text if data and data.text is not None else None) or _build_task_position_text(task)
        )
        if not analysis_text:
            analysis_text = _normalize_space(task.title or task.details or "")
        try:
            return _estimate_task_scope(task, analysis_text, actual_hours)
        except Exception as exc:
            logger.warning("Task scope estimate failed unexpectedly for task=%s: %s", task_id, exc)
            fallback = _fallback_task_scope_estimate(task, analysis_text)
            return _finalize_task_scope_estimate(
                fallback,
                None,
                actual_hours=actual_hours,
                provider="fallback",
                model="",
                analysis_text=analysis_text or _build_task_position_text(task),
            )

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


# ================= PURCHASING =================
_PARCELSAPP_TRACKING_URL = "https://parcelsapp.com/api/v2/parcels"
_TRACKING_ERROR_LABELS = {
    "NO_TRACKER": "Kein passender Lieferdienst erkannt",
    "NO_DATA": "Noch keine Sendungsdaten vorhanden",
    "DOWN": "Tracking-Dienst derzeit nicht erreichbar",
    "BUSY": "Tracking-Dienst ist ausgelastet",
    "PARSER": "Tracking-Antwort konnte nicht gelesen werden",
    "CAPTCHA": "Automatischer Abruf vom Lieferdienst blockiert",
    "RELOAD": "Status aktuell nicht abrufbar (erneut versuchen)",
    "MAINTENANCE": "Tracking-Dienst in Wartung",
    "IP_BLOCKED": "Tracking-Dienst blockiert den Abruf",
    "INVALID_TRACKING_NUMBER": "Trackingnummer ungültig",
}


def _sanitize_tracking_number(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "")).upper()


def _resolve_tracking_provider(number: str) -> Tuple[str, str]:
    if re.fullmatch(r"1Z[0-9A-Z]{16}", number):
        return "UPS", "ups"
    if re.match(r"^(JJD|JVGL|00340434)", number):
        return "DHL", "dhl"
    if re.fullmatch(r"[A-Z]{2}\d{9}[A-Z]{2}", number):
        return "Post / UPU", ""
    if re.fullmatch(r"\d{12,22}", number):
        return "Automatisch", ""
    return "Unbekannt", ""


def _extract_tracking_provider(payload: Dict[str, Any], fallback_label: str) -> str:
    candidates: List[str] = []
    for key in ("carrier", "carrier_name", "carrierName", "provider", "provider_name", "providerName"):
        value = payload.get(key)
        text_value = str(value or "").strip()
        if text_value:
            candidates.append(text_value)

    trackers = payload.get("trackers")
    if isinstance(trackers, list):
        for entry in trackers[:3]:
            if not isinstance(entry, dict):
                continue
            for key in ("name", "title", "label", "carrier", "provider"):
                text_value = str(entry.get(key) or "").strip()
                if text_value:
                    candidates.append(text_value)

    tracker = payload.get("tracker")
    if isinstance(tracker, dict):
        for key in ("name", "title", "label", "carrier", "provider"):
            text_value = str(tracker.get(key) or "").strip()
            if text_value:
                candidates.append(text_value)

    for candidate in candidates:
        normalized = re.sub(r"\s+", " ", candidate).strip()
        if normalized:
            return normalized
    return fallback_label


def _parse_tracking_state_timestamp(value: Any) -> int:
    if isinstance(value, (int, float)) and float(value) > 0:
        numeric = float(value)
        if numeric > 10_000_000_000:
            return int(numeric)
        return int(numeric * 1000)
    text_value = str(value or "").strip()
    if not text_value:
        return 0
    try:
        if text_value.endswith("Z"):
            parsed = datetime.fromisoformat(text_value.replace("Z", "+00:00"))
        else:
            parsed = datetime.fromisoformat(text_value)
        return int(parsed.timestamp() * 1000)
    except ValueError:
        pass
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%d.%m.%Y %H:%M",
        "%d.%m.%Y %H:%M:%S",
        "%d.%m.%Y",
        "%Y-%m-%d",
    ):
        try:
            return int(datetime.strptime(text_value, fmt).timestamp() * 1000)
        except ValueError:
            continue
    return 0


def _extract_tracking_states(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    states = payload.get("states")
    normalized_states: List[Dict[str, Any]] = []
    if not isinstance(states, list):
        return normalized_states
    for index, raw_state in enumerate(states):
        latest = raw_state if isinstance(raw_state, dict) else {}
        text_value = ""
        for candidate in (
            latest.get("status"),
            latest.get("description"),
            latest.get("text"),
            latest.get("note"),
            latest.get("state"),
        ):
            text_candidate = str(candidate or "").strip()
            if text_candidate:
                text_value = text_candidate
                break
        normalized_states.append(
            {
                "index": index,
                "text": text_value,
                "location": str(
                    latest.get("location")
                    or latest.get("place")
                    or latest.get("city")
                    or latest.get("facility")
                    or ""
                ).strip(),
                "timestamp": _parse_tracking_state_timestamp(
                    latest.get("timestamp")
                    or latest.get("time")
                    or latest.get("datetime")
                    or latest.get("date")
                    or latest.get("created")
                ),
            }
        )
    return normalized_states


def _extract_latest_tracking_state(payload: Dict[str, Any]) -> Dict[str, Any]:
    states = _extract_tracking_states(payload)
    if states:
        ordered = sorted(
            states,
            key=lambda item: (int(item.get("timestamp") or 0), -int(item.get("index") or 0)),
            reverse=True,
        )
        for state in ordered:
            if str(state.get("text") or "").strip() or int(state.get("timestamp") or 0) > 0:
                return state
    return {
        "text": str(payload.get("final_status") or payload.get("status") or "").strip(),
        "location": "",
        "timestamp": _parse_tracking_state_timestamp(
            payload.get("updated_at") or payload.get("updatedAt") or payload.get("timestamp")
        ),
    }


def _normalize_tracking_delivery_stage(
    status_text: str,
    *,
    error_code: str = "",
    payload: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    if error_code == "NO_DATA":
        return "pending", "Noch keine Daten"
    if error_code:
        return "problem", "Problem"
    data = payload if isinstance(payload, dict) else {}
    delivered_flag = bool(
        data.get("delivered")
        or data.get("isDelivered")
        or data.get("delivery")
        or data.get("is_delivered")
    )
    text = str(status_text or "").strip().lower()
    if delivered_flag or any(token in text for token in ("zugestellt", "delivered", "ausgeliefert", "empfangen", "abholbereit")):
        return "delivered", "Zugestellt"
    if any(
        token in text
        for token in (
            "exception",
            "fehlgeschlagen",
            "problem",
            "retour",
            "returned",
            "unable",
            "verzög",
            "delay",
            "storniert",
            "cancelled",
            "beschädigt",
        )
    ):
        return "problem", "Problem"
    if any(
        token in text
        for token in (
            "unterwegs",
            "transit",
            "zustellung",
            "out for delivery",
            "shipment picked up",
            "in bearbeitung",
            "bearbeitet",
            "sortier",
            "processing",
            "verladen",
            "linehaul",
            "arrived",
            "departure",
        )
    ):
        return "transit", "Unterwegs"
    if any(
        token in text
        for token in (
            "label created",
            "pre-transit",
            "daten erhalten",
            "angekündigt",
            "electronic",
            "noch keine",
        )
    ):
        return "pending", "Angekündigt"
    return "info", "Info"


def _fetch_parcelsapp_tracking_payload(
    tracking_number: str,
    provider_slug: str,
) -> Dict[str, Any]:
    headers = {
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        ),
        "X-Requested-With": "XMLHttpRequest",
    }
    payload: Dict[str, Any] = {
        "trackingId": tracking_number,
        "carrier": "Auto-Detect",
        "language": "de",
        "country": "Germany",
        "platform": "web-desktop",
    }
    if provider_slug:
        payload["slug"] = provider_slug
    response = requests.post(
        _PARCELSAPP_TRACKING_URL,
        data=payload,
        headers=headers,
        timeout=12,
    )
    response.raise_for_status()
    parsed = response.json()
    if isinstance(parsed, dict):
        return parsed
    return {}


def _lookup_tracking_status(tracking_number: str, *, force_refresh: bool = False) -> Dict[str, Any]:
    now_ms = int(time.time() * 1000)
    if not force_refresh:
        with _tracking_status_cache_lock:
            cached = _tracking_status_cache.get(tracking_number)
            if cached and now_ms - int(cached.get("checkedAt") or 0) < TRACKING_STATUS_CACHE_TTL_MS:
                return cached

    provider_label, provider_slug = _resolve_tracking_provider(tracking_number)
    payload: Dict[str, Any] = {}
    status_kind = "unknown"
    status_text = ""
    error_code = ""
    source = "parcelsapp"
    latest_state: Dict[str, Any] = {"text": "", "location": "", "timestamp": 0}
    try:
        payload = _fetch_parcelsapp_tracking_payload(tracking_number, provider_slug)
        provider_label = _extract_tracking_provider(payload, provider_label)
        error_code = str(payload.get("error") or "").strip().upper()
        latest_state = _extract_latest_tracking_state(payload)
        status_text = str(latest_state.get("text") or "").strip()
        if error_code:
            status_kind = "error"
            if not status_text:
                status_text = _TRACKING_ERROR_LABELS.get(error_code, f"Tracking-Fehler: {error_code}")
        elif status_text:
            status_kind = "ok"
        else:
            status_text = "Status derzeit nicht verfügbar"
    except requests.RequestException as exc:
        status_kind = "error"
        status_text = "Tracking-Dienst nicht erreichbar"
        error_code = str(exc.__class__.__name__)
        source = "fallback"
    except ValueError:
        status_kind = "error"
        status_text = "Ungültige Tracking-Antwort"
        error_code = "INVALID_RESPONSE"
        source = "fallback"
    delivery_stage, delivery_label = _normalize_tracking_delivery_stage(
        status_text,
        error_code=error_code,
        payload=payload,
    )

    result = {
        "trackingNumber": tracking_number,
        "provider": provider_label,
        "status": status_kind,
        "statusText": status_text,
        "deliveryStage": delivery_stage,
        "deliveryLabel": delivery_label,
        "lastEventAt": int(latest_state.get("timestamp") or 0),
        "lastEventLocation": str(latest_state.get("location") or "").strip(),
        "errorCode": error_code,
        "checkedAt": now_ms,
        "source": source,
    }
    with _tracking_status_cache_lock:
        _tracking_status_cache[tracking_number] = result
    return result


@app.post("/api/purchasing_tracking_status")
def get_purchasing_tracking_status(data: PurchasingTrackingStatusLookup):
    normalized_numbers: List[str] = []
    seen: Set[str] = set()
    for raw_number in data.trackingNumbers or []:
        tracking_number = _sanitize_tracking_number(raw_number)
        if not tracking_number or tracking_number in seen:
            continue
        seen.add(tracking_number)
        normalized_numbers.append(tracking_number)
        if len(normalized_numbers) >= 100:
            break

    statuses = {
        number: _lookup_tracking_status(number, force_refresh=bool(data.force))
        for number in normalized_numbers
    }
    return {"statuses": statuses}


@app.get("/api/purchasing_items")
def get_purchasing_items():
    with SessionLocal() as db:
        items = (
            db.query(PurchasingItem)
            .order_by(PurchasingItem.created_at.desc(), PurchasingItem.id.desc())
            .all()
        )
        return [serialize_purchasing_item(item) for item in items]


@app.post("/api/purchasing_items")
def create_purchasing_item(data: PurchasingItemCreate):
    now_ms = int(time.time() * 1000)
    with SessionLocal() as db:
        status = str(data.status or "").strip().lower()
        if status not in {"open", "ordered", "received"}:
            status = "received" if bool(data.done) else "open"
        done = bool(data.done) or status == "received"
        item = PurchasingItem(
            done=done,
            status=status,
            customer=(data.customer or "").strip(),
            title=(data.title or "").strip(),
            source_url=(data.sourceUrl or "").strip(),
            quantity=(data.quantity or "").strip(),
            remark=(data.remark or "").strip(),
            tracking_number=(data.trackingNumber or "").strip(),
            purchase_price=(data.purchasePrice or "").strip(),
            sale_price=(data.salePrice or "").strip(),
            created_at=now_ms,
            updated_at=now_ms,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return serialize_purchasing_item(item)


@app.patch("/api/purchasing_items/{item_id}")
def update_purchasing_item(item_id: int, data: PurchasingItemUpdate):
    with SessionLocal() as db:
        item = db.query(PurchasingItem).get(item_id)
        if not item:
            raise HTTPException(404, "Purchasing item not found")
        payload = data.dict(exclude_unset=True)
        next_status = str(item.status or "").strip().lower()
        if next_status not in {"open", "ordered", "received"}:
            next_status = "received" if bool(item.done) else "open"
        if "done" in payload:
            done_value = bool(payload["done"])
            next_status = "received" if done_value else ("open" if next_status == "received" else next_status)
            item.done = done_value
        if "status" in payload:
            candidate = str(payload["status"] or "").strip().lower()
            if candidate in {"open", "ordered", "received"}:
                next_status = candidate
        if "customer" in payload:
            item.customer = str(payload["customer"] or "").strip()
        if "title" in payload:
            item.title = str(payload["title"] or "").strip()
        if "sourceUrl" in payload:
            item.source_url = str(payload["sourceUrl"] or "").strip()
        if "quantity" in payload:
            item.quantity = str(payload["quantity"] or "").strip()
        if "remark" in payload:
            item.remark = str(payload["remark"] or "").strip()
        if "trackingNumber" in payload:
            item.tracking_number = str(payload["trackingNumber"] or "").strip()
        if "purchasePrice" in payload:
            item.purchase_price = str(payload["purchasePrice"] or "").strip()
        if "salePrice" in payload:
            item.sale_price = str(payload["salePrice"] or "").strip()
        item.status = next_status
        item.done = next_status == "received"
        item.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(item)
        return serialize_purchasing_item(item)


@app.delete("/api/purchasing_items/{item_id}")
def delete_purchasing_item(item_id: int):
    with SessionLocal() as db:
        item = db.query(PurchasingItem).get(item_id)
        if not item:
            raise HTTPException(404, "Purchasing item not found")
        db.delete(item)
        db.commit()
        return {"status": "deleted"}


# ================= KNOWLEDGE BASE =================
@app.get("/api/knowledge_articles")
def get_knowledge_articles():
    with SessionLocal() as db:
        articles = (
            db.query(KnowledgeArticle)
            .order_by(KnowledgeArticle.pinned.desc(), KnowledgeArticle.updated_at.desc())
            .all()
        )
        return [serialize_knowledge_article(article) for article in articles]


@app.post("/api/knowledge_articles")
def create_knowledge_article(data: KnowledgeArticleCreate):
    now_ms = int(time.time() * 1000)
    with SessionLocal() as db:
        article = KnowledgeArticle(
            title=(data.title or "Neuer Artikel").strip() or "Neuer Artikel",
            category=(data.category or "").strip(),
            tags_json=json.dumps(_normalize_tags(data.tags), ensure_ascii=False),
            content=data.content or "",
            pinned=bool(data.pinned),
            created_at=now_ms,
            updated_at=now_ms,
        )
        db.add(article)
        db.commit()
        db.refresh(article)
        return serialize_knowledge_article(article)


@app.patch("/api/knowledge_articles/{article_id}")
def update_knowledge_article(article_id: int, data: KnowledgeArticleUpdate):
    with SessionLocal() as db:
        article = db.query(KnowledgeArticle).get(article_id)
        if not article:
            raise HTTPException(404, "Knowledge article not found")
        payload = data.dict(exclude_unset=True)
        if "title" in payload:
            article.title = str(payload["title"] or "").strip()
        if "category" in payload:
            article.category = str(payload["category"] or "").strip()
        if "tags" in payload:
            article.tags_json = json.dumps(_normalize_tags(payload.get("tags")), ensure_ascii=False)
        if "content" in payload:
            article.content = payload.get("content") or ""
        if "pinned" in payload:
            article.pinned = bool(payload.get("pinned"))
        article.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(article)
        return serialize_knowledge_article(article)


@app.delete("/api/knowledge_articles/{article_id}")
def delete_knowledge_article(article_id: int):
    with SessionLocal() as db:
        article = db.query(KnowledgeArticle).get(article_id)
        if not article:
            raise HTTPException(404, "Knowledge article not found")
        db.delete(article)
        db.commit()
        return {"status": "deleted"}

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

        incoming = data.dict(exclude_unset=True)
        rmm_fields_changed = any(
            field in incoming for field in ("rmm_host", "rmm_api_key", "rmm_api_key_header")
        )
        meta_hub_fields_changed = any(
            field in incoming
            for field in (
                "meta_hub_rmm_enabled",
                "meta_hub_rmm_customer_field_name",
                "meta_hub_email_enabled",
                "meta_hub_refresh_seconds",
                "meta_hub_mailboxes",
            )
        )
        sensitive_fields = {
            "rmm_password",
            "rmm_api_key",
            "pbx_password",
            "pbx_refresh_token",
            "pbx_api_key_secret",
            "td_synnex_client_secret",
            "also_sftp_password",
            "sevdesk_api_token",
            "icecat_api_token",
            "ai_api_key",
        }
        incoming_mailboxes = incoming.pop("meta_hub_mailboxes", None)
        for field, value in incoming.items():
            if field in sensitive_fields and value in (None, ""):
                continue
            if field == "meta_hub_refresh_seconds":
                safe_refresh = int(value or 300)
                safe_refresh = max(30, min(safe_refresh, 86400))
                setattr(settings, field, safe_refresh)
                continue
            if field == "ai_provider":
                setattr(settings, field, _normalize_ai_provider(value))
                continue
            if field == "ai_base_url":
                provider_value = incoming.get("ai_provider", settings.ai_provider)
                setattr(settings, field, _normalize_ai_base_url(value, _normalize_ai_provider(provider_value)))
                continue
            if field in {
                "ai_default_model",
                "ai_internal_model",
                "ai_action_model",
                "ai_task_model",
                "ai_customer_ranking_model",
                "ai_customer_development_model",
                "ai_offer_model",
                "ai_invoice_model",
            }:
                setattr(settings, field, str(value or "").strip())
                continue
            setattr(settings, field, value)
        if incoming_mailboxes is not None:
            merged_mailboxes = _merge_meta_hub_mailboxes(settings.meta_hub_mailboxes_json, incoming_mailboxes)
            settings.meta_hub_mailboxes_json = json.dumps(merged_mailboxes)
        # Tactical RMM is API-key based; legacy basic-auth fields are ignored.
        if "rmm_api_key" in incoming:
            settings.rmm_user = ""
            settings.rmm_password = ""

        db.commit()
        if rmm_fields_changed or meta_hub_fields_changed:
            _tactical_site_lookup_cache.clear()
            _tactical_software_endpoint_cache.clear()
            _customer_development_cache.clear()
            _customer_cve_cache.clear()
        return serialize_integration_settings(settings)


@app.post("/api/integrations/ai_models")
def probe_ai_connection_models(data: AiConnectionProbeRequest):
    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        config = _build_ai_config_from_request(data, settings)
    provider = str(config.get("provider") or AI_PROVIDER_OLLAMA)
    base_url = str(config.get("base_url") or "").strip()
    if not base_url:
        raise HTTPException(400, "Base URL fehlt")
    models = _list_available_ai_models(config=config, timeout_seconds=12)
    configured_models = _configured_ai_models_for_picker(config)
    default_model = str(config.get("default_model") or "").strip()
    if not models and configured_models:
        models = configured_models
    if not models:
        raise HTTPException(502, "Keine Modelle vom Provider abrufbar")
    resolved_default_model = default_model or (models[0] if models else "")
    return {
        "provider": provider,
        "base_url": base_url,
        "models": models,
        "default_model": resolved_default_model,
        "configured_models": configured_models,
        "detected_count": len(models),
    }


@app.get("/api/meta_hub/status")
def get_meta_hub_status(trigger_refresh: bool = False):
    now_ms = int(time.time() * 1000)
    meta_hub_url = str(CUSTOMER_META_HUB_URL or "").strip().rstrip("/")
    base_payload: Dict[str, Any] = {
        "enabled": bool(CUSTOMER_META_HUB_ENABLED),
        "configured": bool(meta_hub_url),
        "url": meta_hub_url,
        "connected": False,
        "checked_at": now_ms,
        "triggered_refresh": False,
        "error": "",
        "health": {},
        "snapshot": {},
    }
    if not CUSTOMER_META_HUB_ENABLED:
        base_payload["error"] = "Customer Meta-Hub ist deaktiviert"
        return base_payload
    if not meta_hub_url:
        base_payload["error"] = "Customer Meta-Hub URL ist nicht konfiguriert"
        return base_payload
    request_timeout = max(3, min(CUSTOMER_META_HUB_TIMEOUT_SECONDS, 12))
    try:
        if trigger_refresh:
            refresh_response = requests.post(
                f"{meta_hub_url}/refresh",
                json={"force": True, "background": True},
                timeout=request_timeout,
            )
            if refresh_response.ok:
                base_payload["triggered_refresh"] = True
            else:
                base_payload["error"] = f"Refresh trigger fehlgeschlagen ({refresh_response.status_code})"
        health_response = requests.get(
            f"{meta_hub_url}/health",
            timeout=request_timeout,
        )
        if not health_response.ok:
            base_payload["error"] = (
                base_payload["error"] or f"Health nicht erreichbar ({health_response.status_code})"
            )
            return base_payload
        health_payload = health_response.json()
        if not isinstance(health_payload, dict):
            base_payload["error"] = "Ungueltige Health-Antwort"
            return base_payload
        base_payload["health"] = {
            "refreshing": bool(health_payload.get("refreshing")),
            "refresh_interval_seconds": int(health_payload.get("refreshIntervalSeconds") or 0),
            "last_refresh_at": int(health_payload.get("lastRefreshAt") or 0),
            "last_duration_ms": int(health_payload.get("lastDurationMs") or 0),
            "last_error": str(health_payload.get("lastError") or ""),
            "email_sync_enabled": bool(health_payload.get("emailSyncEnabled")),
            "email_last_refresh_at": int(health_payload.get("emailLastRefreshAt") or 0),
            "email_last_duration_ms": int(health_payload.get("emailLastDurationMs") or 0),
            "email_last_error": str(health_payload.get("emailLastError") or ""),
            "email_message_count": int(health_payload.get("emailMessageCount") or 0),
            "email_matched_message_count": int(health_payload.get("emailMatchedMessageCount") or 0),
            "email_connected_mailboxes": int(health_payload.get("emailConnectedMailboxes") or 0),
            "ai_preanalysis_enabled": bool(health_payload.get("aiPreanalysisEnabled")),
            "ai_preanalysis_refreshing": bool(health_payload.get("aiPreanalysisRefreshing")),
            "ai_preanalysis_last_refresh_at": int(health_payload.get("aiPreanalysisLastRefreshAt") or 0),
            "ai_preanalysis_last_duration_ms": int(health_payload.get("aiPreanalysisLastDurationMs") or 0),
            "ai_preanalysis_last_error": str(health_payload.get("aiPreanalysisLastError") or ""),
            "ai_preanalysis_modes": list(health_payload.get("aiPreanalysisModes") or []),
        }
        base_payload["connected"] = True
        try:
            snapshot_response = requests.get(
                f"{meta_hub_url}/snapshot",
                params={"include_inactive": "1"},
                timeout=request_timeout,
            )
            if snapshot_response.ok:
                snapshot_payload = snapshot_response.json()
                if isinstance(snapshot_payload, dict):
                    snapshot_meta = snapshot_payload.get("metaHub") if isinstance(snapshot_payload.get("metaHub"), dict) else {}
                    base_payload["snapshot"] = {
                        "cached_at": int(snapshot_payload.get("cachedAt") or 0),
                        "generated_at": int(snapshot_payload.get("generatedAt") or 0),
                        "count": int(snapshot_payload.get("count") or 0),
                        "email_sync_generated_at": int(snapshot_meta.get("emailSyncGeneratedAt") or 0),
                        "email_message_count": int(snapshot_meta.get("emailMessageCount") or 0),
                        "email_matched_message_count": int(snapshot_meta.get("emailMatchedMessageCount") or 0),
                        "email_connected_mailboxes": int(snapshot_meta.get("emailConnectedMailboxes") or 0),
                        "email_access_mode": str(snapshot_meta.get("emailAccessMode") or ""),
                        "email_errors": list(snapshot_meta.get("emailErrors") or []),
                        "ai_preanalysis_generated_at": int(
                            snapshot_meta.get("aiPreanalysisGeneratedAt") or 0
                        ),
                        "ai_preanalysis_entries": int(snapshot_meta.get("aiPreanalysisEntries") or 0),
                        "ai_preanalysis_modes": list(snapshot_meta.get("aiPreanalysisModes") or []),
                    }
            elif not base_payload["error"]:
                base_payload["error"] = f"Snapshot nicht erreichbar ({snapshot_response.status_code})"
        except Exception as snapshot_exc:
            if not base_payload["error"]:
                base_payload["error"] = f"Snapshot-Status fehlgeschlagen: {snapshot_exc}"
        return base_payload
    except Exception as exc:
        base_payload["error"] = f"Meta-Hub Status fehlgeschlagen: {exc}"
        return base_payload


@app.post("/api/meta_hub/mailbox_test")
def test_meta_hub_mailbox(payload: MetaHubMailboxTestRequest):
    checked_at = int(time.time() * 1000)
    mailbox_input = payload.mailbox if isinstance(payload.mailbox, dict) else {}

    with SessionLocal() as db:
        settings = _get_settings(db)
        merged_mailboxes = _merge_meta_hub_mailboxes(settings.meta_hub_mailboxes_json, [mailbox_input])
    mailbox = merged_mailboxes[0] if merged_mailboxes else _normalize_meta_hub_mailbox(mailbox_input)

    mailbox_label = (
        str(mailbox.get("name") or mailbox.get("email") or mailbox.get("username") or mailbox.get("host") or "Postfach")
        .strip()
        or "Postfach"
    )
    try:
        connection = _connect_meta_hub_mailbox_read_only(mailbox)
        try:
            connection.logout()
        except Exception:
            pass
        return {
            "ok": True,
            "checked_at": checked_at,
            "message": f"{mailbox_label}: Verbindung und Ordnerzugriff erfolgreich.",
            "mailbox": {
                "id": str(mailbox.get("id") or "").strip(),
                "name": str(mailbox.get("name") or "").strip(),
                "email": str(mailbox.get("email") or "").strip(),
                "host": str(mailbox.get("host") or "").strip(),
                "port": int(mailbox.get("port") or 993),
                "folder": str(mailbox.get("folder") or "INBOX").strip() or "INBOX",
                "enabled": bool(mailbox.get("enabled", True)),
                "use_tls": bool(mailbox.get("use_tls", True)),
                "use_ssl": bool(mailbox.get("use_ssl", False)),
                "has_password": bool(str(mailbox.get("password") or "").strip()),
            },
        }
    except RuntimeError as exc:
        raise HTTPException(400, f"{mailbox_label}: {exc}") from exc
    except imaplib.IMAP4.error as exc:
        raise HTTPException(400, f"{mailbox_label}: {exc}") from exc
    except Exception as exc:
        raise HTTPException(502, f"{mailbox_label}: {exc}") from exc


@app.get("/api/integrations/icecat")
def get_icecat_settings():
    with SessionLocal() as db:
        settings = _get_settings(db)
        return {
            "api_token": settings.icecat_api_token,
            "has_api_token": bool(settings.icecat_api_token),
            "enabled": bool(settings.icecat_enabled),
        }


@app.get("/api/integrations/icecat/status")
def get_icecat_status():
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    try:
        response = requests.get(f"{base_url}/import/icecat/status", timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import error: {exc}") from exc
    return response.json()


def _meta_hub_internal_authorized(request: Request) -> bool:
    if not _meta_hub_bypass_requested(request):
        return False
    if not META_HUB_INTERNAL_TOKEN:
        return False
    incoming = str(request.headers.get(META_HUB_INTERNAL_TOKEN_HEADER) or "").strip()
    if not incoming:
        return False
    return hmac.compare_digest(incoming, META_HUB_INTERNAL_TOKEN)


@app.get("/api/internal/customer_development/rmm_snapshot")
def get_internal_customer_development_rmm_snapshot(request: Request):
    if not _meta_hub_internal_authorized(request):
        raise HTTPException(403, "Meta-Hub internal access denied")

    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
        meta_hub_mailboxes = _parse_meta_hub_mailboxes(settings.meta_hub_mailboxes_json)
        mailbox_summaries: List[Dict[str, Any]] = []
        for row in meta_hub_mailboxes:
            mailbox_summaries.append(
                {
                    "id": str(row.get("id") or "").strip(),
                    "name": str(row.get("name") or "").strip(),
                    "email": str(row.get("email") or "").strip(),
                    "host": str(row.get("host") or "").strip(),
                    "port": int(row.get("port") or 993),
                    "username": str(row.get("username") or "").strip(),
                    "password": str(row.get("password") or ""),
                    "folder": str(row.get("folder") or "INBOX").strip() or "INBOX",
                    "enabled": bool(row.get("enabled", True)),
                    "use_tls": bool(row.get("use_tls", True)),
                    "use_ssl": bool(row.get("use_ssl", False)),
                    "has_password": bool(str(row.get("password") or "").strip()),
                    "read_only": True,
                }
            )
        meta_hub_refresh_seconds = int(settings.meta_hub_refresh_seconds or 300)
        meta_hub_refresh_seconds = max(30, min(meta_hub_refresh_seconds, 86400))
        meta_hub_config = {
            "rmm_enabled": bool(settings.meta_hub_rmm_enabled),
            "rmm_customer_field_name": str(settings.meta_hub_rmm_customer_field_name or "Kundennummer").strip()
            or "Kundennummer",
            "email_enabled": bool(settings.meta_hub_email_enabled),
            "email_access_mode": "read_only",
            "refresh_seconds": meta_hub_refresh_seconds,
            "mailbox_count": len(mailbox_summaries),
            "mailboxes": mailbox_summaries,
        }

    probe = _probe_tactical_rmm(settings)
    session, host = _build_tactical_rmm_session(settings)
    if not session or not host:
        return {
            "connected": False,
            "checkedAt": probe.get("checkedAt") or datetime.now().isoformat(),
            "host": host,
            "agentsPath": probe.get("agentsPath") or "",
            "clientsPath": "",
            "customFieldsPath": "",
            "sampleCount": int(probe.get("sampleCount") or 0),
            "agents": [],
            "clients": [],
            "customFields": [],
            "error": probe.get("error") or "RMM session not available",
            "metaHubConfig": meta_hub_config,
        }

    client_path_candidates = [
        "/clients/?detail=true&limit=1000",
        "/clients/?detail=true",
        "/clients/?limit=1000",
        "/clients/",
        "/clients",
        "/sites/?detail=true&limit=1000",
        "/sites/?detail=true",
        "/sites/?limit=1000",
        "/sites/",
        "/sites",
        "/api/v3/clients/?detail=true&limit=1000",
        "/api/v3/clients/?detail=true",
        "/api/v3/clients/?limit=1000",
        "/api/v3/clients/",
        "/api/v3/clients",
        "/api/v3/sites/?detail=true&limit=1000",
        "/api/v3/sites/?detail=true",
        "/api/v3/sites/?limit=1000",
        "/api/v3/sites/",
        "/api/v3/sites",
    ]
    custom_fields_path_candidates = [
        "/core/customfields/?limit=1000",
        "/core/customfields/",
        "/core/customfields",
        "/api/v3/core/customfields/?limit=1000",
        "/api/v3/core/customfields/",
        "/api/v3/core/customfields",
    ]

    clients, clients_path = _tactical_fetch_rows(session, host, client_path_candidates, timeout=12, retries=1)
    custom_fields, custom_fields_path = _tactical_fetch_rows(
        session,
        host,
        custom_fields_path_candidates,
        timeout=12,
        retries=1,
    )
    agents = probe.get("agents") if isinstance(probe.get("agents"), list) else []
    discovery_payload_by_agent: Dict[str, Dict[str, Any]] = {}
    for agent in agents[:200]:
        if not isinstance(agent, dict):
            continue
        agent_id = _extract_agent_id(agent)
        if not agent_id:
            continue
        latest_payload = _fetch_latest_discovery_payload_from_agent_history(session, host, agent_id)
        if not isinstance(latest_payload, dict):
            continue
        payload = latest_payload.get("payload") if isinstance(latest_payload.get("payload"), dict) else {}
        items = payload.get("items") if isinstance(payload.get("items"), list) else []
        discovery_payload_by_agent[agent_id] = {
            "generated_at": int(_safe_nonnegative_int(latest_payload.get("generated_at") or 0)),
            "count": len([item for item in items if isinstance(item, dict)]),
            "payload": payload,
        }
    return {
        "connected": bool(probe.get("connected")),
        "checkedAt": probe.get("checkedAt") or datetime.now().isoformat(),
        "host": host,
        "agentsPath": probe.get("agentsPath") or "",
        "clientsPath": clients_path,
        "customFieldsPath": custom_fields_path,
        "sampleCount": int(probe.get("sampleCount") or 0),
        "agents": agents,
        "clients": clients,
        "customFields": custom_fields,
        "discoveryPayloadByAgent": discovery_payload_by_agent,
        "error": probe.get("error") or "",
        "metaHubConfig": meta_hub_config,
    }


@app.get("/api/rmm/health")
def rmm_health():
    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
    probe = _probe_tactical_rmm(settings)
    return {
        "connected": bool(probe.get("connected")),
        "checkedAt": probe.get("checkedAt") or "",
        "host": probe.get("host") or "",
        "hasUser": bool(probe.get("hasUser")),
        "hasPassword": bool(probe.get("hasPassword")),
        "hasApiKey": bool(probe.get("hasApiKey")),
        "apiKeyHeader": probe.get("apiKeyHeader") or "X-API-KEY",
        "authPath": probe.get("authPath"),
        "authStatusCode": probe.get("authStatusCode"),
        "agentsPath": probe.get("agentsPath"),
        "agentsStatusCode": probe.get("agentsStatusCode"),
        "sampleCount": int(probe.get("sampleCount") or 0),
        "error": probe.get("error") or "",
        "attemptedUrls": probe.get("attemptedUrls") if isinstance(probe.get("attemptedUrls"), list) else [],
    }


@app.get("/health")
def backend_health():
    return {"ok": True}


@app.get("/api/sevdesk/health")
def sevdesk_health():
    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
        config = _build_sevdesk_config(settings)

    if not config.api_token:
        return {"connected": False, "error": "Missing sevdesk_api_token"}

    client = SevdeskClient(config)
    try:
        payload = client.request("GET", "/Tools/bookkeepingSystemVersion")
    except SevdeskError as exc:
        return {"connected": False, "error": str(exc)}
    return {"connected": True, "payload": payload}


@app.post("/api/sevdesk/offers/{offer_id}/draft")
def sevdesk_offer_to_invoice(offer_id: int, payload: Optional[SevdeskOfferDraftRequest] = None):
    with SessionLocal() as db:
        offer = db.query(Offer).get(offer_id)
        if not offer:
            raise HTTPException(404, "Offer not found")
        if (offer.status or "").strip().lower() != "angenommen":
            raise HTTPException(400, "Offer not accepted")
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
        config = _require_sevdesk_config(settings)
        _require_sevdesk_invoice_fields(config)

        offer_payload: Dict[str, Any] = {}
        if offer.data_json:
            try:
                offer_payload = json.loads(offer.data_json)
            except json.JSONDecodeError as exc:
                raise HTTPException(400, f"Invalid offer payload: {exc}") from exc

        if payload:
            if payload.line_item_ids is not None:
                line_ids = set(payload.line_item_ids or [])
                offer_payload["lineItems"] = _filter_offer_items(
                    offer_payload.get("lineItems") or [], line_ids
                )
            if payload.device_item_ids is not None:
                device_ids = set(payload.device_item_ids or [])
                offer_payload["deviceItems"] = _filter_offer_items(
                    offer_payload.get("deviceItems") or [], device_ids
                )

        customer_number = _resolve_offer_customer_number(db, offer_payload)
        if not customer_number:
            raise HTTPException(400, "Offer missing customerNumber")

        client = SevdeskClient(config)
        try:
            contact, resolved_customer_number = _find_sevdesk_contact_by_customer_number(client, customer_number)
            if not contact:
                raise HTTPException(404, f"Sevdesk contact not found for {customer_number}")
            contact_id = int(contact.get("id"))
            positions = _offer_items_to_sevdesk_positions(offer_payload, config)
            if not positions:
                raise HTTPException(400, "Offer has no positions to export")
            if any((pos.get("unity_id") or 0) <= 0 for pos in positions):
                raise HTTPException(400, "Sevdesk unity id missing for offer positions")

            draft = client.find_draft_invoice(contact_id)
            if draft:
                invoice_id = int(draft.get("id"))
                invoice_snapshot = client.get_invoice(invoice_id) or draft
                header = _build_sevdesk_draft_header(client, config, invoice_snapshot, draft)
                invoice_payload = client.build_invoice_payload(
                    contact_id, invoice_id=invoice_id, invoice_snapshot=invoice_snapshot, header=header
                )
            else:
                header = _build_sevdesk_draft_header(client, config)
                invoice_payload = client.build_invoice_payload(contact_id, header=header)
            response = client.save_invoice(invoice_payload, client.build_positions(positions))
        except SevdeskError as exc:
            raise HTTPException(502, str(exc)) from exc

        return {"ok": True, "invoice": response}


@app.post("/api/sevdesk/tasks/{task_id}/draft")
def sevdesk_task_to_invoice(task_id: int, payload: SevdeskTaskDraftRequest):
    with SessionLocal() as db:
        task = db.query(DayTask).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")
        if bool(task.kulant) or bool(task.wartungsvertrag):
            raise HTTPException(400, "Task is marked as Kulant/Wartungsvertrag and cannot be invoiced")
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
        metrics = db.query(CustomerMetricsSettings).first()
        config = _require_sevdesk_config(settings, metrics)
        _require_sevdesk_invoice_fields(config)

        customer_number = (payload.customer_number or task.customer_number or "").strip()
        if not customer_number:
            customer_number = _resolve_local_customer_number_by_name(db, task.customer)
        if not customer_number:
            raise HTTPException(400, "Missing customer_number")

        now_ms = int(time.time() * 1000)
        elapsed_ms = int(task.elapsed or 0)
        if task.running and task.startTime:
            elapsed_ms = max(0, elapsed_ms + (now_ms - int(task.startTime)))
        elapsed_hours = elapsed_ms / 3_600_000 if elapsed_ms > 0 else 0.0
        quantity = payload.quantity if payload.quantity is not None else elapsed_hours
        quantity = _round_up_to_quarter_hours(float(quantity))
        if quantity <= 0:
            quantity = 1.0

        price = payload.price if payload.price is not None else (config.hourly_rate_eur or 0.0)
        tax_rate = payload.tax_rate if payload.tax_rate is not None else config.default_tax_rate
        unity_id = config.service_unity_id or config.unity_id
        if payload.unity_id:
            unity_id = payload.unity_id
            if config.service_unity_id and payload.unity_id == config.unity_id:
                unity_id = config.service_unity_id
        if not unity_id:
            raise HTTPException(400, "Missing unity_id")

        name = "Arbeitszeit"
        text = _build_task_position_text(task)
        header = None

        client = SevdeskClient(config)
        try:
            contact, resolved_customer_number = _find_sevdesk_contact_by_customer_number(client, customer_number)
            if not contact and task.customer:
                fallback_number = _resolve_local_customer_number_by_name(db, task.customer)
                if fallback_number and fallback_number != customer_number:
                    customer_number = fallback_number
                    contact, resolved_customer_number = _find_sevdesk_contact_by_customer_number(
                        client, customer_number
                    )
            if not contact:
                raise HTTPException(404, f"Sevdesk contact not found for {customer_number}")
            contact_id = int(contact.get("id"))
            if resolved_customer_number:
                task.customer_number = resolved_customer_number

            positions = [
                {
                    "quantity": quantity,
                    "price": price,
                    "name": name,
                    "text": text,
                    "tax_rate": tax_rate,
                    "unity_id": unity_id,
                }
            ]
            if payload.add_mileage:
                mileage_price = _parse_float(payload.mileage_price, default=0.0)
                mileage_name = (payload.mileage_name or "Anfahrt").strip() or "Anfahrt"
                mileage_text = (payload.mileage_text or "").strip()
                base_unity_id = config.unity_id or unity_id
                if mileage_price > 0 and base_unity_id:
                    positions.append(
                        {
                            "quantity": 1,
                            "price": mileage_price,
                            "name": mileage_name,
                            "text": mileage_text,
                            "tax_rate": tax_rate,
                            "unity_id": base_unity_id,
                        }
                    )

            draft = None
            if payload.use_existing_draft is not False:
                draft = client.find_draft_invoice(contact_id)
            if draft:
                invoice_id = int(draft.get("id"))
                invoice_snapshot = client.get_invoice(invoice_id) or draft
                header = _build_sevdesk_draft_header(client, config, invoice_snapshot, draft)
                invoice_payload = client.build_invoice_payload(
                    contact_id, invoice_id=invoice_id, invoice_snapshot=invoice_snapshot, header=header
                )
            else:
                header = _build_sevdesk_draft_header(client, config)
                invoice_payload = client.build_invoice_payload(contact_id, header=header)
            response = client.save_invoice(invoice_payload, client.build_positions(positions))
        except SevdeskError as exc:
            raise HTTPException(502, str(exc)) from exc

        if payload.mark_billed is not False:
            task.aberechnet = True
            task.status = "done"
            task.erledigt = True
            task.completed_at = now_ms
        db.commit()
        db.refresh(task)

        return {"ok": True, "task": serialize_day_task(task), "invoice": response}


@app.get("/api/sevdesk/drafts/check")
def sevdesk_check_draft(customer_number: str):
    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
        config = _require_sevdesk_config(settings)
        _require_sevdesk_invoice_fields(config)

    customer_number = (customer_number or "").strip()
    if not customer_number:
        raise HTTPException(400, "Missing customer_number")

    client = SevdeskClient(config)
    try:
        contact, _ = _find_sevdesk_contact_by_customer_number(client, customer_number)
        if not contact:
            return {"contact_found": False, "has_draft": False, "draft_id": None}
        contact_id = int(contact.get("id"))
        draft = client.find_draft_invoice(contact_id)
    except SevdeskError as exc:
        raise HTTPException(502, str(exc)) from exc

    return {
        "contact_found": True,
        "has_draft": bool(draft),
        "draft_id": int(draft.get("id")) if draft else None,
    }


@app.post("/api/sevdesk/tasks/sync")
def sevdesk_tasks_sync(payload: SevdeskTaskSyncRequest):
    with SessionLocal() as db:
        settings = db.query(IntegrationSettings).first()
        if not settings:
            settings = IntegrationSettings()
            db.add(settings)
            db.commit()
        metrics = db.query(CustomerMetricsSettings).first()
        config = _require_sevdesk_config(settings, metrics)
        _require_sevdesk_invoice_fields(config)

        query = (
            db.query(DayTask)
            .filter(DayTask.erledigt.is_(True))
            .filter(DayTask.kulant.is_(False))
            .filter(DayTask.wartungsvertrag.is_(False))
        )
        if payload.task_ids:
            query = query.filter(DayTask.id.in_(payload.task_ids))
        else:
            query = query.filter(DayTask.aberechnet.is_(False))
        if payload.customer_number:
            query = query.filter(DayTask.customer_number == payload.customer_number)
        tasks = query.order_by(DayTask.customer_number.asc()).all()

        if not tasks:
            return {"ok": True, "message": "No tasks to sync", "synced": []}

        client = SevdeskClient(config)
        results = []
        tasks_by_customer: Dict[str, List[DayTask]] = {}
        for task in tasks:
            customer_number = (task.customer_number or "").strip()
            if not customer_number:
                continue
            tasks_by_customer.setdefault(customer_number, []).append(task)

        for customer_number, customer_tasks in tasks_by_customer.items():
            try:
                contact = client.get_contact_by_customer_number(customer_number)
                if not contact:
                    results.append(
                        {"customer_number": customer_number, "ok": False, "error": "Contact not found"}
                    )
                    continue
                contact_id = int(contact.get("id"))
                total_ms = sum(task.elapsed or 0 for task in customer_tasks)
                total_hours = round(total_ms / 3_600_000, 2)
                if total_hours <= 0:
                    total_hours = float(len(customer_tasks))

                unity_id = config.service_unity_id or config.unity_id
                if not unity_id:
                    results.append(
                        {"customer_number": customer_number, "ok": False, "error": "Missing unity id"}
                    )
                    continue

                text = _summarize_tasks_for_invoice(customer_tasks)
                positions = [
                    {
                        "quantity": total_hours,
                        "price": config.hourly_rate_eur or 0.0,
                        "name": "Erledigte Aufgaben",
                        "text": text,
                        "tax_rate": config.default_tax_rate,
                        "unity_id": unity_id,
                    }
                ]

                draft = client.find_draft_invoice(contact_id)
                if draft:
                    invoice_id = int(draft.get("id"))
                    invoice_snapshot = client.get_invoice(invoice_id) or draft
                    invoice_payload = client.build_invoice_payload(
                        contact_id, invoice_id=invoice_id, invoice_snapshot=invoice_snapshot
                    )
                else:
                    invoice_payload = client.build_invoice_payload(
                        contact_id, header="Leistungsnachweis"
                    )
                response = client.save_invoice(invoice_payload, client.build_positions(positions))

                for task in customer_tasks:
                    task.aberechnet = True
                db.commit()
                results.append({"customer_number": customer_number, "ok": True, "invoice": response})
            except SevdeskError as exc:
                results.append({"customer_number": customer_number, "ok": False, "error": str(exc)})

        return {"ok": True, "synced": results}


@app.get("/api/marketplace/sources")
def marketplace_sources():
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    try:
        response = requests.get(f"{base_url}/import/sources", timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import error: {exc}") from exc
    return response.json()


@app.get("/api/marketplace/search")
def marketplace_search(
    source: str,
    query: str,
    sku: Optional[str] = None,
    manufacturer_sku: Optional[str] = None,
):
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    params = {"source": source, "query": query}
    if sku:
        params["sku"] = sku
    if manufacturer_sku:
        params["manufacturer_sku"] = manufacturer_sku
    try:
        response = requests.get(f"{base_url}/import/search", params=params, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import error: {exc}") from exc
    return response.json()


@app.get("/api/marketplace/item/{sku}")
def marketplace_item(sku: str, source: str):
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    try:
        response = requests.get(
            f"{base_url}/import/item/{quote(sku)}",
            params={"source": source},
            timeout=30,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import error: {exc}") from exc
    return response.json()


@app.get("/api/marketplace/alternative/icecat")
def marketplace_icecat_alternative(
    ean: Optional[str] = None,
    brand: Optional[str] = None,
    mpn: Optional[str] = None,
    manufacturer: Optional[str] = None,
    manufacturer_sku: Optional[str] = None,
):
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    params: Dict[str, str] = {}
    if ean:
        params["ean"] = ean
    if brand:
        params["brand"] = brand
    if mpn:
        params["mpn"] = mpn
    if manufacturer:
        params["manufacturer"] = manufacturer
    if manufacturer_sku:
        params["manufacturer_sku"] = manufacturer_sku
    try:
        response = requests.get(
            f"{base_url}/import/alternative/icecat", params=params, timeout=30
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import error: {exc}") from exc
    return response.json()


@app.get("/api/marketplace/debug/{source}")
def marketplace_debug(source: str):
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    try:
        response = requests.get(f"{base_url}/import/sources", timeout=20)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import error: {exc}") from exc
    sources = payload if isinstance(payload, list) else []
    entry = next((item for item in sources if item.get("source") == source), None)
    if not entry:
        return {"source": source, "available": False, "error": "source not returned"}
    return {"source": entry.get("source"), "available": bool(entry.get("available")), "error": ""}


@app.post("/api/marketplace/sync/also")
def marketplace_sync_also():
    with SessionLocal() as db:
        settings = _get_settings(db)
        base_url = _get_marketplace_import_url(db)
        filename = (settings.also_sftp_filename or "").strip()
        if not filename or filename.lower() == "stock.txt":
            filename = "pricelist-1.txt.zip"
        payload = {
            "host": settings.also_sftp_host,
            "port": settings.also_sftp_port,
            "user": settings.also_sftp_user,
            "password": settings.also_sftp_password,
            "dir": settings.also_sftp_dir,
            "filename": filename,
        }
    try:
        response = requests.post(f"{base_url}/import/also/config", json=payload, timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import sync error: {exc}") from exc
    return {"status": "ok"}


@app.post("/api/marketplace/also/run")
def marketplace_run_also():
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    try:
        response = requests.post(f"{base_url}/import/also/run", timeout=120)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import run error: {exc}") from exc
    return response.json()


@app.get("/api/marketplace/also/status")
def marketplace_also_status():
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    try:
        response = requests.get(f"{base_url}/import/also/status", timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import status error: {exc}") from exc
    return response.json()


@app.post("/api/marketplace/also/clear")
def marketplace_also_clear():
    with SessionLocal() as db:
        base_url = _get_marketplace_import_url(db)
    try:
        response = requests.post(f"{base_url}/import/also/clear", timeout=20)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(502, f"Marketplace import clear error: {exc}") from exc
    return response.json()

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
    path = _nfon_phonebook_path(customer_account, query=query_string)
    payload = _nfon_request("GET", base_url, api_key_id, api_key_secret, path)
    return _extract_phonebook_entries(payload)


@app.post("/api/pbx_phonebook/remote")
def create_remote_pbx_phonebook(data: PbxPhonebookCreate):
    with SessionLocal() as db:
        base_url, api_key_id, api_key_secret, customer_account = _get_pbx_credentials(db)
    body = _nfon_phonebook_body(data.name, data.number, is_global=True)
    path = _nfon_phonebook_path(customer_account)
    payload = _nfon_request("POST", base_url, api_key_id, api_key_secret, path, body_obj=body)
    entries = _extract_phonebook_entries(payload)
    if entries:
        return entries[0]
    return {"name": data.name or "", "number": data.number or ""}

@app.patch("/api/pbx_phonebook/remote/{entry_id}")
def update_remote_pbx_phonebook(entry_id: str, data: PbxPhonebookUpdate):
    with SessionLocal() as db:
        base_url, api_key_id, api_key_secret, customer_account = _get_pbx_credentials(db)
    body = _nfon_phonebook_body(data.name, data.number, is_global=True)
    path = _nfon_phonebook_path(customer_account, entry_id=entry_id)
    try:
        payload = _nfon_request("PUT", base_url, api_key_id, api_key_secret, path, body_obj=body)
    except HTTPException as exc:
        if exc.status_code in {404, 405}:
            payload = _nfon_request("PATCH", base_url, api_key_id, api_key_secret, path, body_obj=body)
        else:
            raise
    entries = _extract_phonebook_entries(payload)
    if entries:
        entry = entries[0]
        if not entry.get("id"):
            entry["id"] = entry_id
        return entry
    normalized = _normalize_phonebook_entry(payload if isinstance(payload, dict) else {})
    if normalized:
        if not normalized.get("id"):
            normalized["id"] = entry_id
        return normalized
    return {"id": entry_id, "name": data.name or "", "number": data.number or ""}

@app.delete("/api/pbx_phonebook/remote/{entry_id}")
def delete_remote_pbx_phonebook(entry_id: str):
    with SessionLocal() as db:
        base_url, api_key_id, api_key_secret, customer_account = _get_pbx_credentials(db)
    path = _nfon_phonebook_path(customer_account, entry_id=entry_id)
    _nfon_request("DELETE", base_url, api_key_id, api_key_secret, path)
    return {"status": "deleted"}


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
                "request_path": "",
                "request_url": "",
            }
    path = f"/api/customers/{customer_account}/phone-books?_pagesize=1"
    request_url = f"{base_url}{path}"
    try:
        date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
        string_to_sign = _build_nfon_string_to_sign("GET", date, path)
        signature = hmac.new(api_key_secret.encode("utf-8"), string_to_sign.encode("utf-8"), hashlib.sha1)
        signature_b64 = base64.b64encode(signature.digest()).decode("utf-8")
        headers = {
            "Authorization": f"NFON-API {api_key_id}:{signature_b64}",
            "x-nfon-date": date,
        }
        response = requests.request("GET", request_url, headers=headers, timeout=20)
        text = response.text or ""
        entries = []
        try:
            entries = _extract_phonebook_entries(response.json())
        except ValueError:
            entries = []
        version_path = "/api/version"
        version_url = f"{base_url}{version_path}"
        version_status_code = None
        version_ok = False
        version_error = ""
        version_preview = ""
        try:
            version_date = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
            version_string_to_sign = _build_nfon_string_to_sign("GET", version_date, version_path)
            version_signature = hmac.new(
                api_key_secret.encode("utf-8"),
                version_string_to_sign.encode("utf-8"),
                hashlib.sha1,
            )
            version_signature_b64 = base64.b64encode(version_signature.digest()).decode("utf-8")
            version_headers = {
                "Authorization": f"NFON-API {api_key_id}:{version_signature_b64}",
                "x-nfon-date": version_date,
            }
            version_response = requests.request("GET", version_url, headers=version_headers, timeout=20)
            version_status_code = version_response.status_code
            version_ok = version_response.ok
            version_preview = (version_response.text or "")[:300]
            if not version_response.ok:
                version_error = version_preview
        except Exception as exc:
            version_error = str(exc)
        return {
            "ok": response.ok,
            "status_code": response.status_code,
            "error": "" if response.ok else text[:300],
            "entry_count": len(entries),
            "base_url": base_url,
            "customer_account": customer_account,
            "response_preview": text[:300],
            "request_path": path,
            "request_url": request_url,
            "version_status_code": version_status_code,
            "version_ok": version_ok,
            "version_error": version_error,
            "version_preview": version_preview,
        }
    except Exception as exc:
        return {
            "ok": False,
            "status_code": None,
            "error": str(exc),
            "entry_count": 0,
            "base_url": base_url,
            "customer_account": customer_account,
            "response_preview": "",
            "request_path": path,
            "request_url": request_url,
            "version_status_code": None,
            "version_ok": False,
            "version_error": "",
            "version_preview": "",
        }

# ============== AI =================
@app.post("/api/ai_action")
def generate_action(data: ActionAiRequest):
    text = (data.text or "").strip()
    if not text:
        raise HTTPException(400, "Text required")

    with SessionLocal() as db:
        prompts = serialize_ai_prompts(_get_ai_prompt_settings(db))
    prompt = _render_prompt(prompts["action_prompt"], {"text": text})
    if "{text}" not in prompts["action_prompt"] and "Text:" not in prompt:
        prompt = f"{prompt}\n\nText: {text}"

    model_candidates = _resolve_ai_models(
        MODEL_PREF_ACTION,
        MODEL_PREF_TASK_DRAFT,
        purpose="action",
    )
    payload, _, _ = _ai_generate(
        prompt,
        model_candidates=model_candidates,
        response_format="json",
        temperature=0.2,
        max_tokens=180,
        timeout=INTERNAL_AI_TOOL_TIMEOUT_SECONDS,
    )
    if not payload:
        logger.warning("AI action fallback used due to provider failure")
        return _build_action_ai_fallback(text)

    action = parse_action_json(payload.get("response"))
    if not action:
        logger.warning("AI action fallback used due to invalid AI response")
        return _build_action_ai_fallback(text)
    return action


def _build_internal_ai_prompt(prompt_text: str, content_text: str) -> str:
    prompt_value = str(prompt_text or "").strip()
    content_value = str(content_text or "").strip()
    if not content_value:
        return prompt_value
    return (
        f"{prompt_value}\n\n"
        "Arbeitsmaterial:\n"
        "<<<BEGINN>>>\n"
        f"{content_value}\n"
        "<<<ENDE>>>"
    )


def _build_internal_ai_fallback_text(prompt_text: str, content_text: str) -> str:
    prompt_value = " ".join(str(prompt_text or "").split()).strip()
    content_value = str(content_text or "").strip()
    content_preview = content_value[:2400].strip()
    parts = [
        "Interne KI derzeit nicht verfuegbar.",
        f"Arbeitsauftrag: {prompt_value or 'ohne Prompt'}",
        "Bitte Prompt kuerzen, spaeter erneut versuchen oder ein kleineres Modell waehlen.",
    ]
    if content_preview:
        parts.extend(
            [
                "",
                "Arbeitsmaterial Vorschau:",
                content_preview,
            ]
        )
    return "\n".join(parts).strip()


def _build_offer_ai_fallback_text(mode: str, current_text: str, context: str) -> str:
    current_value = " ".join(str(current_text or "").split()).strip()
    context_value = " ".join(str(context or "").split()).strip()
    source_text = current_value or context_value
    if not source_text:
        return "Textentwurf aktuell nicht verfuegbar."
    if mode == "position_text":
        return source_text[:280].rstrip(" ,;:-") + "."
    if mode == "invoice_position_text":
        return _sanitize_invoice_position_ai_text(source_text[:280]) or "Leistung gemaess Vorgang umgesetzt."
    if mode == "cover_intro":
        return f"Im Folgenden erhalten Sie das passende Angebot zu den abgestimmten Leistungen. {source_text[:180].rstrip(' ,;:-')}."
    if mode == "overview":
        return source_text[:360].rstrip(" ,;:-") + "."
    return source_text[:420].rstrip(" ,;:-") + "."


def _build_action_ai_fallback(text: str) -> Dict[str, str]:
    source = " ".join(str(text or "").split()).strip()
    lower = source.lower()
    system = "Allgemein"
    if any(term in lower for term in ["backup", "veeam", "sicherung"]):
        system = "Backup"
    elif any(term in lower for term in ["firewall", "vpn", "fortigate", "sophos"]):
        system = "Firewall"
    elif any(term in lower for term in ["switch", "wlan", "netz", "router"]):
        system = "Netzwerk"
    elif any(term in lower for term in ["server", "hyper-v", "vmware", "esxi"]):
        system = "Server"
    elif any(term in lower for term in ["client", "pc", "notebook", "arbeitsplatz"]):
        system = "Client"
    impact = "Keine Unterbrechung"
    if any(term in lower for term in ["update", "patch", "upgrade", "reboot", "neustart"]):
        impact = "Wartungsfenster"
    elif any(term in lower for term in ["pruefung", "check", "analyse", "kontrolle"]):
        impact = "Keine Unterbrechung"
    priority = "Planbar"
    if any(term in lower for term in ["kritisch", "sofort", "dringend", "sicherheitsluecke", "sicherheitslücke"]):
        priority = "Dringend"
    title = source[:72].rstrip(" ,;:-") or "Neue Massnahme"
    return {
        "title": title,
        "system": system,
        "why_text": source[:220].rstrip(" ,;:-") or "Massnahme aus Freitext abgeleitet.",
        "impact": impact,
        "duration": "0,5-1,0 h" if impact == "Wartungsfenster" else "0,5 h",
        "cost": "60-120 €" if impact == "Wartungsfenster" else "60-60 €",
        "priority": priority,
    }


@app.get("/api/tools/internal_ai_models")
def tools_internal_ai_models():
    config = _get_ai_config_snapshot()
    available_models = _list_available_ai_models(config=config)
    preferred_models = _resolve_ai_models(
        MODEL_PREF_INTERNAL_AI,
        MODEL_PREF_ACTION,
        MODEL_PREF_TASK_DRAFT,
        purpose="internal_ai",
        config=config,
    )
    default_model = ""
    available_lookup = {model.lower(): model for model in available_models}
    for candidate in preferred_models:
        matched_model = available_lookup.get(candidate.lower())
        if matched_model:
            default_model = matched_model
            break
    if not default_model:
        default_model = preferred_models[0] if preferred_models else ""
    return {
        "models": available_models,
        "default_model": default_model,
        "provider": config.get("provider") or AI_PROVIDER_OLLAMA,
        "prompt_limit_chars": _internal_ai_prompt_limit_chars(),
        "prompt_limit_scope": "server",
    }


@app.post("/api/tools/internal_ai_prompt")
def tools_internal_ai_prompt(data: InternalAiPromptRequest):
    prompt_text = str(data.prompt or "").strip()
    content_text = str(data.content or "").strip()
    if not prompt_text:
        raise HTTPException(400, "prompt required")
    internal_prompt = _build_internal_ai_prompt(prompt_text, content_text)

    model_candidates = _resolve_internal_ai_tool_models(data.model)
    payload, used_model, provider = _ai_generate(
        internal_prompt,
        model_candidates=model_candidates,
        temperature=0.2,
        max_tokens=int(INTERNAL_AI_TOOL_MAX_TOKENS),
        timeout=min(int(INTERNAL_AI_TOOL_TIMEOUT_SECONDS), max(10, int(OLLAMA_TIMEOUT_SECONDS))),
        use_cache=False,
        raw=True,
    )
    response_text = str(payload.get("response") or "").strip()
    if not response_text:
        return {
            "text": _build_internal_ai_fallback_text(prompt_text, content_text),
            "provider": "fallback",
            "model": used_model or "",
            "generated_at": int(time.time() * 1000),
        }
    return {
        "text": response_text,
        "provider": provider,
        "model": used_model or "",
        "generated_at": int(time.time() * 1000),
    }


@app.post("/api/tools/internal_ai_prompt_stream")
def tools_internal_ai_prompt_stream(data: InternalAiPromptRequest):
    prompt_text = str(data.prompt or "").strip()
    content_text = str(data.content or "").strip()
    if not prompt_text:
        raise HTTPException(400, "prompt required")

    internal_prompt = _build_internal_ai_prompt(prompt_text, content_text)
    model_candidates = _resolve_internal_ai_tool_models(data.model)
    config = _get_ai_config_snapshot()
    connect_timeout = max(1, int(OLLAMA_CONNECT_TIMEOUT_SECONDS or 1))
    request_timeout = min(
        int(INTERNAL_AI_STREAM_TIMEOUT_SECONDS),
        max(int(INTERNAL_AI_TOOL_TIMEOUT_SECONDS), 12),
        max(int(OLLAMA_TIMEOUT_SECONDS or 0), 12),
    )
    if request_timeout < 12:
        request_timeout = 12
    fallback_text = _build_internal_ai_fallback_text(prompt_text, content_text)

    def stream() -> Any:
        yield json.dumps({
            "type": "status",
            "stage": "connecting",
            "detail": "Verbinde mit interner KI",
        }) + "\n"
        if str(config.get("provider") or AI_PROVIDER_OLLAMA) != AI_PROVIDER_OLLAMA:
            payload, used_model, provider = _ai_generate(
                internal_prompt,
                model_candidates=model_candidates,
                temperature=0.2,
                max_tokens=int(INTERNAL_AI_TOOL_MAX_TOKENS),
                timeout=request_timeout,
                use_cache=False,
                raw=True,
                config=config,
            )
            response_text = str(payload.get("response") or "").strip()
            if not response_text:
                yield json.dumps({
                    "type": "meta",
                    "provider": "fallback",
                    "model": used_model or "",
                }) + "\n"
                yield json.dumps({"type": "delta", "text": fallback_text}) + "\n"
                yield json.dumps({
                    "type": "done",
                    "provider": "fallback",
                    "model": used_model or "",
                    "generated_at": int(time.time() * 1000),
                }) + "\n"
                return
            yield json.dumps({
                "type": "meta",
                "provider": provider,
                "model": used_model or "",
            }) + "\n"
            yield json.dumps({"type": "delta", "text": response_text}) + "\n"
            yield json.dumps({
                "type": "done",
                "provider": provider,
                "model": used_model or "",
                "generated_at": int(time.time() * 1000),
            }) + "\n"
            return
        prompt_body = internal_prompt
        if len(prompt_body) > OLLAMA_PROMPT_MAX_CHARS:
            prompt_body = prompt_body[:OLLAMA_PROMPT_MAX_CHARS]
        resolved_max_tokens = max(
            128,
            min(int(INTERNAL_AI_TOOL_MAX_TOKENS), int(OLLAMA_MAX_TOKENS_HARD_LIMIT or INTERNAL_AI_TOOL_MAX_TOKENS)),
        )
        target_predict = int(resolved_max_tokens or 0)
        prompt_ctx_budget = max(128, int(OLLAMA_NUM_CTX) - target_predict - int(OLLAMA_PROMPT_TOKEN_MARGIN))
        approx_prompt_tokens = max(1, int(math.ceil(len(prompt_body) / 4.0)))
        if approx_prompt_tokens > prompt_ctx_budget:
            allowed_chars = max(800, int(prompt_ctx_budget * 4))
            if len(prompt_body) > allowed_chars:
                prompt_body = prompt_body[:allowed_chars]

        for model in model_candidates:
            if _ollama_model_temporarily_missing(model):
                continue
            payload: Dict[str, Any] = {
                "model": model,
                "prompt": prompt_body,
                "stream": True,
                "raw": True,
                "options": {
                    "num_ctx": int(OLLAMA_NUM_CTX),
                    "num_thread": int(OLLAMA_NUM_THREAD),
                    "temperature": 0.2,
                    "num_predict": int(resolved_max_tokens),
                },
            }
            if OLLAMA_REQUEST_KEEP_ALIVE:
                payload["keep_alive"] = OLLAMA_REQUEST_KEEP_ALIVE
            started_at = time.time()
            try:
                yield json.dumps({
                    "type": "status",
                    "stage": "model_request",
                    "detail": f"Modell {model} wird angefragt",
                    "model": model,
                }) + "\n"
                with _ollama_http.post(
                    f"{str(config.get('base_url') or OLLAMA_BASE_URL).rstrip('/')}/api/generate",
                    json=payload,
                    timeout=(connect_timeout, request_timeout),
                    stream=True,
                ) as response:
                    response.raise_for_status()
                    yield json.dumps({
                        "type": "meta",
                        "provider": AI_PROVIDER_OLLAMA,
                        "model": model,
                    }) + "\n"
                    for raw_line in response.iter_lines(decode_unicode=True):
                        if not raw_line:
                            continue
                        line = raw_line.strip()
                        if not line:
                            continue
                        try:
                            chunk = json.loads(line)
                        except ValueError:
                            continue
                        if not isinstance(chunk, dict):
                            continue
                        chunk_text = chunk.get("response")
                        if isinstance(chunk_text, str) and chunk_text:
                            yield json.dumps({"type": "delta", "text": chunk_text}) + "\n"
                        if bool(chunk.get("done")):
                            duration_ms = int((time.time() - started_at) * 1000)
                            if duration_ms >= OLLAMA_SLOW_REQUEST_MS:
                                logger.info(
                                    "Ollama slow stream response model=%s duration_ms=%s prompt_chars=%s num_predict=%s",
                                    model,
                                    duration_ms,
                                    len(prompt_body),
                                    int(resolved_max_tokens),
                                )
                            yield json.dumps({
                                "type": "done",
                                "provider": AI_PROVIDER_OLLAMA,
                                "model": model,
                                "generated_at": int(time.time() * 1000),
                            }) + "\n"
                            return
            except requests.HTTPError as exc:
                response = exc.response
                if response is not None and response.status_code == 404:
                    _mark_ollama_model_missing(model)
                continue
            except requests.RequestException as exc:
                logger.warning("Ollama stream request failed with model %s: %s", model, exc)
                yield json.dumps({
                    "type": "meta",
                    "provider": "fallback",
                    "model": model,
                }) + "\n"
                yield json.dumps({"type": "delta", "text": fallback_text}) + "\n"
                yield json.dumps({
                    "type": "done",
                    "provider": "fallback",
                    "model": model,
                    "generated_at": int(time.time() * 1000),
                }) + "\n"
                return
        yield json.dumps({
            "type": "meta",
            "provider": "fallback",
            "model": "",
        }) + "\n"
        yield json.dumps({"type": "delta", "text": fallback_text}) + "\n"
        yield json.dumps({
            "type": "done",
            "provider": "fallback",
            "model": "",
            "generated_at": int(time.time() * 1000),
        }) + "\n"

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/offer_ai_text")
def generate_offer_text(data: OfferAiRequest):
    mode = (data.mode or "").strip().lower()
    current_text = (data.current_text or "").strip()
    context = (data.context or "").strip()
    if not mode:
        raise HTTPException(400, "Mode required")

    with SessionLocal() as db:
        prompts = serialize_ai_prompts(_get_ai_prompt_settings(db))
    mode_instructions = prompts.get("offer_mode_instructions") or {}
    instruction = mode_instructions.get(mode, "Schreibe einen kurzen, passenden Text.")
    prompt = _render_prompt(
        prompts["offer_base_prompt"],
        {
            "instruction": instruction,
            "context": context if context else "n/a",
            "current_text": current_text if current_text else "n/a",
        },
    )

    model_candidates = _resolve_ai_models(
        MODEL_PREF_OFFER_TEXT,
        MODEL_PREF_TASK_DRAFT,
        purpose="offer_text",
    )
    payload, _, provider = _ai_generate(
        prompt,
        model_candidates=model_candidates,
        temperature=0.2,
        max_tokens=220,
        timeout=INTERNAL_AI_TOOL_TIMEOUT_SECONDS,
    )
    if not payload:
        return {"text": _build_offer_ai_fallback_text(mode, current_text, context), "provider": "fallback"}

    text = (payload.get("response") or "").strip()
    if not text:
        return {"text": _build_offer_ai_fallback_text(mode, current_text, context), "provider": "fallback"}
    if mode == "invoice_position_text":
        text = _sanitize_invoice_position_ai_text(text)
        if not text:
            return {"text": _build_offer_ai_fallback_text(mode, current_text, context), "provider": "fallback"}
    return {"text": text, "provider": provider}

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
def create_report(
    data: ReportCreate,
    x_write_source: Optional[str] = Header(default=None, alias="X-Write-Source"),
):
    if str(x_write_source or "").strip().lower() == "customer-development":
        raise HTTPException(403, "Direct report writes from customer development are blocked")
    with SessionLocal() as db:
        customer_id = data.customer_id
        if not customer_id and data.customer:
            customer = (
                db.query(Customer)
                .filter(func.lower(Customer.name) == data.customer.strip().lower())
                .first()
            )
            customer_id = customer.id if customer else None
        third_party_payload = ""
        if isinstance(data.third_party_payload, dict) and data.third_party_payload:
            third_party_payload = json.dumps(data.third_party_payload)
        report = Report(
            guid=str(uuid.uuid4()),
            customer=data.customer,
            customer_id=customer_id,
            period=data.period or "",
            status=data.status or "",
            summary=data.summary or "",
            customer_action_text=data.customer_action_text or "",
            customer_status=data.customer_status or "",
            third_party_payload=third_party_payload,
        )
        db.add(report)
        db.flush()

        for item in data.items:
            custom_data = ""
            if isinstance(item.custom_data, dict) and item.custom_data:
                custom_data = json.dumps(item.custom_data)
            report_item = ReportItem(
                report_id=report.id,
                priority=item.priority or "Planbar",
                title=item.title or "",
                system=item.system or "",
                why_text=item.why_text or "",
                impact=item.impact or "",
                duration=item.duration or "",
                cost=item.cost or "",
                action_type=item.action_type or "standard",
                custom_html=item.custom_html or "",
                custom_text=item.custom_text or "",
                custom_data=custom_data,
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


@app.get("/api/newsletter_groups")
def get_newsletter_groups():
    with SessionLocal() as db:
        groups = db.query(NewsletterGroup).order_by(NewsletterGroup.name.asc()).all()
        return [serialize_newsletter_group(group) for group in groups]


@app.post("/api/newsletter_groups")
def create_newsletter_group(data: NewsletterGroupCreate):
    with SessionLocal() as db:
        name = str(data.name or "").strip()
        if not name:
            raise HTTPException(400, "Group name required")
        group = NewsletterGroup(
            name=name,
            description=str(data.description or "").strip(),
        )
        db.add(group)
        db.flush()
        _replace_newsletter_group_members(db, group, data.customer_ids)
        db.commit()
        db.refresh(group)
        return serialize_newsletter_group(group)


@app.patch("/api/newsletter_groups/{group_id}")
def update_newsletter_group(group_id: int, data: NewsletterGroupUpdate):
    with SessionLocal() as db:
        group = db.query(NewsletterGroup).get(group_id)
        if not group:
            raise HTTPException(404, "Newsletter group not found")
        if data.name is not None:
            name = str(data.name or "").strip()
            if not name:
                raise HTTPException(400, "Group name required")
            group.name = name
        if data.description is not None:
            group.description = str(data.description or "").strip()
        if data.customer_ids is not None:
            _replace_newsletter_group_members(db, group, data.customer_ids)
        db.commit()
        db.refresh(group)
        return serialize_newsletter_group(group)


@app.delete("/api/newsletter_groups/{group_id}")
def delete_newsletter_group(group_id: int):
    with SessionLocal() as db:
        group = db.query(NewsletterGroup).get(group_id)
        if not group:
            raise HTTPException(404, "Newsletter group not found")
        db.delete(group)
        db.commit()
        return {"status": "deleted"}


@app.get("/api/newsletter_rss_feeds")
def get_newsletter_rss_feeds():
    with SessionLocal() as db:
        feeds = db.query(NewsletterRssFeed).order_by(NewsletterRssFeed.name.asc()).all()
        return [serialize_newsletter_rss_feed(feed) for feed in feeds]


@app.post("/api/newsletter_rss_feeds")
def create_newsletter_rss_feed(data: NewsletterRssFeedCreate):
    with SessionLocal() as db:
        name = str(data.name or "").strip()
        url = _normalize_newsletter_rss_url(data.url)
        if not name:
            raise HTTPException(400, "Feed name required")
        if not url:
            raise HTTPException(400, "Valid feed URL required")
        now_ms = int(time.time() * 1000)
        feed = NewsletterRssFeed(
            name=name,
            url=url,
            description=str(data.description or "").strip(),
            enabled=True if data.enabled is None else bool(data.enabled),
            created_at=now_ms,
            updated_at=now_ms,
        )
        db.add(feed)
        db.commit()
        db.refresh(feed)
        return serialize_newsletter_rss_feed(feed)


@app.patch("/api/newsletter_rss_feeds/{feed_id}")
def update_newsletter_rss_feed(feed_id: int, data: NewsletterRssFeedUpdate):
    with SessionLocal() as db:
        feed = db.query(NewsletterRssFeed).get(feed_id)
        if not feed:
            raise HTTPException(404, "Newsletter RSS feed not found")
        if data.name is not None:
            name = str(data.name or "").strip()
            if not name:
                raise HTTPException(400, "Feed name required")
            feed.name = name
        if data.url is not None:
            url = _normalize_newsletter_rss_url(data.url)
            if not url:
                raise HTTPException(400, "Valid feed URL required")
            feed.url = url
        if data.description is not None:
            feed.description = str(data.description or "").strip()
        if data.enabled is not None:
            feed.enabled = bool(data.enabled)
        feed.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(feed)
        return serialize_newsletter_rss_feed(feed)


@app.delete("/api/newsletter_rss_feeds/{feed_id}")
def delete_newsletter_rss_feed(feed_id: int):
    with SessionLocal() as db:
        feed = db.query(NewsletterRssFeed).get(feed_id)
        if not feed:
            raise HTTPException(404, "Newsletter RSS feed not found")
        db.delete(feed)
        db.commit()
        return {"status": "deleted"}


@app.get("/api/newsletter_rss_articles")
def get_newsletter_rss_articles(feed_id: Optional[int] = None, limit: int = 24):
    resolved_limit = max(1, min(int(limit or 24), 80))
    with SessionLocal() as db:
        query = db.query(NewsletterRssFeed)
        if feed_id:
            query = query.filter(NewsletterRssFeed.id == int(feed_id))
        else:
            query = query.filter(NewsletterRssFeed.enabled.is_(True))
        feeds = query.order_by(NewsletterRssFeed.name.asc()).all()
    if not feeds:
        return {"feeds": [], "items": []}

    per_feed_limit = max(3, min(15, math.ceil(resolved_limit / max(1, len(feeds))) + 2))
    feed_results: List[Dict[str, Any]] = []
    if len(feeds) == 1:
        feed_results.append(_fetch_newsletter_rss_articles_for_feed(feeds[0], per_feed_limit=per_feed_limit))
    else:
        with ThreadPoolExecutor(max_workers=min(6, len(feeds))) as executor:
            future_map = {
                executor.submit(_fetch_newsletter_rss_articles_for_feed, feed, per_feed_limit=per_feed_limit): feed.id
                for feed in feeds
            }
            for future in as_completed(future_map):
                try:
                    feed_results.append(future.result())
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Newsletter RSS aggregate fetch failed: %s", exc)

    items: List[Dict[str, Any]] = []
    seen_keys: Set[str] = set()
    for result in feed_results:
        for item in result.get("items") or []:
            dedupe_key = str(item.get("link") or item.get("title") or item.get("id") or "").strip().lower()
            if dedupe_key and dedupe_key in seen_keys:
                continue
            if dedupe_key:
                seen_keys.add(dedupe_key)
            items.append(item)
    items.sort(
        key=lambda item: (
            -_safe_int(item.get("published_at"), 0),
            str(item.get("feed_name") or "").lower(),
            str(item.get("title") or "").lower(),
        )
    )
    return {
        "feeds": feed_results,
        "items": items[:resolved_limit],
    }


@app.post("/api/newsletter_rss_generate")
def generate_newsletter_from_rss(data: NewsletterRssGenerateRequest):
    articles = [article for article in (data.articles or []) if str(article.title or "").strip()]
    if not articles:
        raise HTTPException(400, "At least one article required")
    if len(articles) > 12:
        articles = articles[:12]
    mode = str(data.mode or "ideas").strip().lower()
    if mode not in {"ideas", "newsletter"}:
        raise HTTPException(400, "Unsupported mode")
    source_text = _build_newsletter_rss_source_text(articles)
    prompt_text = _build_newsletter_rss_prompt(mode, str(data.tone or "sachlich"), len(articles))
    model_candidates = _resolve_internal_ai_tool_models(None)
    payload, used_model, provider = _ai_generate(
        _build_internal_ai_prompt(prompt_text, source_text),
        model_candidates=model_candidates,
        temperature=0.25 if mode == "newsletter" else 0.2,
        max_tokens=min(900 if mode == "newsletter" else 500, int(INTERNAL_AI_MAX_TOKENS)),
        timeout=min(int(INTERNAL_AI_TOOL_TIMEOUT_SECONDS), max(10, int(OLLAMA_TIMEOUT_SECONDS))),
        use_cache=False,
        raw=True,
    )
    response_text = str(payload.get("response") or "").strip()
    if not response_text:
        response_text = _build_newsletter_rss_fallback(mode, articles)
        provider = "fallback"
    return {
        "mode": mode,
        "text": response_text,
        "provider": provider,
        "model": used_model or "",
        "article_count": len(articles),
        "generated_at": int(time.time() * 1000),
    }


@app.get("/api/newsletters")
def get_newsletters():
    with SessionLocal() as db:
        newsletters = db.query(Newsletter).order_by(Newsletter.created_at.desc()).all()
        return [serialize_newsletter(item) for item in newsletters]


@app.get("/api/newsletters/{newsletter_id}")
def get_newsletter(newsletter_id: int):
    with SessionLocal() as db:
        newsletter = db.query(Newsletter).get(newsletter_id)
        if not newsletter:
            raise HTTPException(404, "Newsletter not found")
        return serialize_newsletter(newsletter)


@app.post("/api/newsletters")
def create_newsletter(data: NewsletterSaveRequest):
    with SessionLocal() as db:
        subject = str(data.subject or "").strip()
        if not subject:
            raise HTTPException(400, "Subject required")
        recipient_emails = _resolve_newsletter_recipient_emails(
            db,
            selected_group_ids=data.selected_group_ids,
            selected_customer_ids=data.selected_customer_ids,
            explicit_emails=data.recipient_emails,
        )
        now_ms = int(time.time() * 1000)
        newsletter = Newsletter(
            guid=str(uuid.uuid4()),
            title=str(data.title or "").strip(),
            subject=subject,
            preheader=str(data.preheader or "").strip(),
            intro_html=str(data.intro_html or ""),
            body_html=str(data.body_html or ""),
            cta_label=str(data.cta_label or "").strip(),
            cta_url=str(data.cta_url or "").strip(),
            closing_html=str(data.closing_html or ""),
            audience_json=json.dumps(
                {
                    "group_ids": _normalize_newsletter_customer_ids(data.selected_group_ids),
                    "customer_ids": _normalize_newsletter_customer_ids(data.selected_customer_ids),
                }
            ),
            recipient_emails_json=json.dumps(recipient_emails),
            recipient_count=len(recipient_emails),
            created_at=now_ms,
            updated_at=now_ms,
        )
        db.add(newsletter)
        db.commit()
        db.refresh(newsletter)
        return serialize_newsletter(newsletter)


@app.put("/api/newsletters/{newsletter_id}")
def update_newsletter(newsletter_id: int, data: NewsletterUpdateRequest):
    with SessionLocal() as db:
        newsletter = db.query(Newsletter).get(newsletter_id)
        if not newsletter:
            raise HTTPException(404, "Newsletter not found")
        if data.title is not None:
            newsletter.title = str(data.title or "").strip()
        if data.subject is not None:
            subject = str(data.subject or "").strip()
            if not subject:
                raise HTTPException(400, "Subject required")
            newsletter.subject = subject
        if data.preheader is not None:
            newsletter.preheader = str(data.preheader or "").strip()
        if data.intro_html is not None:
            newsletter.intro_html = str(data.intro_html or "")
        if data.body_html is not None:
            newsletter.body_html = str(data.body_html or "")
        if data.cta_label is not None:
            newsletter.cta_label = str(data.cta_label or "").strip()
        if data.cta_url is not None:
            newsletter.cta_url = str(data.cta_url or "").strip()
        if data.closing_html is not None:
            newsletter.closing_html = str(data.closing_html or "")
        if (
            data.selected_group_ids is not None
            or data.selected_customer_ids is not None
            or data.recipient_emails is not None
        ):
            existing_audience = _parse_json_object(newsletter.audience_json)
            selected_group_ids = (
                data.selected_group_ids
                if data.selected_group_ids is not None
                else existing_audience.get("group_ids")
            )
            selected_customer_ids = (
                data.selected_customer_ids
                if data.selected_customer_ids is not None
                else existing_audience.get("customer_ids")
            )
            explicit_emails = (
                data.recipient_emails
                if data.recipient_emails is not None
                else _parse_json_string_list(newsletter.recipient_emails_json)
            )
            recipient_emails = _resolve_newsletter_recipient_emails(
                db,
                selected_group_ids=selected_group_ids,
                selected_customer_ids=selected_customer_ids,
                explicit_emails=explicit_emails,
            )
            newsletter.audience_json = json.dumps(
                {
                    "group_ids": _normalize_newsletter_customer_ids(selected_group_ids),
                    "customer_ids": _normalize_newsletter_customer_ids(selected_customer_ids),
                }
            )
            newsletter.recipient_emails_json = json.dumps(recipient_emails)
            newsletter.recipient_count = len(recipient_emails)
        newsletter.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(newsletter)
        return serialize_newsletter(newsletter)


@app.delete("/api/newsletters/{newsletter_id}")
def delete_newsletter(newsletter_id: int):
    with SessionLocal() as db:
        newsletter = db.query(Newsletter).get(newsletter_id)
        if not newsletter:
            raise HTTPException(404, "Newsletter not found")
        db.delete(newsletter)
        db.commit()
        return {"status": "deleted"}


@app.post("/api/newsletters/{newsletter_id}/send")
def send_newsletter(newsletter_id: int, data: NewsletterSendRequest):
    with SessionLocal() as db:
        newsletter = db.query(Newsletter).get(newsletter_id)
        if not newsletter:
            raise HTTPException(404, "Newsletter not found")
        settings = _get_smtp_settings(db)
        if not settings.host or not settings.sender_email:
            raise HTTPException(400, "SMTP settings missing")
        recipients = _normalize_newsletter_email_list(data.recipient_emails)
        if not recipients:
            recipients = _parse_json_string_list(newsletter.recipient_emails_json)
        blocked_emails = {
            _customer_effective_email(customer).lower()
            for customer in db.query(Customer).filter(Customer.newsletter.is_(False)).all()
            if _customer_effective_email(customer)
        }
        recipients = [
            recipient
            for recipient in recipients
            if str(recipient or "").strip().lower() not in blocked_emails
        ]
        if not recipients:
            raise HTTPException(400, "No recipients available")

        subject = str(data.subject or newsletter.subject or "").strip()
        if not subject:
            raise HTTPException(400, "Subject required")

        import smtplib

        if settings.use_ssl:
            server = smtplib.SMTP_SSL(settings.host, settings.port or 465, timeout=20)
        else:
            server = smtplib.SMTP(settings.host, settings.port or 587, timeout=20)
        try:
            if settings.use_tls and not settings.use_ssl:
                server.starttls()
            if settings.username:
                server.login(settings.username, settings.password or "")
            for recipient in recipients:
                msg = _build_smtp_message(
                    sender_email=settings.sender_email,
                    sender_name=settings.sender_name,
                    to=recipient,
                    subject=subject,
                    text_body=data.text,
                    html_body=data.html,
                    attachments=data.attachments,
                )
                server.send_message(msg, from_addr=str(settings.sender_email or "").strip(), to_addrs=[recipient])
        except Exception as exc:  # noqa: BLE001
            logger.exception("SMTP newsletter send failed: %s", exc)
            raise HTTPException(502, f"SMTP send failed: {exc}") from exc
        finally:
            server.quit()

        now_ms = int(time.time() * 1000)
        newsletter.sent_at = now_ms
        newsletter.sent_via = "smtp"
        newsletter.sent_to = json.dumps(recipients)
        newsletter.recipient_emails_json = json.dumps(recipients)
        newsletter.recipient_count = len(recipients)
        newsletter.updated_at = now_ms
        db.commit()
        db.refresh(newsletter)
        return serialize_newsletter(newsletter)


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

@app.get("/api/offer_blocks")
def get_offer_blocks():
    with SessionLocal() as db:
        store = _get_offer_block_store(db)
        return serialize_offer_blocks(store)

@app.put("/api/offer_blocks")
def update_offer_blocks(data: OfferBlocksUpdate):
    with SessionLocal() as db:
        store = _get_offer_block_store(db)
        current = serialize_offer_blocks(store)
        payload = {
            "serviceBlocks": data.serviceBlocks if data.serviceBlocks is not None else current["serviceBlocks"],
            "deviceBlocks": data.deviceBlocks if data.deviceBlocks is not None else current["deviceBlocks"],
            "calcBlocks": data.calcBlocks if data.calcBlocks is not None else current["calcBlocks"],
        }
        store.data_json = json.dumps(payload)
        store.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(store)
        return serialize_offer_blocks(store)

@app.get("/api/ai_prompts")
def get_ai_prompts():
    with SessionLocal() as db:
        store = _get_ai_prompt_settings(db)
        return serialize_ai_prompts(store)

@app.put("/api/ai_prompts")
def update_ai_prompts(data: AiPromptsUpdate):
    with SessionLocal() as db:
        store = _get_ai_prompt_settings(db)
        current = serialize_ai_prompts(store)
        requested_contract_variables = (
            data.contract_variables
            if data.contract_variables is not None
            else current.get("contract_variables", {})
        )
        requested_contract_variable_definitions = (
            data.contract_variable_definitions
            if data.contract_variable_definitions is not None
            else current.get("contract_variable_definitions", {})
        )
        if data.contract_variable_definitions is None and data.contract_variables is not None:
            requested_values_normalized: Dict[str, str] = {}
            if isinstance(requested_contract_variables, dict):
                for raw_key, raw_value in requested_contract_variables.items():
                    key = _normalize_contract_variable_key(raw_key)
                    if not key:
                        continue
                    requested_values_normalized[key] = str(raw_value or "")
            overlay_definitions: Dict[str, Any] = {}
            if isinstance(requested_contract_variable_definitions, dict):
                for raw_key, raw_entry in requested_contract_variable_definitions.items():
                    key = _normalize_contract_variable_key(raw_key)
                    if not key:
                        continue
                    if isinstance(raw_entry, dict):
                        next_entry = dict(raw_entry)
                    else:
                        next_entry = {"value": str(raw_entry or "")}
                    if key in requested_values_normalized:
                        next_entry["value"] = requested_values_normalized[key]
                    overlay_definitions[key] = next_entry
            for key, value in requested_values_normalized.items():
                if key in overlay_definitions:
                    continue
                overlay_definitions[key] = {
                    "value": value,
                    "customer_editable": False,
                    "label": key,
                }
            requested_contract_variable_definitions = overlay_definitions
        normalized_contract_variable_definitions = _normalize_contract_variable_definitions(
            requested_contract_variable_definitions,
            fallback_values=requested_contract_variables,
        )
        payload = {
            "action_prompt": data.action_prompt or current["action_prompt"],
            "offer_base_prompt": data.offer_base_prompt or current["offer_base_prompt"],
            "offer_mode_instructions": data.offer_mode_instructions or current["offer_mode_instructions"],
            "contract_header_html": data.contract_header_html if data.contract_header_html is not None else current.get("contract_header_html", ""),
            "contract_footer_html": data.contract_footer_html if data.contract_footer_html is not None else current.get("contract_footer_html", ""),
            "contract_templates": data.contract_templates or current["contract_templates"],
            "contract_variables": _flatten_contract_variable_definitions(normalized_contract_variable_definitions),
            "contract_variable_definitions": normalized_contract_variable_definitions,
        }
        store.data_json = json.dumps(payload)
        store.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(store)
        return serialize_ai_prompts(store)


@app.get("/api/offers")
def list_offers():
    with SessionLocal() as db:
        _ensure_offer_references(db)
        offers = db.query(Offer).order_by(Offer.created_at.desc()).all()
        return [serialize_offer(offer) for offer in offers]


@app.post("/api/offers", response_model=OfferSaveResponse)
def create_offer(data: OfferSaveRequest, request: Request):
    with SessionLocal() as db:
        now_ms = int(time.time() * 1000)
        payload = data.data or {}
        settings = _get_offer_settings(db)
        number_format = (settings.offer_number_format or "AN-XXXX").strip() or "AN-XXXX"
        reference_value = str(data.reference or "").strip()
        if not reference_value:
            reference_value = _offer_next_reference(db, number_format)
        if not payload.get("reference"):
            payload["reference"] = reference_value
        offer = Offer(
            guid=str(uuid.uuid4()),
            reference=reference_value,
            customer=data.customer or "",
            status=data.status or "offen",
            data_json=json.dumps(payload),
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
            reference=offer.reference or "",
        )


@app.put("/api/offers/{offer_id}", response_model=OfferSaveResponse)
def update_offer(offer_id: int, data: OfferSaveRequest, request: Request):
    with SessionLocal() as db:
        offer = db.query(Offer).get(offer_id)
        if not offer:
            raise HTTPException(404, "Offer not found")
        payload = data.data or {}
        reference_value = str(data.reference or "").strip()
        if not reference_value and not str(offer.reference or "").strip():
            settings = _get_offer_settings(db)
            number_format = (settings.offer_number_format or "AN-XXXX").strip() or "AN-XXXX"
            reference_value = _offer_next_reference(db, number_format)
        if reference_value:
            offer.reference = reference_value
        if not payload.get("reference") and str(offer.reference or "").strip():
            payload["reference"] = offer.reference
        offer.customer = data.customer or offer.customer
        if data.status is not None:
            offer.status = data.status or offer.status
        offer.data_json = json.dumps(payload)
        offer.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(offer)
        return OfferSaveResponse(
            id=offer.id,
            guid=offer.guid,
            confirm_url=_build_offer_confirm_url(request, offer.guid),
            reference=offer.reference or "",
        )


@app.delete("/api/offers/{offer_id}")
def delete_offer(offer_id: int):
    with SessionLocal() as db:
        offer = db.query(Offer).get(offer_id)
        if not offer:
            raise HTTPException(404, "Offer not found")
        db.delete(offer)
        db.commit()
        return {"status": "deleted"}


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


@app.get("/api/contract_tariffs")
def get_contract_tariffs(active_only: bool = True):
    with SessionLocal() as db:
        query = db.query(ContractTariff)
        if active_only:
            query = query.filter(ContractTariff.is_active == True)
        rows = (
            query.order_by(
                ContractTariff.category.asc(),
                ContractTariff.name.asc(),
                ContractTariff.id.asc(),
            )
            .all()
        )
        return [serialize_contract_tariff(row) for row in rows]


@app.post("/api/contract_tariffs")
def create_contract_tariff(data: ContractTariffCreate):
    now_ms = int(time.time() * 1000)
    category = str(data.category or "").strip().lower()
    if category not in {"wartung", "monitoring"}:
        raise HTTPException(400, "category must be 'wartung' or 'monitoring'")
    name = str(data.name or "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    with SessionLocal() as db:
        row = ContractTariff(
            family_key=str(uuid.uuid4()),
            name=name,
            category=category,
            version=1,
            is_active=True,
            currency="EUR",
            base_price_monthly=_safe_nonnegative_float(data.base_price_monthly),
            price_server_monthly=_safe_nonnegative_float(data.price_server_monthly),
            price_client_monthly=_safe_nonnegative_float(data.price_client_monthly),
            price_network_monthly=_safe_nonnegative_float(data.price_network_monthly),
            price_iot_monthly=_safe_nonnegative_float(data.price_iot_monthly),
            hourly_price=_safe_nonnegative_float(data.hourly_price),
            notes=str(data.notes or "").strip(),
            created_at=now_ms,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_contract_tariff(row)


@app.put("/api/contract_tariffs/{tariff_id}")
def update_contract_tariff(tariff_id: int, data: ContractTariffUpdate):
    with SessionLocal() as db:
        row = db.query(ContractTariff).get(tariff_id)
        if not row:
            raise HTTPException(404, "Tariff not found")
        if data.name is not None:
            row.name = str(data.name or "").strip()
        if data.category is not None:
            row.category = str(data.category or "").strip().lower()
        if row.category not in {"wartung", "monitoring"}:
            raise HTTPException(400, "category must be 'wartung' or 'monitoring'")
        if not str(row.name or "").strip():
            raise HTTPException(400, "name is required")
        if data.base_price_monthly is not None:
            row.base_price_monthly = _safe_nonnegative_float(data.base_price_monthly)
        if data.price_server_monthly is not None:
            row.price_server_monthly = _safe_nonnegative_float(data.price_server_monthly)
        if data.price_client_monthly is not None:
            row.price_client_monthly = _safe_nonnegative_float(data.price_client_monthly)
        if data.price_network_monthly is not None:
            row.price_network_monthly = _safe_nonnegative_float(data.price_network_monthly)
        if data.price_iot_monthly is not None:
            row.price_iot_monthly = _safe_nonnegative_float(data.price_iot_monthly)
        if data.hourly_price is not None:
            row.hourly_price = _safe_nonnegative_float(data.hourly_price)
        if data.notes is not None:
            row.notes = str(data.notes or "").strip()
        if data.is_active is not None:
            row.is_active = bool(data.is_active)
        db.commit()
        db.refresh(row)
        return serialize_contract_tariff(row)


@app.post("/api/contract_tariffs/{tariff_id}/new_version")
def create_contract_tariff_version(tariff_id: int, data: ContractTariffVersionCreate):
    # Backwards compatible endpoint: tariff updates are now in-place (no versioning).
    return update_contract_tariff(
        tariff_id,
        ContractTariffUpdate(**data.dict(exclude_unset=True)),
    )


@app.post("/api/contract_tariffs/{tariff_id}/deactivate")
def deactivate_contract_tariff(tariff_id: int):
    with SessionLocal() as db:
        row = db.query(ContractTariff).get(tariff_id)
        if not row:
            raise HTTPException(404, "Tariff not found")
        row.is_active = False
        db.commit()
        db.refresh(row)
        return serialize_contract_tariff(row)


@app.post("/api/contract_tariffs/{tariff_id}/activate")
def activate_contract_tariff(tariff_id: int):
    with SessionLocal() as db:
        row = db.query(ContractTariff).get(tariff_id)
        if not row:
            raise HTTPException(404, "Tariff not found")
        row.is_active = True
        db.commit()
        db.refresh(row)
        return serialize_contract_tariff(row)


@app.delete("/api/contract_tariffs/{tariff_id}")
def delete_contract_tariff(tariff_id: int):
    with SessionLocal() as db:
        row = db.query(ContractTariff).get(tariff_id)
        if not row:
            raise HTTPException(404, "Tariff not found")
        usage_count = (
            db.query(func.count(CustomerContractCalculation.id))
            .filter(CustomerContractCalculation.tariff_id == row.id)
            .scalar()
            or 0
        )
        if usage_count > 0:
            raise HTTPException(
                409,
                f"Tariff cannot be deleted because it is used in {int(usage_count)} calculation(s)",
            )
        db.delete(row)
        db.commit()
        return {"status": "deleted", "id": int(tariff_id)}


@app.get("/api/customers/{customer_id}/contract_calculations")
def get_customer_contract_calculations(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        rows = (
            db.query(CustomerContractCalculation)
            .filter(CustomerContractCalculation.customer_id == customer.id)
            .order_by(CustomerContractCalculation.created_at.desc(), CustomerContractCalculation.id.desc())
            .limit(50)
            .all()
        )
        return [serialize_customer_contract_calculation(row) for row in rows]


@app.post("/api/customers/{customer_id}/contract_calculations")
def create_customer_contract_calculation(customer_id: int, data: CustomerContractCalculationCreate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        tariff = db.query(ContractTariff).get(int(data.tariff_id))
        if not tariff:
            raise HTTPException(404, "Tariff not found")
        servers = _safe_nonnegative_int(data.servers)
        clients = _safe_nonnegative_int(data.clients)
        network_devices = _safe_nonnegative_int(data.network_devices)
        iot_devices = _safe_nonnegative_int(data.iot_devices)
        suggested_monthly_total = _calc_contract_total_monthly(
            tariff,
            servers=servers,
            clients=clients,
            network_devices=network_devices,
            iot_devices=iot_devices,
        )
        suggested_yearly_total = suggested_monthly_total * 12.0
        monthly_total = suggested_monthly_total
        yearly_total = suggested_yearly_total
        if data.monthly_total is not None:
            monthly_total = _safe_nonnegative_float(data.monthly_total)
        if data.yearly_total is not None:
            yearly_total = _safe_nonnegative_float(data.yearly_total)
        elif data.monthly_total is not None:
            yearly_total = monthly_total * 12.0
        snapshot_payload = {
            "tariff": serialize_contract_tariff(tariff),
            "counts": {
                "servers": servers,
                "clients": clients,
                "network_devices": network_devices,
                "iot_devices": iot_devices,
            },
            "totals": {
                "monthly_total": round(monthly_total, 2),
                "yearly_total": round(yearly_total, 2),
                "monthly_total_suggested": round(suggested_monthly_total, 2),
                "yearly_total_suggested": round(suggested_yearly_total, 2),
            },
        }
        row = CustomerContractCalculation(
            customer_id=customer.id,
            tariff_id=tariff.id,
            tariff_name=tariff.name or "",
            tariff_category=tariff.category or "",
            tariff_version=int(tariff.version or 1),
            servers=servers,
            clients=clients,
            network_devices=network_devices,
            iot_devices=iot_devices,
            monthly_total=monthly_total,
            yearly_total=yearly_total,
            note=str(data.note or "").strip(),
            snapshot_json=json.dumps(snapshot_payload),
            created_at=int(time.time() * 1000),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_customer_contract_calculation(row)


@app.get("/api/customers/{customer_id}/prepaid_hours")
def get_customer_prepaid_hours(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        return _build_customer_prepaid_hours_payload(db, customer)


@app.post("/api/customers/{customer_id}/prepaid_hours/entries")
def create_customer_prepaid_hours_entry(customer_id: int, data: CustomerPrepaidHoursEntryCreate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        entry_type = _normalize_prepaid_hours_entry_type(data.entry_type)
        if entry_type not in {"purchase", "debit"}:
            raise HTTPException(400, "entry_type must be purchase or debit")
        hours_value = round(float(_safe_nonnegative_float(data.hours)), 2)
        if hours_value <= 0:
            raise HTTPException(400, "hours must be greater than 0")
        now_ms = int(time.time() * 1000)
        effective_at = int(data.effective_at or 0)
        if effective_at <= 0:
            effective_at = now_ms
        label = str(data.label or "").strip()
        note = str(data.note or "").strip()
        task = None
        task_title_snapshot = ""
        task_elapsed_hours_snapshot = 0.0
        task_id_value: Optional[int] = None
        if data.task_id:
            task = db.query(DayTask).get(int(data.task_id))
            if not task:
                raise HTTPException(404, "Task not found")
            task_filters = _customer_task_filter(customer)
            belongs_to_customer = False
            if task_filters:
                task_name = str(task.customer or "").strip().lower()
                task_number = str(task.customer_number or "").strip()
                customer_name = str(customer.name or "").strip().lower()
                customer_number = str(customer.creditor_number or "").strip()
                belongs_to_customer = (
                    (customer_name and task_name == customer_name)
                    or (customer_number and task_number == customer_number)
                )
            if not belongs_to_customer:
                raise HTTPException(400, "Task does not belong to customer")
            task_id_value = int(task.id)
            task_title_snapshot = str(task.title or "").strip()
            task_elapsed_hours_snapshot = _day_task_elapsed_hours(task, now_ms=now_ms)
        if entry_type == "purchase":
            task_id_value = None
            task_title_snapshot = ""
            task_elapsed_hours_snapshot = 0.0
        if not label:
            label = "Stundenkauf" if entry_type == "purchase" else (task_title_snapshot or "Manuelle Abbuchung")
        row = CustomerPrepaidHoursEntry(
            customer_id=customer.id,
            entry_type=entry_type,
            hours=hours_value,
            label=label,
            note=note,
            task_id=task_id_value,
            task_title_snapshot=task_title_snapshot,
            task_elapsed_hours_snapshot=task_elapsed_hours_snapshot,
            effective_at=effective_at,
            created_at=now_ms,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_customer_prepaid_hours_entry(row, task=task, now_ms=now_ms)


@app.delete("/api/customers/{customer_id}/prepaid_hours/entries/{entry_id}")
def delete_customer_prepaid_hours_entry(customer_id: int, entry_id: int):
    with SessionLocal() as db:
        row = (
            db.query(CustomerPrepaidHoursEntry)
            .filter(
                CustomerPrepaidHoursEntry.id == entry_id,
                CustomerPrepaidHoursEntry.customer_id == customer_id,
            )
            .first()
        )
        if not row:
            raise HTTPException(404, "Prepaid hours entry not found")
        db.delete(row)
        db.commit()
        return {"status": "deleted", "id": int(entry_id)}


@app.get("/api/customers/{customer_id}/licenses")
def get_customer_licenses(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        rows = (
            db.query(CustomerLicense)
            .filter(CustomerLicense.customer_id == customer.id)
            .order_by(
                CustomerLicense.status.asc(),
                CustomerLicense.vendor.asc(),
                CustomerLicense.product_name.asc(),
                CustomerLicense.id.desc(),
            )
            .all()
        )
        return [serialize_customer_license(row) for row in rows]


@app.post("/api/customers/{customer_id}/licenses")
def create_customer_license(customer_id: int, data: CustomerLicenseCreate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        vendor = str(data.vendor or "").strip()
        product_name = str(data.product_name or "").strip()
        if not vendor and not product_name:
            raise HTTPException(400, "vendor or product_name is required")
        now_ms = int(time.time() * 1000)
        row = CustomerLicense(
            customer_id=customer.id,
            vendor=vendor,
            product_name=product_name,
            quantity=max(0, int(_safe_nonnegative_int(data.quantity if data.quantity is not None else 1) or 0)),
            billing_cycle=_normalize_customer_license_billing_cycle(data.billing_cycle, default="monthly"),
            cost_eur=_safe_nonnegative_float(data.cost_eur if data.cost_eur is not None else 0.0),
            valid_until=str(data.valid_until or "").strip(),
            status=_normalize_customer_license_status(data.status, default="active"),
            notes=str(data.notes or "").strip(),
            created_at=now_ms,
            updated_at=now_ms,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_customer_license(row)


@app.patch("/api/customers/{customer_id}/licenses/{license_id}")
def update_customer_license(customer_id: int, license_id: int, data: CustomerLicenseUpdate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerLicense)
            .filter(CustomerLicense.id == license_id, CustomerLicense.customer_id == customer.id)
            .first()
        )
        if not row:
            raise HTTPException(404, "License not found")
        update_fields = data.dict(exclude_unset=True)
        if "vendor" in update_fields:
            row.vendor = str(update_fields.get("vendor") or "").strip()
        if "product_name" in update_fields:
            row.product_name = str(update_fields.get("product_name") or "").strip()
        if not str(row.vendor or "").strip() and not str(row.product_name or "").strip():
            raise HTTPException(400, "vendor or product_name is required")
        if "quantity" in update_fields:
            row.quantity = max(0, int(_safe_nonnegative_int(update_fields.get("quantity")) or 0))
        if "billing_cycle" in update_fields:
            row.billing_cycle = _normalize_customer_license_billing_cycle(
                update_fields.get("billing_cycle"),
                default=_normalize_customer_license_billing_cycle(row.billing_cycle, default="monthly"),
            )
        if "cost_eur" in update_fields:
            row.cost_eur = _safe_nonnegative_float(update_fields.get("cost_eur"))
        if "valid_until" in update_fields:
            row.valid_until = str(update_fields.get("valid_until") or "").strip()
        if "status" in update_fields:
            row.status = _normalize_customer_license_status(
                update_fields.get("status"),
                default=_normalize_customer_license_status(row.status, default="active"),
            )
        if "notes" in update_fields:
            row.notes = str(update_fields.get("notes") or "").strip()
        row.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(row)
        return serialize_customer_license(row)


@app.delete("/api/customers/{customer_id}/licenses/{license_id}")
def delete_customer_license(customer_id: int, license_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerLicense)
            .filter(CustomerLicense.id == license_id, CustomerLicense.customer_id == customer.id)
            .first()
        )
        if not row:
            raise HTTPException(404, "License not found")
        db.delete(row)
        db.commit()
        return {"status": "deleted", "id": int(license_id)}


@app.get("/api/customers/{customer_id}/contracts")
def get_customer_contract_documents(customer_id: int, status: Optional[str] = None):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        query = db.query(CustomerContractDocument).filter(CustomerContractDocument.customer_id == customer.id)
        if status is not None and str(status).strip():
            status_value = _normalize_contract_document_status(status, allow_cancelled=True)
            if not status_value:
                raise HTTPException(400, "status must be proposal, active/final or cancelled")
            query = query.filter(CustomerContractDocument.status == status_value)
        rows = query.order_by(CustomerContractDocument.created_at.desc(), CustomerContractDocument.id.desc()).all()
        return [serialize_customer_contract_document(row) for row in rows]


@app.post("/api/customers/{customer_id}/contracts/preview")
def preview_customer_contract_document(customer_id: int, data: CustomerContractPreviewRequest):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        settings = _get_settings(db)
        prompts = serialize_ai_prompts(_get_ai_prompt_settings(db))
        templates = prompts.get("contract_templates") or {}
        requested_template_key = _normalize_contract_template_key(
            data.template_key or data.doc_type or "wartung",
            fallback="wartung",
        )
        template_entry = templates.get(requested_template_key) if isinstance(templates, dict) else None
        if not isinstance(template_entry, dict):
            fallback_doc_type = _normalize_contract_doc_type(data.doc_type or requested_template_key, default="wartung")
            requested_template_key = (
                fallback_doc_type
                if isinstance(templates, dict) and isinstance(templates.get(fallback_doc_type), dict)
                else "wartung"
            )
            template_entry = templates.get(requested_template_key) or templates.get("wartung") or {}
        template_key = requested_template_key
        doc_type_value = _resolve_contract_doc_type_from_template(template_key, template_entry, default="wartung")
        is_service_contract = doc_type_value in {"wartung", "monitoring"}
        template_title = str(template_entry.get("title") or "Vertrag")
        template_header_html = str(template_entry.get("header_html") or "")
        title = str(data.title or "").strip() or template_title
        body_template = str(template_entry.get("body_template") or "").strip()
        template_footer_html = str(template_entry.get("footer_html") or "")
        if not body_template:
            raise HTTPException(400, "No contract template configured for selected type")

        now = datetime.now()
        generated_at = now.strftime("%d.%m.%Y")
        valid_from = _normalize_contract_storage_date(data.valid_from, fallback_dt=now)
        valid_from_display = _format_contract_display_date(valid_from, fallback=generated_at)
        runtime_months = max(1, _safe_nonnegative_int(data.runtime_months or 12))
        termination_notice_months = max(0, _safe_nonnegative_int(data.termination_notice_months or 3))
        if termination_notice_months > runtime_months:
            raise HTTPException(400, "termination_notice_months must not exceed runtime_months")
        auto_extension_months = max(1, _safe_nonnegative_int(data.auto_extension_months or 12))
        monthly_hours_included = _safe_nonnegative_float(data.monthly_hours_included or 0.0)
        if not is_service_contract:
            monthly_hours_included = 0.0

        servers = _safe_nonnegative_int(data.servers or 0)
        clients = _safe_nonnegative_int(data.clients or 0)
        network_devices = _safe_nonnegative_int(data.network_devices or 0)
        iot_devices = _safe_nonnegative_int(data.iot_devices or 0)
        counts_source = "request"
        monthly_total = float(data.monthly_total or 0.0)
        yearly_total = float(data.yearly_total or 0.0)
        service_scope = (
            "Standardleistungen laut vereinbartem Serviceumfang."
            if is_service_contract
            else "Regelungen laut AVV/DSGVO."
        )

        counts_are_empty = (
            servers <= 0
            and clients <= 0
            and network_devices <= 0
            and iot_devices <= 0
        )
        if counts_are_empty and not data.calculation_id:
            meta_hub_counts = _load_contract_counts_from_meta_hub(customer.id)
            if meta_hub_counts:
                servers = _safe_nonnegative_int(meta_hub_counts.get("servers"))
                clients = _safe_nonnegative_int(meta_hub_counts.get("clients"))
                network_devices = _safe_nonnegative_int(meta_hub_counts.get("network_devices"))
                iot_devices = _safe_nonnegative_int(meta_hub_counts.get("iot_devices"))
                counts_source = "meta_hub"
                service_scope = "Meta-Hub Infrastrukturvorschlag (RMM/Discovery konsolidiert)."

        tariff = None
        if data.calculation_id:
            calc = db.query(CustomerContractCalculation).get(int(data.calculation_id))
            if calc and calc.customer_id == customer.id:
                servers = _safe_nonnegative_int(calc.servers)
                clients = _safe_nonnegative_int(calc.clients)
                network_devices = _safe_nonnegative_int(calc.network_devices)
                iot_devices = _safe_nonnegative_int(calc.iot_devices)
                counts_source = "calculation"
                monthly_total = float(calc.monthly_total or 0.0)
                yearly_total = float(calc.yearly_total or 0.0)
                if is_service_contract and calc.tariff_name:
                    service_scope = f"Tarif: {calc.tariff_name}."
                if is_service_contract and calc.tariff_id:
                    tariff = db.query(ContractTariff).get(int(calc.tariff_id))
        if is_service_contract and data.tariff_id:
            tariff_candidate = db.query(ContractTariff).get(int(data.tariff_id))
            if not tariff_candidate:
                raise HTTPException(404, "Tariff not found")
            tariff = tariff_candidate
        if is_service_contract and tariff:
            tariff_category = str(tariff.category or "").strip().lower()
            if tariff_category and tariff_category != doc_type_value:
                raise HTTPException(400, "tariff category does not match contract type")
            suggested_monthly_total = _calc_contract_total_monthly(
                tariff,
                servers=servers,
                clients=clients,
                network_devices=network_devices,
                iot_devices=iot_devices,
                monthly_hours_included=monthly_hours_included,
            )
            suggested_yearly_total = suggested_monthly_total * 12.0
            # Tariff is a pricing suggestion. Keep explicit request totals if provided.
            if data.monthly_total is None:
                monthly_total = suggested_monthly_total
            if data.yearly_total is None:
                yearly_total = monthly_total * 12.0 if data.monthly_total is not None else suggested_yearly_total
            service_scope = f"Tarif: {str(tariff.name or 'Service').strip()}."
        else:
            suggested_monthly_total = float(monthly_total or 0.0)
            suggested_yearly_total = float(yearly_total or 0.0)
        if is_service_contract and not tariff:
            raise HTTPException(400, "tariff_id is required for wartung/monitoring contracts")
        hourly_price = _safe_nonnegative_float(tariff.hourly_price if is_service_contract and tariff else 0.0)

        note_raw = str(data.note or "").strip()
        note_block = (
            f"Hinweis: {escape(note_raw).replace(chr(10), '<br/>')}" if note_raw else "Ohne Zusatzhinweise."
        )
        extension_period_months = max(1, auto_extension_months)
        customer_number = str(customer.creditor_number or "").strip()
        customer_short_code = str(customer.short_code or "").strip()
        effective_address = _customer_effective_address(customer)
        customer_email = _customer_effective_email(customer)
        customer_street = effective_address["street"]
        customer_postal_code = effective_address["postal_code"]
        customer_city = effective_address["city"]
        customer_country = effective_address["country"]
        customer_address = _customer_address_text(effective_address)
        termination_notice_label = (
            f"{termination_notice_months} Monat" if termination_notice_months == 1 else f"{termination_notice_months} Monate"
        )
        provider_meta = _resolve_contract_provider_meta(settings)
        placeholder_values = {
            "provider_name": escape(provider_meta["provider_name"]),
            "provider_address": escape(provider_meta["provider_address"]),
            "provider_email": escape(provider_meta["provider_email"]),
            "provider_contact_line": escape(provider_meta["provider_contact_line"]),
            "customer_name": escape(str(customer.name or "").strip() or "Kunde"),
            "customer_number": escape(customer_number),
            "customer_short_code": escape(customer_short_code),
            "customer_email": escape(customer_email),
            "customer_street": escape(customer_street),
            "customer_postal_code": escape(customer_postal_code),
            "customer_city": escape(customer_city),
            "customer_country": escape(customer_country),
            "customer_address": escape(customer_address),
            "generated_at": generated_at,
            "valid_from": escape(valid_from_display),
            "contract_start": escape(valid_from_display),
            "runtime_months": str(runtime_months),
            "minimum_term_months": str(runtime_months),
            "extension_period": str(extension_period_months),
            "auto_extension_months": str(auto_extension_months),
            "termination_notice_months": str(termination_notice_months),
            "termination_notice": termination_notice_label,
            "servers": str(servers),
            "clients": str(clients),
            "network_devices": str(network_devices),
            "iot_devices": str(iot_devices),
            "monthly_total": _format_contract_currency(monthly_total),
            "yearly_total": _format_contract_currency(yearly_total),
            "monthly_hours_included": _format_contract_hours(monthly_hours_included),
            "service_scope": escape(service_scope),
            "service_hours": "Montag bis Freitag, 08:00-17:00 Uhr (werktags)",
            "reaction_time": "innerhalb von 8 Arbeitsstunden",
            "hourly_rate_extra": f"{_format_contract_currency(hourly_price)} pro Stunde",
            "billing_interval": "monatlich",
            "additional_systems": "keine",
            "monitoring_enabled": "ja" if is_service_contract else "nicht zutreffend",
            "backup_monitoring": "nach Vereinbarung",
            "patch_management": "ja (sicherheitsrelevant)",
            "security_monitoring": "ja (Basis)",
            "liability_limit": "gemäß AGB",
            "note_block": note_block,
        }
        request_contract_variable_values = (
            data.contract_variable_values if isinstance(data.contract_variable_values, dict) else {}
        )
        request_contract_variable_values_normalized: Dict[str, str] = {}
        for raw_key, raw_value in request_contract_variable_values.items():
            key = _normalize_contract_variable_key(raw_key)
            if not key:
                continue
            request_contract_variable_values_normalized[key] = str(raw_value or "")
        template_placeholder_keys = _extract_contract_placeholders(
            template_header_html,
            body_template,
            template_footer_html,
        )
        custom_template_variable_keys = sorted(
            [
                key
                for key in template_placeholder_keys
                if key not in placeholder_values and key not in _CONTRACT_FALLBACK_VALUES
            ]
        )
        individual_variables: List[Dict[str, Any]] = []
        applied_individual_values: Dict[str, str] = {}
        for key in custom_template_variable_keys:
            value = request_contract_variable_values_normalized.get(key, "")
            placeholder_values[key] = value
            applied_individual_values[key] = value
            individual_variables.append(
                {
                    "key": key,
                    "label": key,
                    "suggested_value": "",
                    "value": value,
                    "customer_editable": True,
                }
            )
        individual_variables = sorted(
            individual_variables,
            key=lambda entry: str(entry.get("label") or entry.get("key") or "").lower(),
        )
        unresolved_placeholder_keys = [
            key
            for key in template_placeholder_keys
            if key not in placeholder_values and key not in _CONTRACT_FALLBACK_VALUES
        ]
        html = _render_contract_html(
            customer=customer,
            title=title,
            template_key=template_key,
            header_html=template_header_html,
            body_template=body_template,
            footer_html=template_footer_html,
            placeholders=placeholder_values,
        )
        safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", title).strip("_") or "vertrag"
        file_name = f"{safe_name}.pdf"
        return {
            "title": title,
            "doc_type": doc_type_value,
            "template_key": template_key,
            "file_name": file_name,
            "html": html,
            "meta": {
                "generated_at": generated_at,
                "valid_from": valid_from,
                "runtime_months": runtime_months,
                "termination_notice_months": termination_notice_months,
                "auto_extension_months": auto_extension_months,
                "counts_source": counts_source,
                "servers": servers,
                "clients": clients,
                "network_devices": network_devices,
                "iot_devices": iot_devices,
                "monthly_total": round(float(monthly_total or 0.0), 2),
                "yearly_total": round(float(yearly_total or 0.0), 2),
                "suggested_monthly_total": round(float(suggested_monthly_total or 0.0), 2),
                "suggested_yearly_total": round(float(suggested_yearly_total or 0.0), 2),
                "monthly_hours_included": round(float(monthly_hours_included or 0.0), 2),
                "placeholder_keys": template_placeholder_keys,
                "unresolved_placeholders": unresolved_placeholder_keys,
                "tariff": serialize_contract_tariff(tariff) if tariff else None,
                "template_title": template_title,
                "template_description": str(template_entry.get("description") or "").strip(),
                "individual_variables": individual_variables,
                "contract_variable_values": applied_individual_values,
            },
        }


@app.post("/api/customers/{customer_id}/contracts")
def create_customer_contract_document(customer_id: int, data: CustomerContractDocumentCreate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        prompts = serialize_ai_prompts(_get_ai_prompt_settings(db))
        templates = prompts.get("contract_templates") or {}
        title = str(data.title or "").strip()
        file_name = str(data.file_name or "").strip()
        content_base64 = str(data.content_base64 or "").strip()
        if not title:
            raise HTTPException(400, "title is required")
        if not file_name:
            file_name = f"{re.sub(r'[^a-zA-Z0-9_-]+', '_', title).strip('_') or 'vertrag'}.pdf"
        if not content_base64:
            raise HTTPException(400, "content_base64 is required")
        status_value = str(data.status or "active").strip().lower()
        if status_value not in {"active", "proposal"}:
            status_value = "active"
        runtime_months = max(1, int(_safe_nonnegative_int(data.runtime_months or 12)))
        termination_notice_months = max(0, int(_safe_nonnegative_int(data.termination_notice_months or 3)))
        auto_extension_months = max(1, int(_safe_nonnegative_int(data.auto_extension_months or 12)))
        if termination_notice_months > runtime_months:
            raise HTTPException(400, "termination_notice_months must not exceed runtime_months")
        valid_from = str(data.valid_from or "").strip()
        template_key_value = _normalize_contract_template_key(
            data.template_key or data.doc_type or "wartung",
            fallback="wartung",
        )
        template_entry = templates.get(template_key_value) if isinstance(templates, dict) else None
        if not isinstance(template_entry, dict):
            fallback_doc_type = _normalize_contract_doc_type(data.doc_type or template_key_value, default="wartung")
            template_key_value = (
                fallback_doc_type
                if isinstance(templates, dict) and isinstance(templates.get(fallback_doc_type), dict)
                else "wartung"
            )
            template_entry = templates.get(template_key_value) or templates.get("wartung") or {}
        doc_type_value = _normalize_contract_doc_type(data.doc_type, default="")
        if not doc_type_value:
            doc_type_value = _resolve_contract_doc_type_from_template(
                template_key_value,
                template_entry if isinstance(template_entry, dict) else None,
                default="wartung",
            )
        is_service_contract = doc_type_value in {"wartung", "monitoring"}
        monthly_hours_included = _safe_nonnegative_float(data.monthly_hours_included or 0.0)
        if not is_service_contract:
            monthly_hours_included = 0.0
        tariff = None
        if is_service_contract:
            if not data.tariff_id:
                raise HTTPException(400, "tariff_id is required for wartung/monitoring contracts")
            tariff = db.query(ContractTariff).get(int(data.tariff_id))
            if not tariff:
                raise HTTPException(404, "Tariff not found")
            tariff_category = str(tariff.category or "").strip().lower()
            if tariff_category and tariff_category != doc_type_value:
                raise HTTPException(400, "tariff category does not match contract type")
        servers = _safe_nonnegative_int(data.servers)
        clients = _safe_nonnegative_int(data.clients)
        network_devices = _safe_nonnegative_int(data.network_devices)
        iot_devices = _safe_nonnegative_int(data.iot_devices)
        suggested_monthly_total = (
            _calc_contract_total_monthly(
                tariff,
                servers=servers,
                clients=clients,
                network_devices=network_devices,
                iot_devices=iot_devices,
                monthly_hours_included=monthly_hours_included,
            )
            if is_service_contract and tariff
            else _safe_nonnegative_float(data.suggested_monthly_total)
        )
        suggested_yearly_total = (
            suggested_monthly_total * 12.0
            if is_service_contract and tariff
            else _safe_nonnegative_float(
                data.suggested_yearly_total
                if data.suggested_yearly_total is not None
                else suggested_monthly_total * 12.0
            )
        )
        monthly_total = (
            _safe_nonnegative_float(data.monthly_total)
            if data.monthly_total is not None
            else suggested_monthly_total
        )
        yearly_total = (
            _safe_nonnegative_float(data.yearly_total)
            if data.yearly_total is not None
            else monthly_total * 12.0
        )
        contract_variable_values: Dict[str, str] = {}
        for raw_key, raw_value in (data.contract_variable_values or {}).items():
            key = _normalize_contract_variable_key(raw_key)
            if not key or key in _CONTRACT_RUNTIME_PLACEHOLDERS:
                continue
            contract_variable_values[key] = str(raw_value or "")
        snapshot_payload = {
            "template_key": template_key_value,
            "tariff": serialize_contract_tariff(tariff) if tariff else None,
            "counts": {
                "servers": servers,
                "clients": clients,
                "network_devices": network_devices,
                "iot_devices": iot_devices,
            },
            "pricing": {
                "monthly_total": round(float(monthly_total or 0.0), 2),
                "yearly_total": round(float(yearly_total or 0.0), 2),
                "suggested_monthly_total": round(float(suggested_monthly_total or 0.0), 2),
                "suggested_yearly_total": round(float(suggested_yearly_total or 0.0), 2),
                "monthly_hours_included": round(float(monthly_hours_included or 0.0), 2),
                "individual_price_applied": round(float(monthly_total or 0.0), 2)
                != round(float(suggested_monthly_total or 0.0), 2)
                or round(float(yearly_total or 0.0), 2) != round(float(suggested_yearly_total or 0.0), 2),
            },
            "contract_variable_values": contract_variable_values,
        }
        # Validate base64 payload.
        try:
            base64.b64decode(content_base64, validate=True)
        except Exception:
            raise HTTPException(400, "Invalid base64 content")
        row = CustomerContractDocument(
            customer_id=customer.id,
            title=title,
            doc_type=doc_type_value,
            status=status_value,
            file_name=file_name,
            mime_type=str(data.mime_type or "application/pdf").strip() or "application/pdf",
            content_base64=content_base64,
            html_content=str(data.html_content or ""),
            template_key=template_key_value,
            monthly_hours_included=monthly_hours_included,
            valid_from=valid_from,
            runtime_months=runtime_months,
            termination_notice_months=termination_notice_months,
            auto_extension_months=auto_extension_months,
            note=str(data.note or "").strip(),
            snapshot_json=json.dumps(snapshot_payload),
            created_at=int(time.time() * 1000),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return serialize_customer_contract_document(row)


@app.put("/api/customers/{customer_id}/contracts/{contract_id}")
def update_customer_contract_document(customer_id: int, contract_id: int, data: CustomerContractDocumentCreate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        prompts = serialize_ai_prompts(_get_ai_prompt_settings(db))
        templates = prompts.get("contract_templates") or {}
        row = (
            db.query(CustomerContractDocument)
            .filter(
                CustomerContractDocument.id == contract_id,
                CustomerContractDocument.customer_id == customer.id,
            )
            .first()
        )
        if not row:
            raise HTTPException(404, "Contract document not found")
        if str(row.status or "").strip().lower() != "proposal":
            raise HTTPException(400, "Only proposal contracts can be edited")

        title = str(data.title or "").strip()
        file_name = str(data.file_name or "").strip()
        content_base64 = str(data.content_base64 or "").strip()
        if not title:
            raise HTTPException(400, "title is required")
        if not file_name:
            file_name = f"{re.sub(r'[^a-zA-Z0-9_-]+', '_', title).strip('_') or 'vertrag'}.pdf"
        if not content_base64:
            raise HTTPException(400, "content_base64 is required")
        status_value = str(data.status or "proposal").strip().lower()
        if status_value not in {"active", "proposal"}:
            status_value = "proposal"
        runtime_months = max(1, int(_safe_nonnegative_int(data.runtime_months or 12)))
        termination_notice_months = max(0, int(_safe_nonnegative_int(data.termination_notice_months or 3)))
        auto_extension_months = max(1, int(_safe_nonnegative_int(data.auto_extension_months or 12)))
        if termination_notice_months > runtime_months:
            raise HTTPException(400, "termination_notice_months must not exceed runtime_months")
        valid_from = str(data.valid_from or "").strip()
        template_key_value = _normalize_contract_template_key(
            data.template_key or data.doc_type or row.template_key or row.doc_type or "wartung",
            fallback="wartung",
        )
        template_entry = templates.get(template_key_value) if isinstance(templates, dict) else None
        if not isinstance(template_entry, dict):
            fallback_doc_type = _normalize_contract_doc_type(
                data.doc_type or template_key_value or row.doc_type,
                default="wartung",
            )
            template_key_value = (
                fallback_doc_type
                if isinstance(templates, dict) and isinstance(templates.get(fallback_doc_type), dict)
                else "wartung"
            )
            template_entry = templates.get(template_key_value) or templates.get("wartung") or {}
        doc_type_value = _normalize_contract_doc_type(data.doc_type, default="")
        if not doc_type_value:
            doc_type_value = _resolve_contract_doc_type_from_template(
                template_key_value,
                template_entry if isinstance(template_entry, dict) else None,
                default="wartung",
            )
        is_service_contract = doc_type_value in {"wartung", "monitoring"}
        monthly_hours_included = _safe_nonnegative_float(data.monthly_hours_included or 0.0)
        if not is_service_contract:
            monthly_hours_included = 0.0
        tariff = None
        if is_service_contract:
            if not data.tariff_id:
                raise HTTPException(400, "tariff_id is required for wartung/monitoring contracts")
            tariff = db.query(ContractTariff).get(int(data.tariff_id))
            if not tariff:
                raise HTTPException(404, "Tariff not found")
            tariff_category = str(tariff.category or "").strip().lower()
            if tariff_category and tariff_category != doc_type_value:
                raise HTTPException(400, "tariff category does not match contract type")
        servers = _safe_nonnegative_int(data.servers)
        clients = _safe_nonnegative_int(data.clients)
        network_devices = _safe_nonnegative_int(data.network_devices)
        iot_devices = _safe_nonnegative_int(data.iot_devices)
        suggested_monthly_total = (
            _calc_contract_total_monthly(
                tariff,
                servers=servers,
                clients=clients,
                network_devices=network_devices,
                iot_devices=iot_devices,
                monthly_hours_included=monthly_hours_included,
            )
            if is_service_contract and tariff
            else _safe_nonnegative_float(data.suggested_monthly_total)
        )
        suggested_yearly_total = (
            suggested_monthly_total * 12.0
            if is_service_contract and tariff
            else _safe_nonnegative_float(
                data.suggested_yearly_total
                if data.suggested_yearly_total is not None
                else suggested_monthly_total * 12.0
            )
        )
        monthly_total = (
            _safe_nonnegative_float(data.monthly_total)
            if data.monthly_total is not None
            else suggested_monthly_total
        )
        yearly_total = (
            _safe_nonnegative_float(data.yearly_total)
            if data.yearly_total is not None
            else monthly_total * 12.0
        )
        contract_variable_values: Dict[str, str] = {}
        for raw_key, raw_value in (data.contract_variable_values or {}).items():
            key = _normalize_contract_variable_key(raw_key)
            if not key or key in _CONTRACT_RUNTIME_PLACEHOLDERS:
                continue
            contract_variable_values[key] = str(raw_value or "")
        snapshot_payload = {
            "template_key": template_key_value,
            "tariff": serialize_contract_tariff(tariff) if tariff else None,
            "counts": {
                "servers": servers,
                "clients": clients,
                "network_devices": network_devices,
                "iot_devices": iot_devices,
            },
            "pricing": {
                "monthly_total": round(float(monthly_total or 0.0), 2),
                "yearly_total": round(float(yearly_total or 0.0), 2),
                "suggested_monthly_total": round(float(suggested_monthly_total or 0.0), 2),
                "suggested_yearly_total": round(float(suggested_yearly_total or 0.0), 2),
                "monthly_hours_included": round(float(monthly_hours_included or 0.0), 2),
                "individual_price_applied": round(float(monthly_total or 0.0), 2)
                != round(float(suggested_monthly_total or 0.0), 2)
                or round(float(yearly_total or 0.0), 2) != round(float(suggested_yearly_total or 0.0), 2),
            },
            "contract_variable_values": contract_variable_values,
        }
        try:
            base64.b64decode(content_base64, validate=True)
        except Exception:
            raise HTTPException(400, "Invalid base64 content")

        row.title = title
        row.doc_type = doc_type_value
        row.status = status_value
        row.file_name = file_name
        row.mime_type = str(data.mime_type or "application/pdf").strip() or "application/pdf"
        row.content_base64 = content_base64
        row.html_content = str(data.html_content or "")
        row.template_key = template_key_value
        row.monthly_hours_included = monthly_hours_included
        row.valid_from = valid_from
        row.runtime_months = runtime_months
        row.termination_notice_months = termination_notice_months
        row.auto_extension_months = auto_extension_months
        row.note = str(data.note or "").strip()
        row.snapshot_json = json.dumps(snapshot_payload)
        row.cancel_reason = ""
        row.cancelled_at = 0
        row.cancelled_effective_at = 0
        row.stop_service_immediately = False
        db.commit()
        db.refresh(row)
        return serialize_customer_contract_document(row)


@app.post("/api/customers/{customer_id}/contracts/{contract_id}/cancel")
def cancel_customer_contract_document(customer_id: int, contract_id: int, data: CustomerContractStatusUpdate):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerContractDocument)
            .filter(
                CustomerContractDocument.id == contract_id,
                CustomerContractDocument.customer_id == customer.id,
            )
            .first()
        )
        if not row:
            raise HTTPException(404, "Contract document not found")
        timeline = _build_contract_timeline(row)
        immediate_stop = bool(data.stop_service_immediately)
        requested_effective_at = int(_safe_nonnegative_int(data.effective_at or 0))
        now_ms = int(time.time() * 1000)
        if immediate_stop:
            effective_at = now_ms
        elif requested_effective_at > 0:
            effective_at = requested_effective_at
        else:
            effective_at = int(timeline.get("term_end_at") or 0)
            if effective_at <= 0:
                effective_at = now_ms
            effective_at = max(now_ms, effective_at)
        row.status = "cancelled"
        row.cancel_reason = str(data.reason or "").strip()
        row.cancelled_at = now_ms
        row.cancelled_effective_at = int(effective_at)
        row.stop_service_immediately = immediate_stop
        db.commit()
        db.refresh(row)
        return serialize_customer_contract_document(row)


@app.post("/api/customers/{customer_id}/contracts/{contract_id}/reactivate")
def reactivate_customer_contract_document(customer_id: int, contract_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerContractDocument)
            .filter(
                CustomerContractDocument.id == contract_id,
                CustomerContractDocument.customer_id == customer.id,
            )
            .first()
        )
        if not row:
            raise HTTPException(404, "Contract document not found")
        row.status = "active"
        row.cancel_reason = ""
        row.cancelled_at = 0
        row.cancelled_effective_at = 0
        row.stop_service_immediately = False
        db.commit()
        db.refresh(row)
        return serialize_customer_contract_document(row)


@app.post("/api/customers/{customer_id}/contracts/{contract_id}/mark_proposal")
def mark_customer_contract_document_proposal(customer_id: int, contract_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerContractDocument)
            .filter(
                CustomerContractDocument.id == contract_id,
                CustomerContractDocument.customer_id == customer.id,
            )
            .first()
        )
        if not row:
            raise HTTPException(404, "Contract document not found")
        row.status = "proposal"
        row.cancel_reason = ""
        row.cancelled_at = 0
        row.cancelled_effective_at = 0
        row.stop_service_immediately = False
        db.commit()
        db.refresh(row)
        return serialize_customer_contract_document(row)


@app.get("/api/customers/{customer_id}/contracts/{contract_id}/download")
def download_customer_contract_document(customer_id: int, contract_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerContractDocument)
            .filter(
                CustomerContractDocument.id == contract_id,
                CustomerContractDocument.customer_id == customer.id,
            )
            .first()
        )
        if not row:
            raise HTTPException(404, "Contract document not found")
        return _build_contract_download_response(row)


@app.get("/api/customers/{customer_id}/contracts/download_latest")
def download_latest_customer_contract_document(customer_id: int, status: str = "active"):
    status_value = _normalize_contract_document_status(status, allow_cancelled=False)
    if not status_value:
        raise HTTPException(400, "status must be proposal or active/final")
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerContractDocument)
            .filter(
                CustomerContractDocument.customer_id == customer.id,
                CustomerContractDocument.status == status_value,
            )
            .order_by(CustomerContractDocument.created_at.desc(), CustomerContractDocument.id.desc())
            .first()
        )
        if not row:
            raise HTTPException(404, f"No contract with status '{status_value}' found")
        return _build_contract_download_response(row)


@app.delete("/api/customers/{customer_id}/contracts/{contract_id}")
def delete_customer_contract_document(customer_id: int, contract_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        row = (
            db.query(CustomerContractDocument)
            .filter(
                CustomerContractDocument.id == contract_id,
                CustomerContractDocument.customer_id == customer.id,
            )
            .first()
        )
        if not row:
            raise HTTPException(404, "Contract document not found")
        db.delete(row)
        db.commit()
        return {"status": "deleted", "id": contract_id}


@app.get("/api/company_stats")
def get_company_stats(days: int = 30, section: Optional[str] = None):
    safe_days = max(1, min(int(days or 30), 365))
    now_ms = int(time.time() * 1000)
    now_dt = datetime.now()
    section_key = str(section or "").strip().lower()
    load_all = not section_key
    load_general = load_all or section_key == "general"
    load_telephony = load_all or section_key == "telephony"
    load_reports = load_all or section_key == "reports"
    load_billing = load_all or section_key == "billing"
    load_customers = load_all or section_key == "customers"
    load_contracts = load_all or section_key == "contracts"
    load_sevdesk = load_billing or load_customers or load_contracts

    start_of_day = datetime(now_dt.year, now_dt.month, now_dt.day)
    start_of_week = start_of_day - timedelta(days=start_of_day.weekday())
    start_day_ms = int(start_of_day.timestamp() * 1000)
    start_week_ms = int(start_of_week.timestamp() * 1000)
    start_ms = now_ms - safe_days * 24 * 60 * 60 * 1000

    day_tasks_total = 0
    day_tasks_open = 0
    day_tasks_done = 0
    day_tasks_done_today = 0
    day_tasks_done_week = 0
    done_elapsed_today = 0
    done_elapsed_week = 0
    total_time_ms = 0
    open_time_ms = 0
    total_time_tasks = 0
    open_time_tasks = 0
    reports_total = 0
    reports_confirmed = 0
    reports_opened = 0
    reports_unread = 0
    reports_sent = 0
    month_stats: Dict[str, Dict[str, Any]] = {}
    hourly_rate = 0.0
    sevdesk_config: Optional[SevdeskConfig] = None
    contracts_stats: Dict[str, Any] = {}
    inactive_customer_name_keys: Set[str] = set()
    active_customer_name_keys: Set[str] = set()
    inactive_customer_number_keys: Set[str] = set()
    active_customer_number_keys: Set[str] = set()

    with SessionLocal() as db:
        metrics_settings = None
        integration_settings = None
        if load_general or load_sevdesk:
            metrics_settings = _get_customer_metrics_settings(db)
            integration_settings = db.query(IntegrationSettings).first()
            hourly_rate = _resolve_configured_hourly_rate(integration_settings, metrics_settings)

        if load_customers:
            all_customers = db.query(Customer).all()
            for customer in all_customers:
                name_key = _dev_normalize_text(customer.name)
                number_key = _normalize_customer_number(customer.creditor_number)
                is_inactive = (customer.status or "active").strip().lower() == "inactive"
                if is_inactive:
                    if name_key:
                        inactive_customer_name_keys.add(name_key)
                    if number_key:
                        inactive_customer_number_keys.add(number_key)
                else:
                    if name_key:
                        active_customer_name_keys.add(name_key)
                    if number_key:
                        active_customer_number_keys.add(number_key)

        if load_general:
            day_tasks_total = db.query(DayTask).count()
            day_tasks_open = db.query(DayTask).filter(DayTask.status != "done").count()
            day_tasks_done = db.query(DayTask).filter(DayTask.status == "done").count()
            day_tasks_done_today = (
                db.query(DayTask)
                .filter(DayTask.completed_at >= start_day_ms)
                .filter(DayTask.status == "done")
                .count()
            )
            day_tasks_done_week = (
                db.query(DayTask)
                .filter(DayTask.completed_at >= start_week_ms)
                .filter(DayTask.status == "done")
                .count()
            )
            done_elapsed_today = (
                db.query(func.coalesce(func.sum(DayTask.elapsed), 0))
                .filter(DayTask.completed_at >= start_day_ms)
                .filter(DayTask.status == "done")
                .filter(DayTask.time_enabled == True)
                .scalar()
                or 0
            )
            done_elapsed_week = (
                db.query(func.coalesce(func.sum(DayTask.elapsed), 0))
                .filter(DayTask.completed_at >= start_week_ms)
                .filter(DayTask.status == "done")
                .filter(DayTask.time_enabled == True)
                .scalar()
                or 0
            )
            for task in db.query(DayTask).filter(DayTask.time_enabled == True).all():
                total_time_tasks += 1
                elapsed = task.elapsed or 0
                if task.running and task.startTime:
                    elapsed += max(0, now_ms - task.startTime)
                total_time_ms += elapsed
                if task.status != "done":
                    open_time_tasks += 1
                    open_time_ms += elapsed

        if load_reports:
            reports_total = db.query(Report).count()
            reports_confirmed = (
                db.query(Report).filter(Report.customer_status == "Bestätigt").count()
            )
            reports_opened = (
                db.query(Report)
                .filter(
                    or_(
                        Report.opened_count > 0,
                        func.lower(Report.customer_status).in_(["gelesen", "bestätigt"]),
                    )
                )
                .count()
            )
            reports_unread = max(0, reports_total - reports_opened)
            reports_sent = db.query(Report).filter(Report.sent_at > 0).count()

            month_cursor = datetime(now_dt.year, now_dt.month, 1)
            month_starts = []
            for _ in range(6):
                month_starts.append(month_cursor)
                prev = month_cursor - timedelta(days=1)
                month_cursor = datetime(prev.year, prev.month, 1)
            month_starts.reverse()
            first_month_start = month_starts[0]
            first_month_start_ms = int(first_month_start.timestamp() * 1000)
            month_stats = {
                f"{m.year:04d}-{m.month:02d}": {
                    "key": f"{m.year:04d}-{m.month:02d}",
                    "year": m.year,
                    "month": m.month,
                    "total": 0,
                    "sent": 0,
                    "opened": 0,
                    "unread": 0,
                    "confirmed": 0,
                }
                for m in month_starts
            }
            report_rows = (
                db.query(Report)
                .filter(Report.created_at >= first_month_start_ms)
                .all()
            )
            for report in report_rows:
                created_at = report.created_at or 0
                created_dt = datetime.fromtimestamp(created_at / 1000) if created_at else now_dt
                key = f"{created_dt.year:04d}-{created_dt.month:02d}"
                bucket = month_stats.get(key)
                if not bucket:
                    continue
                is_sent = (report.sent_at or 0) > 0
                is_read = (report.opened_count or 0) > 0 or (
                    (report.customer_status or "").strip().lower() in {"gelesen", "bestätigt"}
                )
                bucket["total"] += 1
                if is_sent:
                    bucket["sent"] += 1
                if is_read:
                    bucket["opened"] += 1
                else:
                    bucket["unread"] += 1
                if (report.customer_status or "").strip() == "Bestätigt":
                    bucket["confirmed"] += 1

        if load_contracts:
            contracts_stats = _build_contracts_stats(db, now_ms)

        if load_sevdesk:
            if not integration_settings:
                integration_settings = IntegrationSettings()
                db.add(integration_settings)
                db.commit()
            sevdesk_config = _build_sevdesk_config(integration_settings, metrics_settings)

    telephony_minutes = 0
    telephony_missed = 0
    if load_telephony:
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
    done_time_today_hours = round(done_elapsed_today / 3600000, 2) if done_elapsed_today else 0
    done_time_week_hours = round(done_elapsed_week / 3600000, 2) if done_elapsed_week else 0
    revenue_estimate_today = (
        round(float(done_time_today_hours) * hourly_rate, 2) if hourly_rate else 0
    )
    revenue_estimate_week = (
        round(float(done_time_week_hours) * hourly_rate, 2) if hourly_rate else 0
    )
    current_week_workdays = max(1, min(5, int(now_dt.weekday()) + 1))
    avg_done_tasks_week = round(float(day_tasks_done_week) / float(current_week_workdays), 1)
    avg_done_hours_week = round(float(done_time_week_hours) / float(current_week_workdays), 2)
    avg_revenue_week = round(float(revenue_estimate_week) / float(current_week_workdays), 2)

    sevdesk_stats: Dict[str, Any] = {"connected": False}
    if load_sevdesk and sevdesk_config and sevdesk_config.api_token:
        try:
            if (load_customers or load_contracts) and not load_billing:
                sevdesk_stats = _build_sevdesk_stats(
                    SevdeskClient(sevdesk_config, timeout=25),
                    now_dt,
                    include_financial_overview=False,
                    invoices_max_pages=60,
                    resolve_contacts_limit=None,
                )
            else:
                sevdesk_stats = _build_sevdesk_stats(
                    SevdeskClient(sevdesk_config),
                    now_dt,
                )
        except SevdeskError as exc:
            sevdesk_stats = {"connected": False, "error": str(exc)}
    if (load_customers or load_contracts) and isinstance(sevdesk_stats, dict):
        customer_rows = sevdesk_stats.get("customerPaymentStats")
        if isinstance(customer_rows, list):
            filtered_rows = _filter_inactive_customer_payment_rows(
                customer_rows,
                inactive_customer_name_keys,
                active_customer_name_keys,
                inactive_customer_number_keys,
                active_customer_number_keys,
            )
            sevdesk_stats["customerPaymentStats"] = filtered_rows
            sevdesk_stats["customerPaymentSummary"] = _summarize_customer_payment_rows(filtered_rows)
        recurring_tag_overview = sevdesk_stats.get("recurringTagOverview")
        recurring_customer_rows = recurring_tag_overview.get("customerRows") if isinstance(recurring_tag_overview, dict) else None
        if isinstance(recurring_customer_rows, list):
            filtered_customer_rows = _filter_inactive_recurring_tag_customer_rows(
                recurring_customer_rows,
                inactive_customer_name_keys,
                active_customer_name_keys,
                inactive_customer_number_keys,
                active_customer_number_keys,
            )
            tag_totals: Dict[str, Dict[str, Any]] = {}
            monthly_total = 0.0
            invoice_count = 0
            for row in filtered_customer_rows:
                monthly_total += float(row.get("monthlyTotalEur") or 0.0)
                invoice_count += int(row.get("invoiceCount") or 0)
                for tag in row.get("tags") or []:
                    key = str(tag.get("tagId") or tag.get("tagName") or "untagged")
                    entry = tag_totals.get(key)
                    if not entry:
                        entry = {
                            "tagId": str(tag.get("tagId") or ""),
                            "tagName": str(tag.get("tagName") or "Ohne Tag"),
                            "monthlyEur": 0.0,
                            "invoiceCount": 0,
                            "customersCount": 0,
                            "_customers": set(),
                        }
                    entry["monthlyEur"] += float(tag.get("monthlyEur") or 0.0)
                    entry["invoiceCount"] += int(tag.get("invoiceCount") or 0)
                    customer_key = str(row.get("contactId") or row.get("customerName") or "")
                    if customer_key:
                        entry["_customers"].add(customer_key)
                    tag_totals[key] = entry
            sevdesk_stats["recurringTagOverview"] = {
                "monthlyTotalEur": round(monthly_total, 2),
                "customersCount": len(filtered_customer_rows),
                "invoiceCount": invoice_count,
                "tagCount": len(tag_totals),
                "tagTotals": sorted(
                    [
                        {
                            "tagId": value["tagId"],
                            "tagName": value["tagName"],
                            "monthlyEur": round(float(value["monthlyEur"] or 0.0), 2),
                            "invoiceCount": int(value["invoiceCount"] or 0),
                            "customersCount": len(value["_customers"]),
                        }
                        for value in tag_totals.values()
                    ],
                    key=lambda item: (-float(item.get("monthlyEur") or 0.0), str(item.get("tagName") or "").lower()),
                ),
                "customerRows": filtered_customer_rows,
            }
    if load_contracts and contracts_stats:
        payment_rows = sevdesk_stats.get("customerPaymentStats") if isinstance(sevdesk_stats, dict) else []
        contracts_stats = _apply_contract_payment_status(
            contracts_stats,
            payment_rows if isinstance(payment_rows, list) else [],
        )

    response: Dict[str, Any] = {}
    if load_general:
        response["taskPerformance"] = {
            "today": {
                "doneCount": int(day_tasks_done_today),
                "doneHours": done_time_today_hours,
                "revenueEur": revenue_estimate_today,
            },
            "week": {
                "doneCount": int(day_tasks_done_week),
                "doneHours": done_time_week_hours,
                "revenueEur": revenue_estimate_week,
                "workdayCount": int(current_week_workdays),
                "averagePerWorkday": {
                    "doneCount": avg_done_tasks_week,
                    "doneHours": avg_done_hours_week,
                    "revenueEur": avg_revenue_week,
                },
            },
        }
        response.update(
            {
                "dayTasks": {
                    "total": day_tasks_total,
                    "open": day_tasks_open,
                    "done": day_tasks_done,
                    "doneToday": day_tasks_done_today,
                    "doneWeek": day_tasks_done_week,
                },
                "timeTracking": {
                    "totalTasks": total_time_tasks,
                    "openTasks": open_time_tasks,
                    "totalHours": total_time_hours,
                    "openHours": open_time_hours,
                    "openMinutes": open_time_minutes,
                    "doneTodayHours": done_time_today_hours,
                    "doneWeekHours": done_time_week_hours,
                },
                "revenueEstimateEur": revenue_estimate,
                "revenueEstimateTodayEur": revenue_estimate_today,
                "revenueEstimateWeekEur": revenue_estimate_week,
                "hourlyRateEur": hourly_rate,
            }
        )
    if load_telephony:
        response["telephony"] = {
            "minutes": telephony_minutes,
            "missed": telephony_missed,
        }
    if load_reports:
        response.update(
            {
                "reports": {
                    "total": reports_total,
                    "sent": reports_sent,
                    "opened": reports_opened,
                    "unread": reports_unread,
                    "confirmed": reports_confirmed,
                },
                "reportsMonthly": list(month_stats.values()),
            }
        )
    if load_sevdesk:
        response["sevdesk"] = sevdesk_stats
    if load_contracts:
        response["contracts"] = contracts_stats
    return response


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

        import smtplib

        msg = _build_smtp_message(
            sender_email=settings.sender_email,
            sender_name=settings.sender_name,
            to=data.to,
            subject=subject,
            text_body=data.text,
            html_body=data.html,
            attachments=data.attachments,
        )

        if settings.use_ssl:
            server = smtplib.SMTP_SSL(settings.host, settings.port or 465, timeout=20)
        else:
            server = smtplib.SMTP(settings.host, settings.port or 587, timeout=20)
        try:
            if settings.use_tls and not settings.use_ssl:
                server.starttls()
            if settings.username:
                server.login(settings.username, settings.password or "")
            server.send_message(msg, from_addr=str(settings.sender_email or "").strip())
        except Exception as exc:  # noqa: BLE001
            logger.exception("SMTP report send failed: %s", exc)
            raise HTTPException(502, f"SMTP send failed: {exc}") from exc
        finally:
            server.quit()

        report.sent_at = int(time.time() * 1000)
        report.sent_via = "smtp"
        report.sent_to = data.to
        db.commit()
        db.refresh(report)
        return serialize_report(report)


@app.post("/api/reports/pdf")
def build_report_pdf(payload: ReportPdfRequest):
    try:
        from weasyprint import HTML  # type: ignore
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(500, f"PDF renderer unavailable: {exc}") from exc
    if not payload.html:
        raise HTTPException(400, "Missing HTML")
    try:
        pdf_bytes = HTML(string=payload.html).write_pdf()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Report PDF render failed: %s", exc)
        raise HTTPException(500, f"PDF render failed: {exc}") from exc
    filename = (payload.filename or "report.pdf").strip() or "report.pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@app.post("/api/offers/send")
def send_offer(data: OfferSendRequest):
    with SessionLocal() as db:
        settings = _get_smtp_settings(db)
        if not settings.host or not settings.sender_email:
            raise HTTPException(400, "SMTP settings missing")
        logger.info("offer_send start offer_id=%s to=%s", data.offer_id, data.to)

        subject = data.subject or "Angebot"
        html = data.html or ""

        import smtplib

        msg = _build_smtp_message(
            sender_email=settings.sender_email,
            sender_name=settings.sender_name,
            to=data.to,
            subject=subject,
            text_body=data.text,
            html_body=html,
            attachments=data.attachments,
        )

        if settings.use_ssl:
            server = smtplib.SMTP_SSL(settings.host, settings.port or 465, timeout=20)
        else:
            server = smtplib.SMTP(settings.host, settings.port or 587, timeout=20)
        try:
            if settings.use_tls and not settings.use_ssl:
                server.starttls()
            if settings.username:
                server.login(settings.username, settings.password or "")
            server.send_message(msg, from_addr=str(settings.sender_email or "").strip())
        finally:
            server.quit()

        sent_at = int(time.time() * 1000)
        if data.offer_id:
            offer = db.query(Offer).get(data.offer_id)
            if offer:
                offer.sent_at = sent_at
                offer.sent_via = "smtp"
                offer.sent_to = data.to
                offer.updated_at = sent_at
                db.commit()

        logger.info("offer_send done offer_id=%s", data.offer_id)
        return {"status": "sent", "sent_at": sent_at}


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
def update_report(
    report_id: int,
    data: ReportUpdate,
    x_write_source: Optional[str] = Header(default=None, alias="X-Write-Source"),
):
    if str(x_write_source or "").strip().lower() == "customer-development":
        raise HTTPException(403, "Direct report writes from customer development are blocked")
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
def edit_report(
    report_id: int,
    data: ReportEdit,
    x_write_source: Optional[str] = Header(default=None, alias="X-Write-Source"),
):
    if str(x_write_source or "").strip().lower() == "customer-development":
        raise HTTPException(403, "Direct report writes from customer development are blocked")
    with SessionLocal() as db:
        report = db.query(Report).get(report_id)
        if not report:
            raise HTTPException(404, "Report not found")
        payload = data.dict(exclude_unset=True, exclude={"items", "customer_id", "third_party_payload"})
        for field, value in payload.items():
            setattr(report, field, value if value is not None else "")
        if data.third_party_payload is not None:
            if isinstance(data.third_party_payload, dict) and data.third_party_payload:
                report.third_party_payload = json.dumps(data.third_party_payload)
            else:
                report.third_party_payload = ""
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
                custom_data = ""
                if isinstance(item.custom_data, dict) and item.custom_data:
                    custom_data = json.dumps(item.custom_data)
                report_item = ReportItem(
                    report_id=report.id,
                    priority=item.priority or "Planbar",
                    title=item.title or "",
                    system=item.system or "",
                    why_text=item.why_text or "",
                    impact=item.impact or "",
                    duration=item.duration or "",
                    cost=item.cost or "",
                    action_type=item.action_type or "standard",
                    custom_html=item.custom_html or "",
                    custom_text=item.custom_text or "",
                    custom_data=custom_data,
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


@app.post("/api/debug/database_maintenance")
def run_database_maintenance():
    started_at = int(time.time() * 1000)
    steps: List[str] = []
    try:
        dialect = str(engine.dialect.name or "").strip().lower()
        autocommit_conn = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
        with autocommit_conn as connection:
            if dialect == "postgresql":
                connection.execute(text("VACUUM (ANALYZE)"))
                steps.append("VACUUM (ANALYZE)")
            elif dialect == "sqlite":
                connection.execute(text("VACUUM"))
                steps.append("VACUUM")
                connection.execute(text("ANALYZE"))
                steps.append("ANALYZE")
            else:
                connection.execute(text("ANALYZE"))
                steps.append("ANALYZE")
        finished_at = int(time.time() * 1000)
        return {
            "status": "ok",
            "dialect": dialect or "unknown",
            "steps": steps,
            "started_at": started_at,
            "finished_at": finished_at,
            "duration_ms": max(0, finished_at - started_at),
        }
    except Exception as exc:
        raise HTTPException(500, f"Database maintenance failed: {exc}") from exc
