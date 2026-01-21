from abc import ABC, abstractmethod
from typing import List, Optional

from app.models.normalized_item import NormalizedItem


class DistributorAdapter(ABC):
    source: str

    @abstractmethod
    async def search(self, query: str, options: Optional[dict] = None) -> List[NormalizedItem]:
        raise NotImplementedError

    @abstractmethod
    async def get_by_sku(self, sku: str) -> NormalizedItem:
        raise NotImplementedError
