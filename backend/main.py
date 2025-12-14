from fastapi import FastAPI
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from fastapi.middleware.cors import CORSMiddleware
import os

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True)
    name = Column(String)
    tasks = relationship("Task", back_populates="customer")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True)
    title = Column(String)
    billable = Column(Boolean, default=True)
    customer_id = Column(Integer, ForeignKey("customers.id"))
    customer = relationship("Customer", back_populates="tasks")

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Browser kann Frontend überall hosten
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel

class CustomerModel(BaseModel):
    id: int
    name: str

@app.get("/customers")
def get_customers():
    with SessionLocal() as db:
        customers_db = db.query(Customer).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "tasks": [{"id": t.id, "title": t.title, "billable": t.billable} for t in c.tasks]
            } for c in customers_db
        ]

@app.post("/customers")
def create_customer(customer: CustomerModel):
    with SessionLocal() as db:
        c = Customer(id=customer.id, name=customer.name)
        db.add(c)
        db.commit()
    return {"status": "ok"}