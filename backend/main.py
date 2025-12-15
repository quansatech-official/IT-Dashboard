from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy import create_engine, Column, Integer, String, Boolean, BigInteger
from sqlalchemy.orm import declarative_base, sessionmaker
import os
import time

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# ----------------- Models -----------------
class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    tasks = []

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer)
    title = Column(String, nullable=False)
    erledigt = Column(Boolean, default=False)
    aberechnet = Column(Boolean, default=False)
    kulant = Column(Boolean, default=False)
    elapsed = Column(BigInteger, default=0)
    running = Column(Boolean, default=False)
    startTime = Column(BigInteger, default=0)

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

# ----------------- Endpoints -----------------
@app.get("/api/customers")
def get_customers():
    with SessionLocal() as db:
        customers = db.execute("SELECT * FROM customers").fetchall()
        result = []
        for c in customers:
            tasks = db.execute(f"SELECT * FROM tasks WHERE customer_id={c.id}").fetchall()
            task_list = [serialize_task(Task(**dict(t))) for t in tasks]
            result.append({"id": c.id, "name": c.name, "tasks": task_list})
        return result

@app.post("/api/customers")
def create_customer(c: CustomerCreate):
    with SessionLocal() as db:
        db.execute(f"INSERT INTO customers (name) VALUES ('{c.name}')")
        db.commit()
        return {"name": c.name}

@app.post("/api/tasks")
def create_task(t: TaskCreate):
    now = int(time.time() * 1000)
    with SessionLocal() as db:
        db.execute(f"INSERT INTO tasks (customer_id, title, elapsed, running, startTime) VALUES ({t.customer_id}, '{t.title}', 0, false, 0)")
        db.commit()
        return {"title": t.title}

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, t_update: TaskUpdate):
    with SessionLocal() as db:
        task = db.execute(f"SELECT * FROM tasks WHERE id={task_id}").first()
        if not task:
            raise HTTPException(status_code=404)
        for k, v in t_update.dict(exclude_unset=True).items():
            db.execute(f"UPDATE tasks SET {k}='{v}' WHERE id={task_id}")
        db.commit()
        return {"id": task_id}

@app.patch("/api/tasks/{task_id}/toggle_timer")
def toggle_task_timer(task_id: int):
    now = int(time.time() * 1000)
    with SessionLocal() as db:
        task = db.execute(f"SELECT * FROM tasks WHERE id={task_id}").first()
        if not task:
            raise HTTPException(status_code=404)
        t = dict(task)
        if t["running"]:
            elapsed = t["elapsed"] + (now - t["startTime"])
            db.execute(f"UPDATE tasks SET running=false, elapsed={elapsed}, startTime=0 WHERE id={task_id}")
        else:
            db.execute(f"UPDATE tasks SET running=true, startTime={now} WHERE id={task_id}")
        db.commit()
        return {"id": task_id}

@app.get("/api/pinboard")
def get_pinboard():
    with SessionLocal() as db:
        note = db.execute("SELECT * FROM pin_notes LIMIT 1").first()
        if not note:
            db.execute("INSERT INTO pin_notes (content) VALUES ('')")
            db.commit()
            note = db.execute("SELECT * FROM pin_notes LIMIT 1").first()
        return {"id": note.id, "content": note.content}

@app.patch("/api/pinboard/{note_id}")
def update_pinboard(note_id: int, note: PinNoteUpdate):
    with SessionLocal() as db:
        db.execute(f"UPDATE pin_notes SET content='{note.content}' WHERE id={note_id}")
        db.commit()
        return {"id": note_id, "content": note.content}