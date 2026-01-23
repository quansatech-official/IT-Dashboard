from typing import List, Optional

from pydantic import BaseModel


class AlternativeSpec(BaseModel):
    name: str
    value: str
    unit: Optional[str] = None


class AlternativeProductContent(BaseModel):
    source: str = "icecat"
    title: Optional[str] = None
    description: Optional[str] = None
    images: Optional[List[str]] = None
    specs: Optional[List[AlternativeSpec]] = None
