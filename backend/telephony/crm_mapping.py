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
    direct = mapping.get(normalized)
    if direct:
        return direct
    variants = []
    if normalized.startswith("43") and len(normalized) > 2:
        variants.append(normalized[2:])
        variants.append(f"0{normalized[2:]}")
    else:
        variants.append(f"43{normalized.lstrip('0')}")
    for variant in variants:
        name = mapping.get(variant)
        if name:
            return name
    return None
