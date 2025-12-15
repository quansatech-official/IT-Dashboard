from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, Column, Integer, String, Boolean, BigInteger, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Models
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
    elapsed = Column(BigInteger, default=0)
    running = Column(Boolean, default=False)
    startTime = Column(BigInteger, default=0)

    customer = relationship("Customer", back_populates="tasks")

Base.metadata.create_all(bind=engine)

# Schemas
class CustomerCreate(BaseModel):
    name: str

class TaskCreate(BaseModel):
    customer_id: int
    title: str

class TaskUpdate(BaseModel):
    erledigt: Optional[bool] = None
    aberechnet: Optional[bool] = None
    kulant: Optional[bool] = None
    running: Optional[bool] = None
    elapsed: Optional[int] = None
    startTime: Optional[int] = None

# FastAPI App
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Für Prototyp
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoints
@app.get("/api/customers")
def get_customers():
    with SessionLocal() as db:
        customers = db.query(Customer).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "tasks": [
                    {
                        "id": t.id,
                        "title": t.title,
                        "erledigt": t.erledigt,
                        "aberechnet": t.aberechnet,
                        "kulant": t.kulant,
                        "elapsed": t.elapsed,
                        "running": t.running,
                        "startTime": t.startTime
                    } for t in c.tasks
                ]
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

@app.post("/api/tasks")
def create_task(task: TaskCreate):
    with SessionLocal() as db:
        t = Task(customer_id=task.customer_id, title=task.title)
        db.add(t)
        db.commit()
        db.refresh(t)
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

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, t_update: TaskUpdate):
    with SessionLocal() as db:
        t = db.query(Task).filter(Task.id == task_id).first()
        if not t:
            raise HTTPException(status_code=404, detail="Task nicht gefunden")
        for field, value in t_update.dict(exclude_unset=True).items():
            setattr(t, field, value)
        db.commit()
        db.refresh(t)
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