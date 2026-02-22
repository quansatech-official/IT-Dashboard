from fastapi import FastAPI, HTTPException, Response, Request, Form, Header
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Tuple, Set
from sqlalchemy import (
    create_engine, Column, Integer, String, Text,
    Boolean, BigInteger, ForeignKey, inspect, text, func, or_
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
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
from email import policy
from email.parser import Parser
import requests
from urllib.parse import quote, urlparse
from datetime import datetime, timedelta, timezone
import logging

from sevdesk_service import SevdeskClient, SevdeskConfig, SevdeskError
# ================= DATABASE =================
DATABASE_URL = os.environ.get("DATABASE_URL") or (
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL") or "http://ollama:11434"
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or "llama3.2:3b"
OLLAMA_TIMEOUT_SECONDS = int(os.environ.get("OLLAMA_TIMEOUT_SECONDS") or "180")
_geo_cache: Dict[str, Optional[tuple[float, float]]] = {}
GEO_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
ROUTE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
SEVDESK_CONTACT_CACHE_TTL_MS = 24 * 60 * 60 * 1000
_sevdesk_contact_cache: Dict[str, Tuple[int, str]] = {}
CUSTOMER_DEVELOPMENT_CACHE_TTL_MS = 5 * 60 * 1000
CUSTOMER_CVE_CACHE_TTL_MS = 30 * 60 * 1000
_customer_development_cache: Dict[str, Dict[str, Any]] = {}
_customer_cve_cache: Dict[int, Dict[str, Any]] = {}

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
logger = logging.getLogger("it_dashboard")
MODEL_PREF_CUSTOMER_RANKING = os.environ.get("OLLAMA_MODEL_PREF_CUSTOMER_RANKING") or OLLAMA_MODEL
MODEL_PREF_TASK_DRAFT = os.environ.get("OLLAMA_MODEL_PREF_TASK_DRAFT") or OLLAMA_MODEL
MODEL_PREF_ACTION = os.environ.get("OLLAMA_MODEL_PREF_ACTION") or OLLAMA_MODEL
MODEL_PREF_OFFER_TEXT = os.environ.get("OLLAMA_MODEL_PREF_OFFER_TEXT") or OLLAMA_MODEL
MODEL_PREF_INVOICE_SUMMARY = os.environ.get("OLLAMA_MODEL_PREF_INVOICE_SUMMARY") or OLLAMA_MODEL
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

Base.metadata.create_all(bind=engine)

def _ensure_purchasing_items_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("purchasing_items"):
        return
    columns = {column["name"] for column in inspector.get_columns("purchasing_items")}
    statements = []
    if "quantity" not in columns:
        statements.append("ALTER TABLE purchasing_items ADD COLUMN quantity VARCHAR DEFAULT ''")
    if "status" not in columns:
        statements.append("ALTER TABLE purchasing_items ADD COLUMN status VARCHAR DEFAULT 'open'")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_ensure_purchasing_items_columns()

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


_ensure_offer_opened_columns()


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


_ensure_report_item_columns()


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


_ensure_customer_columns()


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


_ensure_delivery_note_columns()


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


_ensure_report_columns()


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
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


_ensure_infra_discovery_columns()

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
    randzeit: Optional[bool] = False
    details: Optional[str] = ""
    arrival_time: Optional[str] = ""
    departure_time: Optional[str] = ""
    deadline: Optional[str] = ""
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
    randzeit: Optional[bool] = None
    details: Optional[str] = None
    arrival_time: Optional[str] = None
    departure_time: Optional[str] = None
    deadline: Optional[str] = None
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
    purchasePrice: Optional[str] = ""
    salePrice: Optional[str] = ""


class PurchasingItemUpdate(BaseModel):
    done: Optional[bool] = None
    status: Optional[str] = None
    customer: Optional[str] = None
    title: Optional[str] = None
    sourceUrl: Optional[str] = None
    quantity: Optional[str] = None
    purchasePrice: Optional[str] = None
    salePrice: Optional[str] = None


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


class CustomerMetricsSettingsUpdate(BaseModel):
    office_address: Optional[str] = None
    km_rate_eur: Optional[str] = None
    min_distance_km: Optional[str] = None
    min_fee_eur: Optional[str] = None
    hourly_rate_eur: Optional[str] = None


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


class OfferSendRequest(BaseModel):
    offer_id: Optional[int] = None
    to: str
    subject: Optional[str] = None
    html: str
    text: Optional[str] = None
    attachments: Optional[List[EmailAttachment]] = None


ReportSendRequest.update_forward_refs()


class OfferSaveRequest(BaseModel):
    reference: Optional[str] = ""
    customer: Optional[str] = ""
    status: Optional[str] = ""
    data: Dict[str, Any]


class OfferSaveResponse(BaseModel):
    id: int
    guid: str
    confirm_url: str


class OfferBlocksUpdate(BaseModel):
    serviceBlocks: Optional[List[Dict[str, Any]]] = None
    deviceBlocks: Optional[List[Dict[str, Any]]] = None
    calcBlocks: Optional[List[Dict[str, Any]]] = None


class AiPromptsUpdate(BaseModel):
    action_prompt: Optional[str] = None
    offer_base_prompt: Optional[str] = None
    offer_mode_instructions: Optional[Dict[str, str]] = None


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
    hourly_rate = _parse_float(settings.sevdesk_hourly_rate_eur, default=0.0)
    if metrics and _parse_float(metrics.hourly_rate_eur, default=0.0) > 0:
        hourly_rate = _parse_float(metrics.hourly_rate_eur, default=hourly_rate)

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


def _split_model_list(raw_value: Any) -> List[str]:
    text_value = str(raw_value or "").strip()
    if not text_value:
        return []
    parts = [part.strip() for part in re.split(r"[,\s]+", text_value) if part.strip()]
    return parts


def _resolve_ollama_models(*specific_values: Any) -> List[str]:
    ordered: List[str] = []
    seen = set()
    model_lists = [*specific_values, OLLAMA_MODEL]
    for raw in model_lists:
        for model in _split_model_list(raw):
            lowered = model.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            ordered.append(model)
    if not ordered:
        ordered.append("llama3.2:3b")
    return ordered


def _ollama_generate(
    prompt: str,
    *,
    model_candidates: List[str],
    timeout: Optional[int] = None,
    response_format: str = "",
    temperature: Optional[float] = None,
) -> Tuple[Dict[str, Any], str]:
    request_timeout = max(1, int(timeout or OLLAMA_TIMEOUT_SECONDS))
    for model in model_candidates:
        payload: Dict[str, Any] = {"model": model, "prompt": prompt, "stream": True}
        if response_format:
            payload["format"] = response_format
        if temperature is not None:
            payload["options"] = {"temperature": temperature}
        try:
            with requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
                timeout=request_timeout,
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
        except requests.HTTPError as exc:
            response = exc.response
            if response is not None and response.status_code == 404:
                detail = (response.text or "").strip()
                logger.warning(
                    "Ollama model missing for %s (404). Pull it first. Response: %s",
                    model,
                    detail[:240],
                )
            else:
                logger.warning("Ollama request failed with model %s: %s", model, exc)
            continue
        except requests.RequestException as exc:
            logger.warning("Ollama request failed with model %s: %s", model, exc)
            continue
        if isinstance(data, dict):
            return data, model
        logger.warning("Ollama response malformed with model %s", model)
    return {}, ""


def _ollama_generate_text(prompt: str) -> str:
    model_candidates = _resolve_ollama_models(MODEL_PREF_INVOICE_SUMMARY)
    data, _ = _ollama_generate(prompt, model_candidates=model_candidates)
    return (data.get("response") or "").strip()


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
        return f"{title}. Notiz: {details}"
    return title or details or ""


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
        entry = stats.get(contact_id)
        if not entry:
            entry = {
                "name": contact_name,
                "contactId": contact_id,
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
    summary = _ollama_generate_text(prompt)
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
    allowed = {"monitoring", "wartung"}
    normalized: List[str] = []
    seen = set()
    for value in flags:
        key = re.sub(r"[^a-z0-9]+", "", str(value or "").strip().lower())
        if key in {"maintenance", "wartungsvertrag"}:
            key = "wartung"
        if key in {"monitoringvertrag", "rmm"}:
            key = "monitoring"
        if key in {"servicelevelagreement", "sla"}:
            key = "wartung"
        if key not in allowed or key in seen:
            continue
        seen.add(key)
        normalized.append(key)
    return normalized


def _parse_contract_flags(raw: Optional[str]) -> List[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return _normalize_contract_flags(parsed if isinstance(parsed, list) else [])


def serialize_customer(c: Customer) -> Dict[str, Any]:
    contract_flags = _parse_contract_flags(c.contract_flags)
    return {
        "id": c.id,
        "name": c.name,
        "creditor_number": c.creditor_number,
        "short_code": c.short_code,
        "email": c.email,
        "time_tracking_enabled": c.time_tracking_enabled,
        "customer_report": c.customer_report,
        "newsletter": c.newsletter,
        "status": (c.status or "active").strip().lower() or "active",
        "maintenance_contract": bool(c.maintenance_contract) or ("wartung" in contract_flags),
        "contract_flags": contract_flags,
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

def serialize_integration_settings(settings: IntegrationSettings) -> Dict[str, Any]:
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
            "cover_intro": "Schreibe einen kurzen Deckblatt-Introtext (2-4 Saetze).",
            "overview": "Schreibe einen kurzen Ueberblick fuer den Kunden (2-4 Saetze oder kurze Stichpunkte).",
            "calculation": "Schreibe kurze Hinweise zur Kalkulation (1-3 Saetze).",
            "position_text": (
                "Erstelle einen sehr kurzen, professionellen Positionstext "
                "(1-2 kurze Saetze). Integriere Aufgaben-Titel und Notiz "
                "klar und sachlich. Kein Aufsatz, keine Einleitung."
            ),
            "device_description": "Schreibe eine kurze Produktbeschreibung fuer Material (3-6 Saetze).",
        },
    }


def _get_ai_prompt_settings(db) -> AiPromptSettings:
    store = db.query(AiPromptSettings).first()
    if not store:
        store = AiPromptSettings(data_json=json.dumps(_default_ai_prompts()))
        db.add(store)
        db.commit()
        db.refresh(store)
    return store


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
    return {
        "action_prompt": data.get("action_prompt", defaults["action_prompt"]),
        "offer_base_prompt": data.get("offer_base_prompt", defaults["offer_base_prompt"]),
        "offer_mode_instructions": merged_modes,
        "updated_at": _offer_iso_timestamp(store.updated_at),
    }


def _render_prompt(template: str, values: Dict[str, str]) -> str:
    text = template or ""
    for key, value in values.items():
        text = text.replace(f"{{{key}}}", value)
    return text

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


def _offer_iso_timestamp(ms: int) -> str:
    if not ms:
        return ""
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def _offer_make_reference(number_format: str, index: int) -> str:
    template = (number_format or "AN-XXXX").strip() or "AN-XXXX"
    match = re.search(r"X+", template)
    if not match:
        return template
    width = len(match.group(0))
    number = str(max(1, int(index or 1))).zfill(width)
    start, end = match.span()
    return f"{template[:start]}{number}{template[end:]}"


def _normalize_offer_references(db) -> int:
    settings = _get_offer_settings(db)
    number_format = (settings.offer_number_format or "AN-XXXX").strip() or "AN-XXXX"
    offers = db.query(Offer).order_by(Offer.created_at.asc(), Offer.id.asc()).all()
    if not offers:
        return 0
    changed = 0
    now_ms = int(time.time() * 1000)
    for idx, offer in enumerate(offers, start=1):
        expected = _offer_make_reference(number_format, idx)
        payload: Dict[str, Any] = {}
        if offer.data_json:
            try:
                parsed = json.loads(offer.data_json)
                if isinstance(parsed, dict):
                    payload = parsed
            except Exception:
                payload = {}
        data_reference = str(payload.get("reference") or "").strip()
        if offer.reference == expected and data_reference == expected:
            continue
        offer.reference = expected
        payload["reference"] = expected
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
        model_candidates = _resolve_ollama_models(
            MODEL_PREF_CUSTOMER_RANKING,
            MODEL_PREF_TASK_DRAFT,
        )
        payload, used_model = _ollama_generate(
            prompt,
            model_candidates=model_candidates,
            response_format="json",
            temperature=0.05,
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
        customer_email = str(customer.email or "").strip().lower()
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
        model_candidates = _resolve_ollama_models(MODEL_PREF_TASK_DRAFT)
        payload, used_model = _ollama_generate(
            prompt,
            model_candidates=model_candidates,
            response_format="json",
            temperature=0.15,
        )
        if not payload:
            raise RuntimeError("No Ollama response")
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
    return agents if isinstance(agents, list) else [], True


def _build_tactical_rmm_session(settings: Optional[IntegrationSettings]) -> Tuple[Optional[requests.Session], str]:
    if not settings:
        return None, ""
    host = str(settings.rmm_host or "").strip().rstrip("/")
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
    host = str(settings.rmm_host or "").strip().rstrip("/")
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

    session = requests.Session()
    session.headers.update({"User-Agent": "QT-Workbench"})
    header_value = api_key
    if api_key_header.lower() == "authorization" and not re.match(r"^(bearer|token)\s+", api_key, re.IGNORECASE):
        header_value = f"Bearer {api_key}"
    session.headers.update({api_key_header: header_value})
    # TacticalRMM expects X-API-KEY. Keep it as compatibility fallback.
    if api_key_header.lower() != "x-api-key":
        session.headers.update({"X-API-KEY": api_key})

    # TacticalRMM docs use API base + /agents/ with X-API-KEY header.
    list_candidates = [
        "/agents/?detail=true",
        "/agents/?detail=false",
        "/agents/",
        "/agents",
        "/clients/",
        # Compatibility fallback for older/custom deployments.
        "/api/v3/agents/",
        "/api/v3/agents",
    ]
    agents_path = ""
    agents_status_code = None
    agents_error = ""
    for path in list_candidates:
        agents_path = path
        try:
            res = session.get(_tactical_url(host, path), timeout=8)
            agents_status_code = res.status_code
        except requests.RequestException as exc:
            agents_error = str(exc)
            continue
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
        if isinstance(payload, list):
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
                "sampleCount": len(payload),
                "agents": payload,
                "error": "",
            }
        if isinstance(payload, dict):
            for key in ("results", "agents", "data"):
                value = payload.get(key)
                if isinstance(value, list):
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
                        "sampleCount": len(value),
                        "agents": value,
                        "error": "",
                    }
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
            f"/api/v3/agents/{quote(clean_id)}/",
            f"/api/v3/agents/{quote(clean_id)}",
        ):
            try:
                res = session.get(_tactical_url(host, path), timeout=8)
            except requests.RequestException:
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


def _fetch_tactical_rmm_software(
    settings: Optional[IntegrationSettings],
    agent_ids: List[str],
    per_agent_limit: int = 80,
) -> List[Dict[str, Any]]:
    session, host = _build_tactical_rmm_session(settings)
    if not session or not host:
        return []
    rows: List[Dict[str, Any]] = []
    for agent_id in agent_ids[:25]:
        if not agent_id:
            continue
        candidates = [
            f"/software/{agent_id}/",
            f"/software/{agent_id}",
            f"/api/v3/software/{agent_id}/",
            f"/api/v3/software/{agent_id}",
            f"/agents/{agent_id}/software/",
            f"/agents/{agent_id}/software",
            f"/api/v3/agents/{agent_id}/software/",
            f"/api/v3/agents/{agent_id}/software",
            f"/software/?agent={quote(agent_id)}",
            f"/software?agent={quote(agent_id)}",
            f"/software/?agent_id={quote(agent_id)}",
            f"/software?agent_id={quote(agent_id)}",
            f"/api/v3/software/?agent={quote(agent_id)}",
            f"/api/v3/software?agent={quote(agent_id)}",
            f"/api/v3/software/?agent_id={quote(agent_id)}",
            f"/api/v3/software?agent_id={quote(agent_id)}",
        ]
        payload = None
        used_path = ""
        for path in candidates:
            try:
                res = session.get(_tactical_url(host, path), timeout=8)
            except requests.RequestException:
                continue
            if not res.ok:
                continue
            try:
                data = res.json()
            except ValueError:
                continue
            payload = data
            used_path = path
            break
        if payload is None:
            logger.info("RMM software inventory empty for agent %s: no endpoint matched", agent_id)
            continue
        items: List[Any] = []
        if isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict):
            for key in ("results", "software", "items", "data"):
                value = payload.get(key)
                if isinstance(value, list):
                    items = value
                    break
        if not isinstance(items, list):
            continue
        logger.info(
            "RMM software inventory for agent %s via %s: %s items",
            agent_id,
            used_path or "unknown",
            len(items),
        )
        for item in items[:per_agent_limit]:
            if not isinstance(item, dict):
                continue
            name = str(
                item.get("name")
                or item.get("software")
                or item.get("product")
                or item.get("display_name")
                or item.get("app_name")
                or ""
            ).strip()
            version = str(item.get("version") or item.get("display_version") or "").strip()
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


