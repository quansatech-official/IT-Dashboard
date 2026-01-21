from typing import List, Optional

from app.adapters.base import DistributorAdapter
from app.config import settings
from app.models.normalized_item import NormalizedItem
from app.utils.also_feed_store import AlsoFeedStore


class AlsoAdapter(DistributorAdapter):
    source = "also"

    def __init__(self) -> None:
        self._store = AlsoFeedStore(settings.also_feed_db_path)

    async def search(self, query: str, options: Optional[dict] = None) -> List[NormalizedItem]:
        limit = 50
        if options and isinstance(options, dict):
            limit = int(options.get("limit") or limit)
        return self._store.search(query, limit=limit)

    async def get_by_sku(self, sku: str) -> NormalizedItem:
        item = self._store.get_by_sku(sku)
        if not item:
            raise ValueError("SKU not found")
        return item
