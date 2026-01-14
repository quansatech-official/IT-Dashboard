import os
import time

from fastapi import FastAPI, Response
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

app = FastAPI(title="QT-Workbench Beacon")

PIXEL = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
    b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
    b"\x00\x02\x02D\x01\x00;"
)


def _touch_report(guid: str) -> None:
    if not guid:
        return
    with SessionLocal() as db:
        db.execute(
            text(
                "UPDATE reports "
                "SET opened_at = :opened_at, "
                "opened_count = COALESCE(opened_count, 0) + 1 "
                "WHERE guid = :guid"
            ),
            {"opened_at": int(time.time() * 1000), "guid": guid},
        )
        db.commit()


@app.get("/open")
def report_open(guid: str):
    _touch_report(guid)
    return Response(
        content=PIXEL,
        media_type="image/gif",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