def _nvd_lookup(name: str, version: str) -> List[Dict[str, Any]]:
    term = f"{name} {version}".strip()
    if not term:
        return []
    url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
    try:
        res = requests.get(
            url,
            params={"keywordSearch": term, "resultsPerPage": 5},
            timeout=8,
        )
        if not res.ok:
            return []
        data = res.json()
    except Exception:
        return []
    vulns = data.get("vulnerabilities")
    if not isinstance(vulns, list):
        return []
    rows: List[Dict[str, Any]] = []
    for row in vulns[:5]:
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
    return rows


def _osv_fixed_versions(name: str, version: str) -> List[str]:
    payload = {
        "version": str(version or ""),
        "package": {"name": str(name or "")},
    }
    try:
        res = requests.post("https://api.osv.dev/v1/query", json=payload, timeout=8)
        if not res.ok:
            return []
        data = res.json()
    except Exception:
        return []
    vulns = data.get("vulns")
    if not isinstance(vulns, list):
        return []
    fixed: List[str] = []
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
    unique = sorted(set(fixed), key=_safe_version_key)
    return unique[-3:]


def _extract_customer_number_from_contact(contact: Dict[str, Any]) -> str:
    for key in ("customerNumber", "customernumber", "number"):
        value = str(contact.get(key) or "").strip()
        if value:
            return value
    return ""


