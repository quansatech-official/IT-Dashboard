from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

import httpx

from app.models.alternative_content import AlternativeProductContent, AlternativeSpec
from app.utils.settings_service import IcecatSettings, WorkbenchSettingsService


logger = logging.getLogger(__name__)

ICECAT_BASE_URL = "https://live.icecat.biz/api"
ICECAT_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60
ICECAT_DEFAULT_PARAMS = {"lang": "de", "content": "1"}


class IcecatAdapter:
    def __init__(self, settings_service: WorkbenchSettingsService, timeout_seconds: float = 20) -> None:
        self._settings_service = settings_service
        self._timeout_seconds = timeout_seconds
        self._cache: Dict[str, tuple[float, AlternativeProductContent]] = {}

    async def load_settings(self) -> IcecatSettings:
        settings = await self._settings_service.get("icecat")
        return settings or IcecatSettings(api_token="", enabled=False)

    async def is_enabled(self) -> bool:
        settings = await self.load_settings()
        return bool(settings.enabled and settings.api_token)

    async def test_connection(self) -> Dict[str, Any]:
        settings = await self.load_settings()
        result = {
            "enabled": bool(settings.enabled),
            "has_token": bool(settings.api_token),
            "ok": False,
            "status_code": None,
            "error": "",
        }
        if not settings.enabled or not settings.api_token:
            result["error"] = "missing_token"
            return result
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {settings.api_token}",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.get(
                    ICECAT_BASE_URL,
                    params={**ICECAT_DEFAULT_PARAMS, "ean": "0000000000000"},
                    headers=headers,
                )
            result["status_code"] = response.status_code
            if response.status_code in (401, 403):
                result["error"] = "unauthorized"
                return result
            # 404 is acceptable for a non-existing EAN
            result["ok"] = response.status_code in (200, 204, 404)
            if not result["ok"]:
                result["error"] = f"status_{response.status_code}"
            return result
        except Exception as exc:  # noqa: BLE001
            result["error"] = str(exc)
            return result

    def _cache_get(self, key: str) -> Optional[AlternativeProductContent]:
        entry = self._cache.get(key)
        if not entry:
            return None
        expires_at, payload = entry
        if time.time() >= expires_at:
            self._cache.pop(key, None)
            return None
        return payload

    def _cache_set(self, key: str, payload: AlternativeProductContent) -> None:
        self._cache[key] = (time.time() + ICECAT_CACHE_TTL_SECONDS, payload)

    async def fetch_by_ean(self, ean: str) -> Optional[AlternativeProductContent]:
        if not ean:
            return None
        cache_key = f"ean:{ean}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        settings = await self.load_settings()
        if not settings.enabled or not settings.api_token:
            return None
        payload = await self._fetch(settings, {"ean": ean})
        content = self.parse_response(payload)
        if content:
            self._cache_set(cache_key, content)
        return content

    async def fetch_by_mpn(self, brand: str, mpn: str) -> Optional[AlternativeProductContent]:
        if not brand or not mpn:
            return None
        cache_key = f"mpn:{brand}:{mpn}"
        cached = self._cache_get(cache_key)
        if cached:
            return cached
        settings = await self.load_settings()
        if not settings.enabled or not settings.api_token:
            return None
        payload = await self._fetch(settings, {"brand": brand, "mpn": mpn})
        content = self.parse_response(payload)
        if content:
            self._cache_set(cache_key, content)
        return content

    async def _fetch(self, settings: IcecatSettings, params: Dict[str, str]) -> Optional[Dict[str, Any]]:
        if not settings.api_token:
            return None
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {settings.api_token}",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.get(
                    ICECAT_BASE_URL,
                    params={**ICECAT_DEFAULT_PARAMS, **params},
                    headers=headers,
                )
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                return response.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Icecat request failed: %s", exc)
            return None

    def parse_response(self, payload: Optional[Dict[str, Any]]) -> Optional[AlternativeProductContent]:
        if not isinstance(payload, dict):
            return None
        title = self._pick_title(payload)
        description = self._pick_description(payload)
        images = self._pick_images(payload)
        specs = self._pick_specs(payload)

        if not any([title, description, images, specs]):
            return None
        content = AlternativeProductContent(source="icecat")
        if title:
            content.title = title
        if description:
            content.description = description
        if images:
            content.images = images
        if specs:
            content.specs = specs
        return content

    def return_alternative_content(
        self, payload: Optional[Dict[str, Any]]
    ) -> Optional[AlternativeProductContent]:
        return self.parse_response(payload)

    def _pick_title(self, payload: Dict[str, Any]) -> str:
        candidates = [
            self._get_nested(payload, ["data", "GeneralInfo", "Title"]),
            self._get_nested(payload, ["GeneralInfo", "Title"]),
            self._get_nested(payload, ["data", "Product", "Title"]),
            self._get_nested(payload, ["Product", "Title"]),
            self._get_nested(payload, ["data", "Title"]),
            payload.get("Title"),
            payload.get("title"),
            payload.get("LongProductName"),
            self._get_nested(payload, ["data", "LongProductName"]),
        ]
        return self._first_text(candidates)

    def _pick_description(self, payload: Dict[str, Any]) -> str:
        candidates = [
            self._get_nested(payload, ["data", "LongDescription"]),
            payload.get("LongDescription"),
            self._get_nested(payload, ["data", "ProductDescription", "LongDesc"]),
            self._get_nested(payload, ["ProductDescription", "LongDesc"]),
            self._get_nested(payload, ["data", "ProductDescription", "LongDescription"]),
            self._get_nested(payload, ["ProductDescription", "LongDescription"]),
            payload.get("Description"),
            payload.get("description"),
        ]
        return self._first_text(candidates)

    def _pick_images(self, payload: Dict[str, Any]) -> Optional[List[str]]:
        candidates = [
            self._get_nested(payload, ["data", "Gallery", "Images"]),
            self._get_nested(payload, ["Gallery", "Images"]),
            self._get_nested(payload, ["data", "Images"]),
            payload.get("Images"),
            payload.get("images"),
        ]
        for candidate in candidates:
            urls = self._extract_image_urls(candidate)
            if urls:
                return urls
        return None

    def _pick_specs(self, payload: Dict[str, Any]) -> Optional[List[AlternativeSpec]]:
        candidates = [
            self._get_nested(payload, ["data", "Specifications"]),
            self._get_nested(payload, ["Specifications"]),
            self._get_nested(payload, ["data", "Specs"]),
            payload.get("Specs"),
            payload.get("specs"),
        ]
        for candidate in candidates:
            specs = self._extract_specs(candidate)
            if specs:
                return specs
        return None

    def _extract_image_urls(self, candidate: Any) -> List[str]:
        if not candidate:
            return []
        urls: List[str] = []
        if isinstance(candidate, dict):
            candidate = candidate.get("Images") or candidate.get("images") or candidate
        if isinstance(candidate, list):
            for entry in candidate:
                url = self._extract_image_url(entry)
                if url:
                    urls.append(url)
        elif isinstance(candidate, str):
            urls.append(candidate)
        return urls

    def _extract_image_url(self, entry: Any) -> str:
        if isinstance(entry, str):
            return entry
        if isinstance(entry, dict):
            for key in ("Url", "URL", "url", "Original", "original", "High", "Preview", "Thumb"):
                value = entry.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return ""

    def _extract_specs(self, candidate: Any) -> List[AlternativeSpec]:
        if not candidate:
            return []
        specs: List[AlternativeSpec] = []
        if isinstance(candidate, dict):
            candidate = candidate.get("Specifications") or candidate.get("specs") or candidate
        if isinstance(candidate, list):
            for entry in candidate:
                spec = self._extract_spec(entry)
                if spec:
                    specs.append(spec)
        return specs

    def _extract_spec(self, entry: Any) -> Optional[AlternativeSpec]:
        if not isinstance(entry, dict):
            return None
        name = entry.get("Name") or entry.get("name") or entry.get("Title") or ""
        if not name and isinstance(entry.get("Specification"), dict):
            name = entry["Specification"].get("Name") or entry["Specification"].get("Title") or ""
        value = entry.get("Value") or entry.get("value") or entry.get("ValueLabel") or ""
        if not value and isinstance(entry.get("Value"), dict):
            value = entry["Value"].get("Value") or entry["Value"].get("Label") or ""
        unit = entry.get("Unit") or entry.get("unit") or entry.get("UnitName")
        if not unit and isinstance(entry.get("Unit"), dict):
            unit = entry["Unit"].get("Name") or entry["Unit"].get("Title")
        name = str(name).strip()
        value = str(value).strip()
        if not name or not value:
            return None
        unit_value = str(unit).strip() if unit else None
        return AlternativeSpec(name=name, value=value, unit=unit_value or None)

    def _get_nested(self, payload: Dict[str, Any], path: List[str]) -> Any:
        current: Any = payload
        for key in path:
            if not isinstance(current, dict) or key not in current:
                return None
            current = current[key]
        return current

    def _first_text(self, candidates: List[Any]) -> str:
        for candidate in candidates:
            if isinstance(candidate, str) and candidate.strip():
                return candidate.strip()
        return ""
