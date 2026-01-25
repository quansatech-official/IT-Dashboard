from typing import Any, Dict, List, Optional
import logging

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from app.adapters import get_adapters
from app.adapters.also_feed_adapter import AlsoFeedAdapter
from app.adapters.icecat_adapter import IcecatAdapter
from app.config import settings
from app.models.alternative_content import AlternativeProductContent
from app.models.normalized_item import NormalizedItem
from app.utils.also_feed_config import load_also_config, persist_also_config
from app.utils.settings_service import WorkbenchSettingsService
import os

app = FastAPI(title="Marketplace Import Service")
logger = logging.getLogger(__name__)


class ParseRequest(BaseModel):
    source: str
    payload: Dict[str, Any]


class AlsoConfigRequest(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    user: Optional[str] = None
    password: Optional[str] = None
    dir: Optional[str] = None


adapters = get_adapters()
also_feed_adapter = AlsoFeedAdapter()
settings_service = WorkbenchSettingsService(
    settings.workbench_base_url, settings.request_timeout_seconds
)
icecat_adapter = IcecatAdapter(settings_service, settings.request_timeout_seconds)


def _get_adapter(source: str):
    adapter = adapters.get(source)
    if not adapter:
        raise HTTPException(status_code=404, detail="Unknown source")
    return adapter


@app.get("/import/sources")
async def list_sources() -> List[Dict[str, Any]]:
    td_ready = bool(
        settings.td_synnex_client_id
        and settings.td_synnex_client_secret
        and settings.td_synnex_account_id
    )
    also_ready = os.path.exists(settings.also_feed_db_path)
    return [
        {
            "source": "td_synnex",
            "available": td_ready,
        },
        {
            "source": "also",
            "available": also_ready,
        },
    ]


@app.get("/import/search", response_model=List[NormalizedItem])
async def search_items(
    source: str = Query(...),
    query: str = Query(...),
    sku: Optional[str] = None,
    manufacturer_sku: Optional[str] = None,
) -> List[NormalizedItem]:
    adapter = _get_adapter(source)
    options = {}
    if sku:
        options["sku"] = sku
    if manufacturer_sku:
        options["manufacturerSku"] = manufacturer_sku
    try:
        return await adapter.search(query, options or None)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/import/item/{sku}", response_model=NormalizedItem)
async def get_item(source: str, sku: str) -> NormalizedItem:
    adapter = _get_adapter(source)
    try:
        return await adapter.get_by_sku(sku)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/import/parse", response_model=NormalizedItem)
async def parse_item(request: ParseRequest) -> NormalizedItem:
    adapter = _get_adapter(request.source)
    if hasattr(adapter, "_normalize_item"):
        try:
            return adapter._normalize_item(request.payload)  # type: ignore[attr-defined]
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise HTTPException(status_code=400, detail="Parse not supported for source")


@app.get("/import/alternative/icecat", response_model=Optional[AlternativeProductContent])
async def get_icecat_alternative(
    ean: Optional[str] = None,
    brand: Optional[str] = None,
    mpn: Optional[str] = None,
    manufacturer: Optional[str] = None,
    manufacturer_sku: Optional[str] = None,
) -> Optional[AlternativeProductContent]:
    brand_value = brand or manufacturer
    mpn_value = mpn or manufacturer_sku
    if not ean and not (brand_value and mpn_value):
        raise HTTPException(status_code=400, detail="Missing ean or brand+mpn")
    try:
        if ean:
            return await icecat_adapter.fetch_by_ean(ean)
        return await icecat_adapter.fetch_by_mpn(brand_value or "", mpn_value or "")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Icecat lookup failed: %s", exc)
        return None


@app.post("/import/also/run")
async def run_also_import() -> Dict[str, Any]:
    result = also_feed_adapter.run_import()
    return {
        "imported": result.imported,
        "skipped": result.skipped,
        "errors": result.errors,
        "filename": result.filename,
    }


@app.get("/import/also/status")
async def also_status() -> Dict[str, Any]:
    return also_feed_adapter.check_status()


@app.post("/import/also/config")
async def update_also_config(request: AlsoConfigRequest) -> Dict[str, Any]:
    payload = {
        "host": request.host,
        "port": request.port,
        "user": request.user,
        "password": request.password,
        "dir": request.dir,
    }
    persist_also_config(payload)
    return {"status": "ok"}


@app.get("/import/also/config")
async def get_also_config() -> Dict[str, Any]:
    override = load_also_config()
    host = override.get("host") or settings.also_sftp_host
    port = int(override.get("port") or settings.also_sftp_port)
    user = override.get("user") or settings.also_sftp_user
    directory = override.get("dir") or settings.also_sftp_dir or "."
    return {
        "override_present": bool(override),
        "override": {
            "host": override.get("host"),
            "port": override.get("port"),
            "user": override.get("user"),
            "has_password": bool(override.get("password")),
            "dir": override.get("dir"),
        },
        "effective": {
            "host": host,
            "port": port,
            "user": user,
            "has_password": bool(settings.also_sftp_password),
            "dir": directory,
        },
    }