def _normalize_customer_number(value: Any) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    # Match customer numbers resilient against separators/spacing changes.
    return re.sub(r"[^A-Za-z0-9]+", "", raw).upper()


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
    terms = _dev_customer_match_terms(customer)
    if not terms:
        return False
    searchable = " ".join(
        [
            _agent_field_text(agent, "site", "site_name"),
            _agent_field_text(agent, "client", "client_name", "customer"),
            _agent_field_text(agent, "hostname", "name"),
        ]
    )
    haystack = _dev_normalize_text(searchable)
    return any(term and term in haystack for term in terms)


def _build_customer_development_context(
    db,
    customer: Customer,
    now_ms: int,
    sevdesk_rows: List[Dict[str, Any]],
    tactical_agents: List[Dict[str, Any]],
    full: bool,
) -> Dict[str, Any]:
    contract_flags = _parse_contract_flags(customer.contract_flags)
    has_contract = bool(customer.maintenance_contract) or bool(
        set(contract_flags) & {"wartung", "monitoring"}
    )
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
    comm_load = round(float(telephony["minutes"]) + float(telephony["missed"]) * 5.0, 1)

    matched_sevdesk = _match_sevdesk_row(customer, sevdesk_rows)
    revenue_current_year = float(matched_sevdesk.get("revenueCurrentYearEur") or 0) if matched_sevdesk else 0.0
    revenue_last_year = float(matched_sevdesk.get("revenueLastYearEur") or 0) if matched_sevdesk else 0.0
    revenue_trend_pct = 0.0
    if revenue_last_year > 0:
        revenue_trend_pct = round(((revenue_current_year - revenue_last_year) / revenue_last_year) * 100.0, 1)
    elif revenue_current_year > 0:
        revenue_trend_pct = 100.0

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
    discovered_total = len(customer_discovery_rows)
    discovered_unmanaged = sum(1 for row in customer_discovery_rows if not bool(row.managed))

    managed_agents = [agent for agent in tactical_agents if _agent_matches_customer(agent, customer)]
    if full and managed_agents:
        managed_agent_ids = [_extract_agent_id(agent) for agent in managed_agents if _extract_agent_id(agent)]
        if managed_agent_ids:
            integration = db.query(IntegrationSettings).first()
            managed_agent_details = _fetch_tactical_rmm_agent_detail_map(integration, managed_agent_ids)
            managed_agents = [{**agent, **(managed_agent_details.get(_extract_agent_id(agent), {}))} for agent in managed_agents]
    managed_count = len(managed_agents)
    offline_count = sum(1 for agent in managed_agents if not _agent_is_online(agent))
    offline_rate = round((offline_count / managed_count), 2) if managed_count else 0.0
    discovered_base = discovered_total if discovered_total > 0 else managed_count
    coverage_ratio = round((managed_count / discovered_base), 2) if discovered_base > 0 else 0.0
    unmanaged_count = max(discovered_base - managed_count, 0) + discovered_unmanaged

    business_risk = 0
    infra_risk = 0
    signals: List[str] = []
    recommendations: List[Dict[str, str]] = []

    if not has_contract:
        business_risk += 20
        signals.append("Kein Wartungs-/Monitoringvertrag hinterlegt")
        recommendations.append(
            {"type": "betreuung", "title": "Vertragslage prüfen", "why": "Kein Wartungs- oder Monitoringvertrag im Kundenstamm."}
        )
    # Engagement-Signale: viele kleine Anfragen und regelmäßige Kommunikation
    # sind typischerweise positiv und sollen nicht als Risiko gewertet werden.
    interaction_load = open_day_tasks + open_time_tasks
    is_engaged_customer = (
        comm_load >= 90
        or telephony["calls"] >= 8
        or interaction_load >= 4
    )
    if is_engaged_customer:
        business_risk = max(0, business_risk - 12)
        signals.append("Aktive Kundeninteraktion (regelmäßige Anfragen)")
        if not has_contract:
            recommendations.append(
                {
                    "type": "betreuung",
                    "title": "Aktive Betreuung vertraglich absichern",
                    "why": "Der Kunde nutzt Leistungen regelmäßig, aber ohne Wartungs-/Monitoringvertrag.",
                }
            )

    # Umsatztrend nur dann als Risiko nutzen, wenn zusätzlich wenig Bindungsaktivität vorliegt.
    trend_drop_is_strong = revenue_trend_pct <= -35
    is_high_value_customer = revenue_last_year >= 8000 or revenue_current_year >= 8000
    low_current_revenue = revenue_current_year <= 2500
    weak_binding_signals = (
        not is_engaged_customer
        and interaction_load < 3
        and telephony["calls"] < 4
        and telephony["missed"] < 3
    )
    if trend_drop_is_strong and low_current_revenue and not has_contract and weak_binding_signals:
        business_risk += 12
        signals.append(f"Umsatzprofil rückläufig ({revenue_trend_pct}%)")
        recommendations.append(
            {
                "type": "betreuung",
                "title": "Reaktivierungs-Check einplanen",
                "why": "Deutlicher Rückgang bei gleichzeitig geringer Interaktion.",
            }
        )
    elif trend_drop_is_strong and is_high_value_customer:
        signals.append("Umsatzprofil volatil (möglicher Einmaleffekt)")
    if interaction_load >= 8:
        business_risk += 10
        signals.append("Viele offene Aufgaben")
        recommendations.append(
            {"type": "betreuung", "title": "Offene Aufgaben bündeln", "why": "Mehrere offene Punkte beim Kunden."}
        )

    if unmanaged_count > 0:
        infra_risk += 35
        signals.append(f"Unmanaged Geräte erkannt ({unmanaged_count})")
        recommendations.append(
            {"type": "security", "title": "Unmanaged Geräte inventarisieren", "why": "Erkannte Geräte sind nicht vollständig im RMM."}
        )
    if discovered_base > 0 and coverage_ratio < 0.7:
        infra_risk += 25
        signals.append(f"Niedrige RMM-Abdeckung ({int(coverage_ratio * 100)}%)")
        recommendations.append(
            {"type": "lifecycle", "title": "RMM-Abdeckung erhöhen", "why": "Managed/Discovered Verhältnis ist niedrig."}
        )
    if managed_count > 0 and offline_rate >= 0.3:
        infra_risk += 25
        signals.append(f"Viele Offline-Agents ({int(offline_rate * 100)}%)")
        recommendations.append(
            {"type": "security", "title": "Offline-Agents prüfen", "why": "Ein signifikanter Teil meldet sich nicht."}
        )

    total_risk = min(100, business_risk + infra_risk)
    development_state = "INACTIVE" if (customer.status or "active").lower() == "inactive" else _dev_score_to_state(total_risk)
    priority_score = round(total_risk + min(20.0, revenue_current_year / 10000.0), 1)
    top_recommendations = recommendations[:3]

    light = {
        "customerId": customer.id,
        "customerName": customer.name or "",
        "customerNumber": customer.creditor_number or "",
        "status": (customer.status or "active").lower(),
        "hasMaintenanceContract": has_contract,
        "contractFlags": contract_flags,
        "revenueCurrentYearEur": round(revenue_current_year, 2),
        "revenueLastYearEur": round(revenue_last_year, 2),
        "revenueTrendPct": revenue_trend_pct,
        "ticketLoad": open_day_tasks + open_time_tasks,
        "openTimeMinutes": open_time_minutes,
        "communicationFrequency": telephony["calls"],
        "communicationLoad": comm_load,
        "missedCalls": telephony["missed"],
        "infra": {
            "managedAssets": managed_count,
            "discoveredAssets": discovered_base,
            "coverageRatio": coverage_ratio,
            "offlineRate": offline_rate,
            "unmanagedCount": unmanaged_count,
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
    for agent in managed_agents:
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
            }
        )
    discovered_devices = []
    for row in customer_discovery_rows:
        evidence_payload: List[str] = []
        try:
            parsed_evidence = json.loads(row.evidence or "[]")
            if isinstance(parsed_evidence, list):
                evidence_payload = [str(item).strip() for item in parsed_evidence if str(item).strip()]
        except Exception:
            evidence_payload = []
        discovered_devices.append(
            {
                "source": str(row.source or "discovery").strip() or "discovery",
                "hostname": str(row.hostname or "").strip(),
                "ip": str(row.ip or "").strip(),
                "mac": str(row.mac or "").strip(),
                "protocol": str(row.protocol or "").strip(),
                "deviceType": str(row.device_type or "").strip(),
                "vendor": str(row.vendor or "").strip(),
                "confidence": int(row.confidence or 0),
                "evidence": evidence_payload,
                "managed": bool(row.managed),
                "lastSeenAt": int(row.last_seen_at or 0),
            }
        )
    light["recommendations"] = recommendations
    light["telephony"] = telephony
    light["reasons"] = signals
    light["managedInfrastructureDevices"] = managed_devices
    light["discoveredInfrastructureDevices"] = discovered_devices
    light["infrastructureDevices"] = managed_devices + discovered_devices
    light["source"] = {
        "sevdesk": bool(sevdesk_rows),
        "tacticalRmm": bool(tactical_agents),
        "discovery": discovered_total,
    }
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


