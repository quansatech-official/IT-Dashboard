from fastapi import FastAPI, HTTPException, Body
from sqlalchemy import create_engine, Column, Integer, String, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import os
import time # Import für die Server-seitige Zeitmessung

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# ----------------- Models (SQLAlchemy) -----------------
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    tasks = relationship("Task", back_populates="customer")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    title = Column(String, nullable=False)
    erledigt = Column(Boolean, default=False)
    aberechnet = Column(Boolean, default=False)
    kulant = Column(Boolean, default=False)
    # elapsed und startTime speichern Millisekunden, BigInteger ist angemessen
    elapsed = Column(BigInteger, default=0)
    running = Column(Boolean, default=False)
    startTime = Column(BigInteger, default=0) # Speichert den Unix-Timestamp des Starts

    customer = relationship("Customer", back_populates="tasks")

Base.metadata.create_all(bind=engine)
# 

# ----------------- Schemas (Pydantic) -----------------
class CustomerCreate(BaseModel):
    name: str

class TaskCreate(BaseModel):
    customer_id: int
    title: str

class TaskUpdate(BaseModel):
    # Felder zur Aktualisierung von Status
    erledigt: Optional[bool] = None
    aberechnet: Optional[bool] = None
    kulant: Optional[bool] = None
    # Felder zur manuellen Aktualisierung der Zeit (optional, aber notwendig für PATCH)
    elapsed: Optional[int] = None # BigInteger in DB, aber int in Python
    startTime: Optional[int] = None # BigInteger in DB, aber int in Python
    running: Optional[bool] = None

class TaskResponse(BaseModel):
    id: int
    title: str
    erledigt: bool
    aberechnet: bool
    kulant: bool
    elapsed: int
    running: bool
    startTime: int

# ----------------- FastAPI App -----------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Utility-Funktion zum Konvertieren des SQLAlchemy-Objekts in ein standardisiertes Dictionary
def serialize_task(t: Task) -> Dict[str, Any]:
    return {
        "id": t.id,
        "title": t.title,
        "erledigt": t.erledigt,
        "aberechnet": t.aberechnet,
        "kulant": t.kulant,
        "elapsed": t.elapsed,
        "running": t.running,
        "startTime": t.startTime
    }

# ----------------- Endpoints -----------------

@app.get("/api/customers")
def get_customers():
    with SessionLocal() as db:
        customers = db.query(Customer).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "tasks": [serialize_task(t) for t in c.tasks] # Nutzung der Utility-Funktion
            } for c in customers
        ]

@app.post("/api/customers")
def create_customer(customer: CustomerCreate):
    with SessionLocal() as db:
        c = Customer(name=customer.name)
        db.add(c)
        db.commit()
        db.refresh(c)
        return {"id": c.id, "name": c.name, "tasks": []}

@app.post("/api/tasks", response_model=TaskResponse)
def create_task(task: TaskCreate):
    with SessionLocal() as db:
        # Standardwerte aus dem Schema werden angewendet (elapsed=0, running=False, startTime=0)
        t = Task(customer_id=task.customer_id, title=task.title) 
        db.add(t)
        db.commit()
        db.refresh(t)
        return serialize_task(t)

@app.patch("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, t_update: TaskUpdate):
    with SessionLocal() as db:
        t = db.query(Task).filter(Task.id == task_id).first()
        if not t:
            raise HTTPException(status_code=404, detail="Task nicht gefunden")
            
        # Manuelle Aktualisierung der Felder (z.B. Checkboxes, Titel, etc.)
        for field, value in t_update.dict(exclude_unset=True).items():
            setattr(t, field, value)
            
        db.commit()
        db.refresh(t)
        return serialize_task(t)

# NEU: Spezieller Endpunkt für die Timer-Logik
@app.patch("/api/tasks/{task_id}/toggle_timer", response_model=TaskResponse)
def toggle_task_timer(task_id: int):
    with SessionLocal() as db:
        t = db.query(Task).filter(Task.id == task_id).first()
        if not t:
            raise HTTPException(status_code=404, detail="Task nicht gefunden")

        # Aktueller Zeitpunkt in Millisekunden (Serverzeit)
        now_ms = int(time.time() * 1000)

        if t.running:
            # STOPP-Logik
            # Berechne die verstrichene Zeit seit dem Start (startTime)
            time_spent = now_ms - t.startTime
            t.elapsed = t.elapsed + time_spent
            t.running = False
            t.startTime = 0 # Setze startTime auf 0 zurück, um den gestoppten Zustand zu signalisieren
        else:
            # START-Logik
            # Setze den Startzeitpunkt
            t.running = True
            t.startTime = now_ms

        db.commit()
        db.refresh(t)
        return serialize_task(t)