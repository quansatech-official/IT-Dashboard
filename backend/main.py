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

# ================= DATABASE =================
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)

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

# ================= CUSTOMERS =================
@app.get("/api/customers")
def get_customers():
    with SessionLocal() as db:
        customers = db.query(Customer).all()
        return [serialize_customer(c) for c in customers]


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