def _customer_development_ai_prompt(context: Dict[str, Any], mode: str, tone: str) -> str:
    customer_name = str(context.get("customerName") or "Kunde")
    state = str(context.get("developmentState") or "STABLE")
    risk = int(context.get("riskScore") or 0)
    trend = float(context.get("revenueTrendPct") or 0)
    infra = context.get("infra") or {}
    recommendations = context.get("recommendations") or context.get("topRecommendations") or []
    recommendation_lines = []
    for rec in recommendations[:5]:
        title = str(rec.get("title") or "").strip()
        why = str(rec.get("why") or "").strip()
        if title:
            recommendation_lines.append(f"- {title}: {why}")
    if not recommendation_lines:
        recommendation_lines.append("- Keine konkreten Empfehlungen vorhanden.")
    signals = context.get("signals") or context.get("reasons") or []
    signal_lines = [f"- {str(item).strip()}" for item in signals[:6] if str(item).strip()] or ["- Keine kritischen Signale."]
    mode_key = str(mode or "summary").strip().lower()
    tone_key = str(tone or "sachlich").strip()

    if mode_key == "mail":
        task_text = (
            "Erstelle eine kurze Kundenmail (Deutsch) mit Betreffzeile und Nachrichtentext. "
            "Ziel: proaktiv Betreuung anbieten und nächste Schritte vorschlagen."
        )
    elif mode_key == "angebot":
        task_text = (
            "Erstelle 3 plausible, konkret verkaufbare Angebotsvorschläge (Deutsch) "
            "für diesen Kunden. Pro Vorschlag: Titel, Nutzen, grober Umfang, nächste Aktion."
        )
    elif mode_key == "kundenbericht":
        task_text = (
            "Erstelle 3 spezifische Vorschläge, die im nächsten Kundenbericht gezeigt werden sollen "
            "(Deutsch): Problembezug, warum jetzt, empfohlene Maßnahme."
        )
    elif mode_key == "newsletter":
        task_text = (
            "Erstelle 3 allgemein nutzbare Newsletter-Themen (Deutsch), "
            "die aus den Kundensignalen ableitbar sind. Je Thema: Überschrift + 2-3 Sätze."
        )
    elif mode_key == "leitfaden":
        task_text = (
            "Erstelle einen Gesprächsleitfaden (Deutsch) mit 5-7 Stichpunkten "
            "für ein Kundengespräch inkl. Abschlussfrage."
        )
    elif mode_key == "analyse":
        task_text = (
            "Erstelle eine strukturierte Kundenanalyse (Deutsch) in 5 Abschnitten: "
            "1) Kurzlage, 2) Chancen, 3) Risiken, 4) Priorisierte Maßnahmen (Top 3), "
            "5) Empfohlener nächster Termin/Touchpoint."
        )
    else:
        task_text = (
            "Erstelle eine kompakte Management-Zusammenfassung (Deutsch, 4-6 Sätze) "
            "mit klarer Priorisierung und nächster Aktion."
        )

    return (
        f"{task_text}\n"
        f"Ton: {tone_key}\n\n"
        f"Kunde: {customer_name}\n"
        f"Status: {state}\n"
        f"Risiko: {risk}/100\n"
        f"Umsatztrend: {trend:+.1f}%\n"
        f"Infrastruktur: Coverage {int(float(infra.get('coverageRatio') or 0) * 100)}%, "
        f"Unmanaged {int(infra.get('unmanagedCount') or 0)}, "
        f"Offline-Rate {int(float(infra.get('offlineRate') or 0) * 100)}%\n\n"
        f"Signale:\n{chr(10).join(signal_lines)}\n\n"
        f"Empfehlungen:\n{chr(10).join(recommendation_lines)}\n\n"
        "Antwort als reiner Text, kein JSON, kein Markdown."
    )


