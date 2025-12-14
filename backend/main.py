from fastapi import FastAPI
from sqlalchemy import create_engine, Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
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

@app.get("/customers")
def get_customers():
    db = SessionLocal()
    customers = db.query(Customer).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "tasks": [{"id": t.id, "title": t.title, "billable": t.billable} for t in c.tasks]
        }
        for c in customers
    ]

@app.post("/customers")
def create_customer(name: str):
    db = SessionLocal()
    c = Customer(name=name)
    db.add(c)
    db.commit()
    return {"status": "ok"}
