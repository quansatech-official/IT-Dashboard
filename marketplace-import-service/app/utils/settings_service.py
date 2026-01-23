from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Optional

import httpx


logger = logging.getLogger(__name__)


@dataclass
class IcecatSettings:
    username: str
    password: str
    enabled: bool


class WorkbenchSettingsService:
    def __init__(self, base_url: str, timeout: float, cache_ttl_seconds: int = 60) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._cache_ttl_seconds = cache_ttl_seconds
        self._icecat_cache: Optional[IcecatSettings] = None
        self._icecat_cache_expires_at = 0.0

    def _cache_valid(self) -> bool:
        return self._icecat_cache is not None and time.time() < self._icecat_cache_expires_at

    async def get(self, key: str) -> Optional[IcecatSettings]:
        if key != "icecat":
            return None
        if self._cache_valid():
            return self._icecat_cache

        url = f"{self._base_url}/api/integrations/icecat"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                payload = response.json()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Icecat settings fetch failed: %s", exc)
            settings = IcecatSettings(username="", password="", enabled=False)
            self._icecat_cache = settings
            self._icecat_cache_expires_at = time.time() + self._cache_ttl_seconds
            return settings

        settings = IcecatSettings(
            username=str(payload.get("username") or ""),
            password=str(payload.get("password") or ""),
            enabled=bool(payload.get("enabled")),
        )
        self._icecat_cache = settings
        self._icecat_cache_expires_at = time.time() + self._cache_ttl_seconds
        return settings
