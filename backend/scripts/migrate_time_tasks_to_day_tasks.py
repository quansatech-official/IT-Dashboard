import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.main import Task, DayTask, Customer

DATABASE_URL = os.environ.get("DATABASE_URL") or (
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def run() -> None:
    with SessionLocal() as db:
        tasks = db.query(Task).all()
        if not tasks:
            print("No tasks found.")
            return

        existing_links = {
            row[0]
            for row in db.query(DayTask.task_id).filter(DayTask.task_id.isnot(None)).all()
        }
        migrated = 0
        for task in tasks:
            if task.id in existing_links:
                continue
            customer_name = ""
            customer_number = ""
            if task.customer_id:
                customer = db.query(Customer).get(task.customer_id)
                if customer:
                    customer_name = customer.name or ""
                    customer_number = customer.creditor_number or ""
            status = "done" if task.erledigt else "todo"
            if task.running and not task.erledigt:
                status = "doing"
            day_task = DayTask(
                title=task.title,
                customer=customer_name,
                customer_number=customer_number,
                status=status,
                task_id=task.id,
                group_id=None,
                locked=False,
                signature_base64=""
            )
            db.add(day_task)
            migrated += 1
        db.commit()
        print(f"Migrated {migrated} tasks into day_tasks.")


if __name__ == "__main__":
    run()
