import re
from typing import Dict, Optional


def normalize_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = "43" + digits[1:]
    return digits


def resolve_customer_name(phone: Optional[str], mapping: Dict[str, str]) -> Optional[str]:
    normalized = normalize_phone(phone)
    if not normalized:
        return None
    return mapping.get(normalized)
