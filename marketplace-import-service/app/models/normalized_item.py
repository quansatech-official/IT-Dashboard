from typing import Optional

from pydantic import BaseModel, Field


class NormalizedItem(BaseModel):
    source: str
    sku: str
    title: str
    shortDescription: str = Field(default="")
    recommendedVK: Optional[float] = None
    ekMin: Optional[float] = None
    ekMax: Optional[float] = None
    currency: Optional[str] = None
    manufacturerPartNumber: Optional[str] = None
    manufacturer: Optional[str] = None
    ean: Optional[str] = None
    stock: Optional[int] = None
    ek: Optional[float] = None
    category: Optional[str] = None
    family: Optional[str] = None
    group: Optional[str] = None
    eol: Optional[bool] = None
    weight: Optional[float] = None
