from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, Column, Integer, String, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
import os
import time

# ----------------- Database -----------------
DATABASE_URL = os.environ.get(
    "DATABASE_URL", 
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# ----------------- Models -----------------
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    tasks = relationship("Task", back_populates="customer", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    title = Column(String, nullable=False)
    erledigt = Column(Boolean, default=False)
    aberechnet = Column(Boolean, default=False)
    kulant = Column(Boolean, default=False)
    elapsed = Column(BigInteger, default=0)
    running = Column(Boolean, default=False)
    startTime = Column(BigInteger, default=0)

    customer = relationship("Customer", back_populates="tasks")

class PinNote(Base):
    __tablename__ = "pin_notes"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(String, default="")

Base.metadata.create_all(bind=engine)

# ----------------- Schemas -----------------
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
    startTime: Optional[int] = None
    running: Optional[bool] = None

class PinNoteUpdate(BaseModel):
    content: str

# ----------------- FastAPI -----------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Helpers -----------------
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

def serialize_customer(c: Customer) -> Dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "tasks": [serialize_task(t) for t in c.tasks]
    }

# ----------------- Endpoints -----------------

# --- Customers ---
@app.get("/api/customers")
def get_customers():
    with SessionLocal() as db:
        customers = db.query(Customer).all()
        return [serialize_customer(c) for c in customers]

@app.post("/api/customers")
def create_customer(c: CustomerCreate):
    with SessionLocal() as db:
        customer = Customer(name=c.name)
        db.add(customer)
        db.commit()
        db.refresh(customer)
        return serialize_customer(customer)

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: int):
    with SessionLocal() as db:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        db.delete(customer)
        db.commit()
        return {"detail": "Customer deleted"}

# --- Tasks ---
@app.post("/api/tasks")
def create_task(t: TaskCreate):
    with SessionLocal() as db:
        task = Task(customer_id=t.customer_id, title=t.title)
        db.add(task)
        db.commit()
        db.refresh(task)
        return serialize_task(task)

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, t_update: TaskUpdate):
    with SessionLocal() as db:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        for field, value in t_update.dict(exclude_unset=True).items():
            setattr(task, field, value)
        db.commit()
        db.refresh(task)
        return serialize_task(task)

@app.patch("/api/tasks/{task_id}/toggle_timer")
def toggle_task_timer(task_id: int):
    now = int(time.time() * 1000)
    with SessionLocal() as db:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.running:
            task.elapsed += now - task.startTime
            task.running = False
            task.startTime = 0
        else:
            task.running = True
            task.startTime = now
        db.commit()
        db.refresh(task)
        return serialize_task(task)

# --- Pinboard ---
@app.get("/api/pinboard")
def get_pinboard():
    with SessionLocal() as db:
        note = db.query(PinNote).first()
        if not note:
            note = PinNote(content="")
            db.add(note)
            db.commit()
            db.refresh(note)
        return {"id": note.id, "content": note.content}

@app.patch("/api/pinboard/{note_id}")
def update_pinboard(note_id: int, data: PinNoteUpdate):
    with SessionLocal() as db:
        note = db.query(PinNote).filter(PinNote.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Pinboard not found")
        note.content = data.content
        db.commit()
        db.refresh(note)
        return {"id": note.id, "content": note.content}