def _customer_development_ai_fallback(context: Dict[str, Any], mode: str) -> str:
    mode_key = str(mode or "summary").strip().lower()
    customer_name = str(context.get("customerName") or "Kunde")
    infra = context.get("infra") or {}
    unmanaged = int(infra.get("unmanagedCount") or 0)
    coverage = int(float(infra.get("coverageRatio") or 0) * 100)
    missed = int(context.get("missedCalls") or 0)
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
        return (
            f"Angebot 1: {top[0]} – kompaktes Maßnahmenpaket mit klarer Priorisierung.\n"
            f"Angebot 2: Infrastruktur-Basispaket – Asset-Abgleich, Coverage-Plan (aktuell {coverage}%), Übergabebericht.\n"
            "Angebot 3: Betreuungs-/SLA-Paket – definierte Reaktionszeiten und regelmäßige Service-Reviews."
        )
    return (
        f"Kurzlage {customer_name}: Priorität bei {top[0]}. "
        f"Infrastruktur: {unmanaged} unmanaged Geräte, Coverage {coverage}%. "
        "Nächster Schritt: konkrete Maßnahme terminieren."
    )


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
        return [serialize_customer(c) for c in customers]


@app.get("/api/customer_development")
def get_customer_development(include_inactive: bool = False, full: bool = False, refresh: bool = False):
    return _build_customer_development_payload(
        include_inactive=include_inactive,
        full=full,
        refresh=refresh,
    )


