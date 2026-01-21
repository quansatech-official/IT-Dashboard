from typing import List, Optional

from app.adapters.base import DistributorAdapter
from app.models.normalized_item import NormalizedItem


class AmazonAdapter(DistributorAdapter):
    source = "amazon"

    async def search(self, query: str, options: Optional[dict] = None) -> List[NormalizedItem]:
        raise NotImplementedError("AmazonAdapter is a placeholder.")

    async def get_by_sku(self, sku: str) -> NormalizedItem:
        raise NotImplementedError("AmazonAdapter is a placeholder.")
