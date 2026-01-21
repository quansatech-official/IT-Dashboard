import json
import os
from typing import Any, Dict

from app.config import settings


def load_also_config() -> Dict[str, Any]:
    if not os.path.exists(settings.also_config_path):
        return {}
    try:
        with open(settings.also_config_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return payload if isinstance(payload, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def persist_also_config(payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(settings.also_config_path), exist_ok=True)
    with open(settings.also_config_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=True)
