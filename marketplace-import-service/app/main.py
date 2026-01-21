from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from app.adapters import get_adapters
from app.adapters.also_feed_adapter import AlsoFeedAdapter
from app.config import settings
from app.models.normalized_item import NormalizedItem
from app.utils.also_feed_config import persist_also_config
import os

app = FastAPI(title="Marketplace Import Service")


class ParseRequest(BaseModel):
    source: str
    payload: Dict[str, Any]


class AlsoConfigRequest(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    user: Optional[str] = None
    password: Optional[str] = None
    key_path: Optional[str] = None
    dir: Optional[str] = None


adapters = get_adapters()
also_feed_adapter = AlsoFeedAdapter()


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
        {
            "source": "amazon",
            "available": False,
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
        "key_path": request.key_path,
        "dir": request.dir,
    }
    persist_also_config(payload)
    return {"status": "ok"}