@app.get("/api/customers/{customer_id}/development")
def get_customer_development_for_customer(customer_id: int, refresh: bool = False):
    payload = _build_customer_development_payload(
        include_inactive=True,
        customer_id=customer_id,
        full=True,
        refresh=refresh,
    )
    contexts = payload.get("contexts") or []
    if not contexts:
        raise HTTPException(404, "Customer not found")
    return contexts[0]


@app.get("/api/customers/{customer_id}/development/cve_scan")
def get_customer_development_cve_scan(customer_id: int, refresh: bool = False):
    now_ms = int(time.time() * 1000)
    cached = _customer_cve_cache.get(int(customer_id))
    if not refresh and cached and now_ms - int(cached.get("cachedAt") or 0) < CUSTOMER_CVE_CACHE_TTL_MS:
        payload = cached.get("payload")
        if isinstance(payload, dict):
            payload["fromCache"] = True
            return payload

    with SessionLocal() as db:
        customer = db.query(Customer).get(customer_id)
        if not customer:
            raise HTTPException(404, "Customer not found")
        integration = db.query(IntegrationSettings).first()
        tactical_agents, tactical_connected = _fetch_tactical_rmm_agents(integration)
        matched_agents = [agent for agent in tactical_agents if _agent_matches_customer(agent, customer)]
        agent_ids = [_extract_agent_id(agent) for agent in matched_agents if _extract_agent_id(agent)]
        if agent_ids:
            detail_map = _fetch_tactical_rmm_agent_detail_map(integration, agent_ids)
            matched_agents = [{**agent, **(detail_map.get(_extract_agent_id(agent), {}))} for agent in matched_agents]
        software_rows = _fetch_tactical_rmm_software(integration, agent_ids, per_agent_limit=80)

    agent_meta: Dict[str, Dict[str, Any]] = {}
    for agent in matched_agents:
        agent_id = _extract_agent_id(agent)
        if not agent_id:
            continue
        agent_meta[agent_id] = {
            "agentId": agent_id,
            "hostname": _agent_field_text(agent, "hostname", "name"),
            "site": _agent_field_text(agent, "site", "site_name"),
            "client": _agent_field_text(agent, "client", "client_name", "customer"),
            "online": bool(_agent_is_online(agent)),
            "os": _agent_field_text(agent, "operating_system", "operatingSystem", "plat_name", "plat", "platform", "os"),
            "version": _agent_field_text(agent, "version", "agent_version", "agentVersion"),
            "lastSeen": _agent_field_text(agent, "last_seen", "last_seen_time", "lastseen", "last_checkin", "last_ping"),
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
    ordered_agent_ids: List[str] = []
    for agent in matched_agents:
        agent_id = _extract_agent_id(agent)
        if agent_id and agent_id not in ordered_agent_ids:
            ordered_agent_ids.append(agent_id)
    scanned = 0
    for agent_id in ordered_agent_ids:
        software_map = per_agent_software.get(agent_id, {})
        software_list = list(software_map.values())[:20]
        agent_findings: List[Dict[str, Any]] = []
        for item in software_list[:12]:
            scanned += 1
            name = str(item.get("name") or "").strip()
            version = str(item.get("version") or "").strip()
            cves = _nvd_lookup(name, version)
            fixed_versions = _osv_fixed_versions(name, version)
            if not cves and not fixed_versions:
                continue
            agent_findings.append(
                {
                    "name": name,
                    "version": version,
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
        meta = agent_meta.get(agent_id, {"agentId": agent_id, "hostname": "", "site": "", "client": "", "online": None})
        agents_payload.append(
            {
                **meta,
                "softwareCount": len(software_list),
                "findingCount": len(agent_findings),
                "findings": agent_findings,
            }
        )
    agents_payload.sort(key=lambda row: (-(row.get("findingCount") or 0), str(row.get("hostname") or "")))
    payload = {
        "customerId": customer_id,
        "scannedSoftware": scanned,
        "matchedAgents": len(agent_ids),
        "rmmConnected": bool(tactical_connected),
        "agents": agents_payload,
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
    if not matched_agents:
        raise HTTPException(404, "No matching RMM agent for this customer")
    matched_agents.sort(key=lambda agent: (not _agent_is_online(agent), str(agent.get("hostname") or "")))
    target_agent = matched_agents[0]
    target_agent_id = _extract_agent_id(target_agent)
    if not target_agent_id:
        raise HTTPException(404, "Matched RMM agent has no agent id")

    scripts_payload: Optional[List[Dict[str, Any]]] = None
    for path in ("/scripts/", "/scripts", "/api/v3/scripts/", "/api/v3/scripts"):
        try:
            scripts_res = session.get(_tactical_url(host, path), timeout=25)
        except Exception:
            continue
        if not scripts_res.ok:
            continue
        try:
            raw_payload = scripts_res.json()
        except Exception:
            continue
        if isinstance(raw_payload, list):
            scripts_payload = [item for item in raw_payload if isinstance(item, dict)]
            break
        if isinstance(raw_payload, dict):
            for key in ("results", "scripts", "data"):
                maybe_list = raw_payload.get(key)
                if isinstance(maybe_list, list):
                    scripts_payload = [item for item in maybe_list if isinstance(item, dict)]
                    break
            if scripts_payload is not None:
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
        api_base = str(request.base_url).rstrip("/")
        api_url = f"{api_base}/api"
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
    run_payload = {
        "output": "wait",
        "emails": [],
        "emailMode": "default",
        "custom_field": None,
        "save_all_output": False,
        "script": script_id,
        "args": args,
        "env_vars": [],
        "run_as_user": False,
        "timeout": 1500,
    }

    def _trigger_discovery_background() -> None:
        bg_session, bg_host = _build_tactical_rmm_session(integration)
        if not bg_session or not bg_host:
            logger.warning("Discovery background trigger failed: missing RMM session/host")
            return
        run_error = ""
        for path in (
            f"/agents/{quote(target_agent_id)}/runscript/",
            f"/agents/{quote(target_agent_id)}/runscript",
            f"/api/v3/agents/{quote(target_agent_id)}/runscript/",
            f"/api/v3/agents/{quote(target_agent_id)}/runscript",
        ):
            try:
                run_res = bg_session.post(_tactical_url(bg_host, path), json=run_payload, timeout=1800)
            except Exception as exc:
                run_error = str(exc)
                continue
            if not run_res.ok:
                run_error = f"HTTP {run_res.status_code} on {path}"
                continue
            logger.info("Discovery run triggered for customer %s via %s", customer.id, path)
            return
        logger.warning(
            "Discovery background trigger failed for customer %s agent %s: %s",
            customer.id,
            target_agent_id,
            run_error or "unknown API error",
        )

    threading.Thread(target=_trigger_discovery_background, daemon=True).start()
    logger.info(
        "Discovery queued for customer %s on agent %s using api_url=%s",
        customer.id,
        target_agent_id,
        api_url,
    )

    return {
        "status": "queued",
        "customerId": customer.id,
        "customerName": customer.name or "",
        "agentId": target_agent_id,
        "agentHostname": str(target_agent.get("hostname") or target_agent.get("name") or "").strip(),
        "scriptId": script_id,
        "scriptName": str(target_script.get("name") or "").strip(),
        "apiUrl": api_url,
        "rmmResponse": {},
    }


@app.post("/api/customer_development/ai_assist")
def customer_development_ai_assist(data: CustomerDevelopmentAiRequest):
    mode = str(data.mode or "summary").strip().lower()
    if mode not in {"summary", "mail", "leitfaden", "analyse", "angebot", "kundenbericht", "newsletter"}:
        mode = "summary"

    if mode == "newsletter":
        payload = _build_customer_development_payload(include_inactive=False, full=False)
        contexts = payload.get("contexts") or []
        if not contexts:
            raise HTTPException(404, "No customer contexts available")
        top = contexts[:10]
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
            f"Ton: {str(data.tone or 'sachlich')}\n"
            f"Durchschnittliches Risiko (Top-Kunden): {avg_risk}\n"
            "Haeufige Signale:\n"
            + "\n".join([f"- {name} ({count}x)" for name, count in signal_lines])
            + "\nAntwort als reiner Text, kein JSON, kein Markdown."
        )
        text_result = _ollama_generate_text(prompt).strip()
        if not text_result:
            text_result = _customer_development_ai_fallback(top[0], mode)
        return {
            "customer_id": None,
            "mode": mode,
            "tone": str(data.tone or "sachlich"),
            "text": text_result,
            "generated_at": int(time.time() * 1000),
        }

    if data.customer_id is None:
        raise HTTPException(400, "customer_id required for this mode")
    payload = _build_customer_development_payload(
        include_inactive=True,
        customer_id=int(data.customer_id),
        full=True,
    )
    contexts = payload.get("contexts") or []
    if not contexts:
        raise HTTPException(404, "Customer not found")
    context = contexts[0]
    mode = str(data.mode or "summary").strip().lower()
    prompt = _customer_development_ai_prompt(context, mode=mode, tone=str(data.tone or "sachlich"))
    text_result = _ollama_generate_text(prompt).strip()
    if not text_result:
        text_result = _customer_development_ai_fallback(context, mode)
    return {
        "customer_id": int(data.customer_id) if data.customer_id is not None else None,
        "mode": mode,
        "tone": str(data.tone or "sachlich"),
        "text": text_result,
        "generated_at": int(time.time() * 1000),
    }


@app.post("/api/customer_development/report_suggestion_preview")
def customer_development_report_suggestion_preview(
    data: CustomerDevelopmentReportSuggestionPreviewRequest,
):
    payload = _build_customer_development_payload(
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
    payload = _build_customer_development_payload(
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
                if changed:
                    updated += 1
                continue
            created_customer = Customer(
                name=name or f"Kunde {number}",
                creditor_number=number or "",
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

            seen_at = int(item.seen_at or now_ms)
            existing = (
                db.query(InfraDiscoveryDevice)
                .filter(
                    func.lower(func.trim(InfraDiscoveryDevice.source))
                    == func.lower(func.trim(item.source or "agent")),
                    func.lower(func.trim(InfraDiscoveryDevice.ip))
                    == func.lower(func.trim(item.ip or "")),
                    func.lower(func.trim(InfraDiscoveryDevice.mac))
                    == func.lower(func.trim(item.mac or "")),
                    InfraDiscoveryDevice.customer_id == resolved_customer_id,
                )
                .first()
            )
            if existing:
                existing.customer_id = resolved_customer_id
                existing.customer_number = item.customer_number or existing.customer_number
                existing.customer_name = item.customer_name or existing.customer_name
                existing.hostname = item.hostname or existing.hostname
                existing.protocol = item.protocol or existing.protocol
                existing.device_type = item.device_type or existing.device_type
                existing.vendor = item.vendor or existing.vendor
                existing.confidence = max(0, min(100, int(item.confidence or 0)))
                existing.evidence = json.dumps(item.evidence or [])
                existing.managed = bool(item.managed)
                existing.last_seen_at = seen_at
                updated += 1
                continue
            db.add(
                InfraDiscoveryDevice(
                    customer_id=resolved_customer_id,
                    customer_number=item.customer_number or "",
                    customer_name=item.customer_name or "",
                    source=item.source or "agent",
                    hostname=item.hostname or "",
                    ip=item.ip or "",
                    mac=item.mac or "",
                    protocol=item.protocol or "",
                    device_type=item.device_type or "",
                    vendor=item.vendor or "",
                    confidence=max(0, min(100, int(item.confidence or 0))),
                    evidence=json.dumps(item.evidence or []),
                    managed=bool(item.managed),
                    last_seen_at=seen_at,
                )
            )
            created += 1
        db.commit()
    return {"status": "ok", "created": created, "updated": updated}


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
        return serialize_customer(customer)


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

    revenue_current_year = None
    revenue_last_year = None
    revenue_delta = None
    revenue_delta_pct = None
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
                    sum_current = 0.0
                    sum_last = 0.0
                    for invoice in invoices:
                        if not _invoice_is_paid(invoice):
                            continue
                        paid_date = _invoice_date_for_paid(invoice)
                        if not paid_date:
                            continue
                        amount = _invoice_paid_amount(invoice)
                        if amount <= 0:
                            continue
                        if start_current_year <= paid_date <= now_dt:
                            sum_current += amount
                        elif start_last_year <= paid_date <= end_last_year:
                            sum_last += amount
                    revenue_current_year = round(sum_current, 2)
                    revenue_last_year = round(sum_last, 2)
                    revenue_delta = round(revenue_current_year - revenue_last_year, 2)
                    if revenue_last_year and revenue_last_year > 0:
                        revenue_delta_pct = round((revenue_delta / revenue_last_year) * 100, 1)
                except SevdeskError:
                    revenue_current_year = None
                    revenue_last_year = None
                    revenue_delta = None
                    revenue_delta_pct = None

    return {
        "openTasks": open_tasks,
        "openTimeTasks": open_time_tasks,
        "openDayTasks": open_day_tasks,
        "openTimeMinutes": open_time_minutes,
        "estimatedRevenueEur": estimated_revenue,
        "distanceKm": distance_km,
        "mileageEur": mileage_eur,
        "missedCalls": missed_calls,
        "totalMinutes": total_minutes,
        "revenueCurrentYearEur": revenue_current_year,
        "revenueLastYearEur": revenue_last_year,
        "revenueDeltaEur": revenue_delta,
        "revenueDeltaPct": revenue_delta_pct
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


# ================= PURCHASING =================
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
        }
        for field, value in data.dict(exclude_unset=True).items():
            if field in sensitive_fields and value in (None, ""):
                continue
            setattr(settings, field, value)
        # Tactical RMM is API-key based; legacy basic-auth fields are ignored.
        if "rmm_api_key" in data.dict(exclude_unset=True):
            settings.rmm_user = ""
            settings.rmm_password = ""

        db.commit()
        return serialize_integration_settings(settings)


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
    }


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

    offer_payload = {}
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

    customer_number = (offer_payload.get("customerNumber") or "").strip()
    if not customer_number:
        raise HTTPException(400, "Offer missing customerNumber")

    client = SevdeskClient(config)
    try:
        contact = client.get_contact_by_customer_number(customer_number)
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
            contact = client.get_contact_by_customer_number(customer_number)
            if not contact:
                raise HTTPException(404, f"Sevdesk contact not found for {customer_number}")
            contact_id = int(contact.get("id"))

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
        contact = client.get_contact_by_customer_number(customer_number)
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

        query = db.query(DayTask).filter(DayTask.erledigt.is_(True))
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

# ============== OLLAMA AI =================
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

    model_candidates = _resolve_ollama_models(MODEL_PREF_ACTION, MODEL_PREF_TASK_DRAFT)
    payload, _ = _ollama_generate(
        prompt,
        model_candidates=model_candidates,
        response_format="json",
        temperature=0.2,
    )
    if not payload:
        raise HTTPException(502, "Ollama request failed")

    action = parse_action_json(payload.get("response"))
    if not action:
        raise HTTPException(502, "Invalid AI response")
    return action


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

    model_candidates = _resolve_ollama_models(MODEL_PREF_OFFER_TEXT, MODEL_PREF_TASK_DRAFT)
    payload, _ = _ollama_generate(
        prompt,
        model_candidates=model_candidates,
        temperature=0.2,
    )
    if not payload:
        raise HTTPException(502, "Ollama request failed")

    text = (payload.get("response") or "").strip()
    if not text:
        raise HTTPException(502, "Invalid AI response")
    return {"text": text}

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
        payload = {
            "action_prompt": data.action_prompt or current["action_prompt"],
            "offer_base_prompt": data.offer_base_prompt or current["offer_base_prompt"],
            "offer_mode_instructions": data.offer_mode_instructions or current["offer_mode_instructions"],
        }
        store.data_json = json.dumps(payload)
        store.updated_at = int(time.time() * 1000)
        db.commit()
        db.refresh(store)
        return serialize_ai_prompts(store)


@app.get("/api/offers")
def list_offers():
    with SessionLocal() as db:
        _normalize_offer_references(db)
        offers = db.query(Offer).order_by(Offer.created_at.desc()).all()
        return [serialize_offer(offer) for offer in offers]


@app.post("/api/offers", response_model=OfferSaveResponse)
def create_offer(data: OfferSaveRequest, request: Request):
    with SessionLocal() as db:
        now_ms = int(time.time() * 1000)
        payload = data.data or {}
        offer = Offer(
            guid=str(uuid.uuid4()),
            reference=data.reference or "",
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
        )


@app.put("/api/offers/{offer_id}", response_model=OfferSaveResponse)
def update_offer(offer_id: int, data: OfferSaveRequest, request: Request):
    with SessionLocal() as db:
        offer = db.query(Offer).get(offer_id)
        if not offer:
            raise HTTPException(404, "Offer not found")
        payload = data.data or {}
        offer.reference = data.reference or offer.reference
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
    load_sevdesk = load_billing or load_customers

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
    inactive_customer_name_keys: Set[str] = set()
    active_customer_name_keys: Set[str] = set()
    inactive_customer_number_keys: Set[str] = set()
    active_customer_number_keys: Set[str] = set()

    with SessionLocal() as db:
        settings = None
        if load_general or load_sevdesk:
            settings = _get_customer_metrics_settings(db)
            try:
                hourly_rate = float(settings.hourly_rate_eur or 0)
            except ValueError:
                hourly_rate = 0.0

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

        if load_sevdesk:
            integration = db.query(IntegrationSettings).first()
            if not integration:
                integration = IntegrationSettings()
                db.add(integration)
                db.commit()
            sevdesk_config = _build_sevdesk_config(integration, settings)

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

    sevdesk_stats: Dict[str, Any] = {"connected": False}
    if load_sevdesk and sevdesk_config and sevdesk_config.api_token:
        try:
            if load_customers and not load_billing:
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
    if load_customers and isinstance(sevdesk_stats, dict):
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

    response: Dict[str, Any] = {}
    if load_general:
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

        from_addr = settings.sender_email
        if settings.sender_name:
            from_addr = f"{settings.sender_name} <{settings.sender_email}>"

        import smtplib
        import base64
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = data.to
        fallback_text = "Bitte verwenden Sie ein E-Mail-Programm mit HTML-Unterstuetzung."
        msg.set_content(data.text or fallback_text)
        msg.add_alternative(data.html, subtype="html")
        for attachment in data.attachments or []:
            try:
                content = base64.b64decode(attachment.content_base64 or "")
            except Exception:  # noqa: BLE001
                continue
            content_type = attachment.content_type or "application/octet-stream"
            if "/" in content_type:
                maintype, subtype = content_type.split("/", 1)
            else:
                maintype, subtype = "application", "octet-stream"
            msg.add_attachment(
                content,
                maintype=maintype,
                subtype=subtype,
                filename=attachment.filename or "attachment",
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
            server.send_message(msg)
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
        from_addr = settings.sender_email
        if settings.sender_name:
            from_addr = f"{settings.sender_name} <{settings.sender_email}>"

        html = data.html or ""

        import smtplib
        import base64
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = data.to
        msg.set_content(data.text or "Bitte verwenden Sie ein E-Mail-Programm mit HTML-Unterstuetzung.")
        msg.add_alternative(html, subtype="html")
        for attachment in data.attachments or []:
            try:
                content = base64.b64decode(attachment.content_base64 or "")
            except Exception:  # noqa: BLE001
                continue
            content_type = attachment.content_type or "application/octet-stream"
            if "/" in content_type:
                maintype, subtype = content_type.split("/", 1)
            else:
                maintype, subtype = "application", "octet-stream"
            msg.add_attachment(
                content,
                maintype=maintype,
                subtype=subtype,
                filename=attachment.filename or "attachment",
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
            server.send_message(msg)
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
