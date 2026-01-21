import time
from typing import List, Optional

import httpx

from app.adapters.base import DistributorAdapter
from app.config import settings
from app.models.normalized_item import NormalizedItem


class TDSynnexAdapter(DistributorAdapter):
    source = "td_synnex"

    def __init__(self) -> None:
        self._token: Optional[str] = None
        self._token_expires_at: float = 0.0

    async def _get_access_token(self) -> str:
        now = time.time()
        if self._token and now < self._token_expires_at:
            return self._token
        if not settings.td_synnex_client_id or not settings.td_synnex_client_secret:
            raise ValueError("TD SYNNEX credentials missing")

        payload = {
            "grant_type": "client_credentials",
            "client_id": settings.td_synnex_client_id,
            "client_secret": settings.td_synnex_client_secret,
        }
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.post(settings.td_synnex_token_url, data=payload)
            response.raise_for_status()
            data = response.json()

        token = data.get("access_token")
        expires_in = float(data.get("expires_in", 7200))
        if not token:
            raise ValueError("TD SYNNEX token response missing access_token")
        self._token = token
        self._token_expires_at = now + max(expires_in - 60, 60)
        return token

    def _headers(self, token: str) -> dict:
        return {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }

    async def _fetch_products(self, params: dict) -> dict:
        if not settings.td_synnex_account_id:
            raise ValueError("TD SYNNEX account ID missing")
        token = await self._get_access_token()
        base_url = settings.td_synnex_base_url.rstrip("/")
        url = f"{base_url}/api/v3/accounts/{settings.td_synnex_account_id}/products"
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.get(url, headers=self._headers(token), params=params)
            response.raise_for_status()
            return response.json()

    def _pick_price(self, value) -> Optional[float]:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _extract_pricing(self, payload: dict) -> tuple[Optional[float], Optional[float], Optional[float], Optional[str]]:
        recommended = None
        ek_min = None
        ek_max = None
        currency = None

        charges = payload.get("charges") or payload.get("prices") or []
        if isinstance(charges, dict):
            charges = [charges]

        for entry in charges:
            if not isinstance(entry, dict):
                continue
            currency = currency or entry.get("currency") or entry.get("currencyCode")
            candidate = (
                entry.get("recommendedVK")
                or entry.get("recommendedPrice")
                or entry.get("listPrice")
                or entry.get("price")
            )
            if recommended is None:
                recommended = self._pick_price(candidate)

            cost = entry.get("cost") or entry.get("internalPrice") or entry.get("netPrice")
            price = self._pick_price(cost)
            if price is not None:
                if ek_min is None or price < ek_min:
                    ek_min = price
                if ek_max is None or price > ek_max:
                    ek_max = price

        if ek_min is None and ek_max is not None:
            ek_min = ek_max
        if ek_max is None and ek_min is not None:
            ek_max = ek_min

        return recommended, ek_min, ek_max, currency

    def _normalize_item(self, item: dict) -> NormalizedItem:
        sku = item.get("skuExternalId") or item.get("skuId") or item.get("sku") or ""
        title = item.get("displayName") or item.get("name") or ""
        description = item.get("description") or item.get("shortDescription") or ""
        recommended, ek_min, ek_max, currency = self._extract_pricing(item)
        return NormalizedItem(
            source=self.source,
            sku=str(sku),
            title=str(title),
            shortDescription=str(description),
            recommendedVK=recommended,
            ekMin=ek_min,
            ekMax=ek_max,
            currency=currency,
        )

    async def search(self, query: str, options: Optional[dict] = None) -> List[NormalizedItem]:
        params = {"search": query}
        if options:
            params.update(options)
        payload = await self._fetch_products(params)
        items = payload.get("items") or payload.get("products") or []
        return [self._normalize_item(item) for item in items if isinstance(item, dict)]

    async def get_by_sku(self, sku: str) -> NormalizedItem:
        params = {"sku": sku}
        payload = await self._fetch_products(params)
        items = payload.get("items") or payload.get("products") or []
        for item in items:
            if not isinstance(item, dict):
                continue
            candidate = item.get("skuExternalId") or item.get("skuId") or item.get("sku")
            if candidate and str(candidate) == sku:
                return self._normalize_item(item)
        if items:
            return self._normalize_item(items[0])
        raise ValueError("SKU not found")
