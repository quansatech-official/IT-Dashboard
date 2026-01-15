import os
from sqlalchemy import create_engine, text, inspect

DATABASE_URL = os.environ.get("DATABASE_URL") or (
    "postgresql+psycopg2://it_user:it_secret_password@db:5432/it_dashboard"
)

engine = create_engine(DATABASE_URL, future=True)


def run() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("tasks"):
        print("tasks table not found; nothing to migrate.")
        return
    if not inspector.has_table("day_tasks"):
        print("day_tasks table not found; nothing to migrate.")
        return

    with engine.begin() as connection:
        insert_sql = text(
            """
            INSERT INTO day_tasks (
              title,
              customer,
              customer_number,
              status,
              task_id,
              group_id,
              locked,
              signature_base64,
              time_enabled,
              erledigt,
              aberechnet,
              kulant,
              elapsed,
              running,
              startTime,
              created_at
            )
            SELECT
              t.title,
              COALESCE(c.name, ''),
              COALESCE(c.creditor_number, ''),
              CASE WHEN t.erledigt THEN 'done' ELSE 'todo' END,
              t.id,
              NULL,
              FALSE,
              '',
              CASE WHEN (t.elapsed > 0 OR t.running = TRUE) THEN TRUE ELSE FALSE END,
              COALESCE(t.erledigt, FALSE),
              COALESCE(t.aberechnet, FALSE),
              COALESCE(t.kulant, FALSE),
              COALESCE(t.elapsed, 0),
              COALESCE(t.running, FALSE),
              COALESCE(t.startTime, 0),
              (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint
            FROM tasks t
            LEFT JOIN customers c ON c.id = t.customer_id
            LEFT JOIN day_tasks dt ON dt.task_id = t.id
            WHERE dt.id IS NULL;
            """
        )
        update_sql = text(
            """
            UPDATE day_tasks dt
            SET
              elapsed = COALESCE(t.elapsed, 0),
              running = COALESCE(t.running, FALSE),
              startTime = COALESCE(t.startTime, 0),
              erledigt = COALESCE(t.erledigt, FALSE),
              aberechnet = COALESCE(t.aberechnet, FALSE),
              kulant = COALESCE(t.kulant, FALSE),
              time_enabled = CASE WHEN (t.elapsed > 0 OR t.running = TRUE) THEN TRUE ELSE FALSE END
            FROM tasks t
            WHERE dt.task_id = t.id;
            """
        )
        connection.execute(insert_sql)
        connection.execute(update_sql)

    print("Migration completed.")


if __name__ == "__main__":
    run()
