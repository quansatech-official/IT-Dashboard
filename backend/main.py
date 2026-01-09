from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from sqlalchemy import (
    create_engine, Column, Integer, String,
    Boolean, BigInteger, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os
import time
import json
import requests

# ================= DATABASE =================
DATABASE_URL = os.environ.get("DATABASE_URL") or (
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL") or "http://ollama:11434"
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL") or "llama3.1"

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
Base = declarative_base()

# ================= MODELS ===================
class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)

    tasks = relationship(
        "Task",
        back_populates="customer",
        cascade="all, delete-orphan"
    )


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"))

    title = Column(String, nullable=False)

    erledigt = Column(Boolean, default=False)
    aberechnet = Column(Boolean, default=False)
    kulant = Column(Boolean, default=False)

    elapsed = Column(BigInteger, default=0)      # ms
    running = Column(Boolean, default=False)
    startTime = Column(BigInteger, default=0)    # ms timestamp

    customer = relationship("Customer", back_populates="tasks")


class PinNote(Base):
    __tablename__ = "pin_notes"

    id = Column(Integer, primary_key=True)
    content = Column(String, default="")

class ReportCatalogItem(Base):
    __tablename__ = "report_catalog"

    id = Column(Integer, primary_key=True)
    title = Column(String, nullable=False)
    system = Column(String, default="")
    why_text = Column(String, default="")
    impact = Column(String, default="")
    duration = Column(String, default="")
    cost = Column(String, default="")
    priority = Column(String, default="Planbar")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True)
    customer = Column(String, nullable=False)
    period = Column(String, default="")
    status = Column(String, default="")
    summary = Column(String, default="")
    customer_action_text = Column(String, default="")
    created_at = Column(BigInteger, default=lambda: int(time.time() * 1000))

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

class IntegrationSettings(Base):
    __tablename__ = "integration_settings"

    id = Column(Integer, primary_key=True)
    rmm_host = Column(String, default="")
    rmm_user = Column(String, default="")
    rmm_password = Column(String, default="")

Base.metadata.create_all(bind=engine)

# ================= SCHEMAS ==================
class CustomerCreate(BaseModel):
    name: str


class TaskCreate(BaseModel):
    customer_id: int
    title: str


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    erledigt: Optional[bool] = None
    aberechnet: Optional[bool] = None
    kulant: Optional[bool] = None
    elapsed: Optional[int] = None
    running: Optional[bool] = None
    startTime: Optional[int] = None


class PinNoteUpdate(BaseModel):
    content: str

class ReportCatalogItemBase(BaseModel):
    title: str
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
    system: Optional[str] = None
    why_text: Optional[str] = None
    impact: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[str] = None
    priority: Optional[str] = None

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
    period: Optional[str] = ""
    status: Optional[str] = ""
    summary: Optional[str] = ""
    customer_action_text: Optional[str] = ""
    items: List[ReportItemSchema] = []

class IntegrationSettingsUpdate(BaseModel):
    rmm_host: Optional[str] = None
    rmm_user: Optional[str] = None
    rmm_password: Optional[str] = None

class ActionAiRequest(BaseModel):
    text: str

# ================= APP ======================
app = FastAPI(title="QT-Workbench Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= HELPERS ==================
def serialize_task(t: Task) -> Dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "erledigt": t.erledigt,
        "aberechnet": t.aberechnet,
        "kulant": t.kulant,
        "elapsed": t.elapsed,
        "running": t.running,
        "startTime": t.startTime,
    }


def serialize_customer(c: Customer) -> Dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "tasks": [serialize_task(t) for t in c.tasks],
    }

def serialize_catalog_item(item: ReportCatalogItem) -> Dict[str, Any]:
    return {
        "id": item.id,
        "title": item.title,
        "system": item.system,
        "why_text": item.why_text,
        "impact": item.impact,
        "duration": item.duration,
        "cost": item.cost,
        "priority": item.priority,
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
        "customer": report.customer,
        "period": report.period,
        "status": report.status,
        "summary": report.summary,
        "customer_action_text": report.customer_action_text,
        "created_at": report.created_at,
        "items": [serialize_report_item(i) for i in report.items],
    }

def serialize_integration_settings(settings: IntegrationSettings) -> Dict[str, Any]:
    return {
        "id": settings.id,
        "rmm_host": settings.rmm_host,
        "rmm_user": settings.rmm_user,
        "rmm_password": settings.rmm_password,
    }

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
        customer = Customer(name=data.name)
        db.add(customer)
        db.commit()
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

# ================= TASKS ====================
@app.post("/api/tasks")
def create_task(data: TaskCreate):
    with SessionLocal() as db:
        task = Task(
            customer_id=data.customer_id,
            title=data.title
        )
        db.add(task)
        db.commit()
        return serialize_task(task)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, data: TaskUpdate):
    with SessionLocal() as db:
        task = db.query(Task).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")

        for field, value in data.dict(exclude_unset=True).items():
            setattr(task, field, value)

        db.commit()
        return serialize_task(task)


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int):
    with SessionLocal() as db:
        task = db.query(Task).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")

        db.delete(task)
        db.commit()
        return {"status": "deleted"}


@app.patch("/api/tasks/{task_id}/toggle_timer")
def toggle_timer(task_id: int):
    now = int(time.time() * 1000)

    with SessionLocal() as db:
        task = db.query(Task).get(task_id)
        if not task:
            raise HTTPException(404, "Task not found")

        if task.running:
            task.elapsed += now - task.startTime
            task.running = False
            task.startTime = 0
        else:
            task.running = True
            task.startTime = now

        db.commit()
        return serialize_task(task)

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

        for field, value in data.dict(exclude_unset=True).items():
            setattr(settings, field, value)

        db.commit()
        return serialize_integration_settings(settings)

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

# ================== REPORTS =================
@app.get("/api/reports")
def get_reports():
    with SessionLocal() as db:
        reports = db.query(Report).all()
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
        report = Report(
            customer=data.customer,
            period=data.period or "",
            status=data.status or "",
            summary=data.summary or "",
            customer_action_text=data.customer_action_text or "",
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
