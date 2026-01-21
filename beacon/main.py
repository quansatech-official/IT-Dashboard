import logging
import os
import time
from typing import Optional

import requests

from fastapi import FastAPI, Response
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "")
REPORT_OPEN_URL = os.getenv("BEACON_REPORT_OPEN_URL", "")
OFFER_OPEN_URL = os.getenv("BEACON_OFFER_OPEN_URL", "")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

app = FastAPI(title="QT-Workbench Beacon")
logger = logging.getLogger("qtbeacon")
if not logging.getLogger().handlers:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

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


def _touch_offer(guid: str) -> None:
    if not guid:
        return
    with SessionLocal() as db:
        db.execute(
            text(
                "UPDATE offers "
                "SET opened_at = :opened_at, "
                "opened_count = COALESCE(opened_count, 0) + 1 "
                "WHERE guid = :guid OR tracking_guid = :guid"
            ),
            {"opened_at": int(time.time() * 1000), "guid": guid},
        )
        db.commit()


def _build_report_open_url(guid: str) -> Optional[str]:
    if not REPORT_OPEN_URL or not guid:
        return None
    if "{guid}" in REPORT_OPEN_URL:
        return REPORT_OPEN_URL.replace("{guid}", guid)
    separator = "&" if "?" in REPORT_OPEN_URL else "?"
    return f"{REPORT_OPEN_URL}{separator}guid={guid}"


def _build_offer_open_url(guid: str) -> Optional[str]:
    if not OFFER_OPEN_URL or not guid:
        return None
    if "{guid}" in OFFER_OPEN_URL:
        return OFFER_OPEN_URL.replace("{guid}", guid)
    separator = "&" if "?" in OFFER_OPEN_URL else "?"
    return f"{OFFER_OPEN_URL}{separator}guid={guid}"


def _notify_backend(url: Optional[str]) -> bool:
    if not url:
        return False
    try:
        response = requests.get(url, timeout=5, headers={"User-Agent": "qtbeacon"})
        if not response.ok:
            logger.warning("Backend open failed (%s): %s", response.status_code, url)
        return response.ok
    except requests.RequestException as exc:
        logger.warning("Backend report open request failed: %s", exc)
        return False


@app.get("/open")
def report_open(guid: str):
    report_ok = _notify_backend(_build_report_open_url(guid))
    offer_ok = _notify_backend(_build_offer_open_url(guid))
    if not report_ok:
        _touch_report(guid)
    if not offer_ok:
        _touch_offer(guid)
    return Response(
        content=PIXEL,
        media_type="image/gif",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@app.get("/health")
def health():
    return {"status": "ok"}
