import json
import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple


WORKBENCH_USE_CASE_IMPROVE_OFFER_TEXT = "ImproveOfferText"
WORKBENCH_USE_CASE_GENERATE_CUSTOMER_TEXT_SUGGESTIONS = "GenerateCustomerTextSuggestions"
WORKBENCH_USE_CASE_TRANSLATE_TECHNICAL_TO_CUSTOMER_LANGUAGE = "TranslateTechnicalToCustomerLanguage"
WORKBENCH_USE_CASE_GENERATE_CUSTOMER_REPORT_ENTRY = "GenerateCustomerReportEntry"
WORKBENCH_USE_CASE_GENERATE_CUSTOMER_CONTRACT_DRAFT = "GenerateCustomerContractDraft"

WORKBENCH_USE_CASES = {
    WORKBENCH_USE_CASE_IMPROVE_OFFER_TEXT,
    WORKBENCH_USE_CASE_GENERATE_CUSTOMER_TEXT_SUGGESTIONS,
    WORKBENCH_USE_CASE_TRANSLATE_TECHNICAL_TO_CUSTOMER_LANGUAGE,
    WORKBENCH_USE_CASE_GENERATE_CUSTOMER_REPORT_ENTRY,
    WORKBENCH_USE_CASE_GENERATE_CUSTOMER_CONTRACT_DRAFT,
}


@dataclass
class WorkbenchAiRuntime:
    load_prompts: Callable[[], Dict[str, Any]]
    render_prompt: Callable[[str, Dict[str, str]], str]
    resolve_models: Callable[..., List[str]]
    generate: Callable[..., Tuple[Dict[str, Any], str, str]]
    parse_action_json: Callable[[Any], Optional[Dict[str, str]]]
    build_action_fallback: Callable[[str], Dict[str, str]]
    build_offer_fallback: Callable[[str, str, str], str]
    sanitize_invoice_text: Callable[[Any], str]
    tool_timeout_seconds: int
    tool_max_tokens: int
    system_prompt: Optional[str] = None


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").split()).strip()


def clean_multiline_text(value: Any) -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return ""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def normalize_tone(value: Any) -> str:
    tone = clean_text(value).lower().replace(" ", "_")
    allowed = {
        "kurz",
        "sachlich",
        "kundenfreundlich",
        "technisch",
        "leicht_verstaendlich",
        "leicht_verst\u00e4ndlich",
    }
    if tone == "leicht_verst\u00e4ndlich":
        tone = "leicht_verstaendlich"
    return tone if tone in allowed else "sachlich"


def extract_json_object(raw: Any) -> Optional[Dict[str, Any]]:
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str) or not raw.strip():
        return None
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            parsed = json.loads(text[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None


def normalize_suggestions(raw: Any) -> List[Dict[str, str]]:
    payload = extract_json_object(raw)
    items = None
    if payload:
        items = payload.get("suggestions")
    elif isinstance(raw, list):
        items = raw
    if not isinstance(items, list):
        return []
    normalized: List[Dict[str, str]] = []
    for item in items[:5]:
        if isinstance(item, str):
            text = clean_text(item)
            if text:
                normalized.append({"title": "", "text": text})
            continue
        if not isinstance(item, dict):
            continue
        text = clean_text(item.get("text") or item.get("body") or item.get("suggestion"))
        if not text:
            continue
        normalized.append(
            {
                "title": clean_text(item.get("title") or item.get("label")),
                "text": text,
                "purpose": clean_text(item.get("purpose") or item.get("use")),
            }
        )
    return normalized


def default_workbench_prompts() -> Dict[str, str]:
    return {
        "customer_text_suggestions": (
            "Erstelle {count} konkrete, unterschiedliche Textvorschlaege fuer einen IT-Dienstleister.\n"
            "Ton: {tone}. Verwendungszweck: {mode}.\n\n"
            "Anforderungen:\n"
            "- Antworte ausschliesslich als JSON mit dem Feld \"suggestions\"\n"
            "- Jeder Vorschlag ist ein Objekt mit \"title\" (kurze Beschriftung), \"text\" (der eigentliche Text) und \"purpose\" (Einsatzzweck)\n"
            "- Deutsch, direkt, sachlich — keine Marketingfloskeln, kein Markdown im Text\n"
            "- Texte sollen sofort verwendbar sein, ohne weitere Bearbeitung\n\n"
            "Kunde: {customer_name}\n"
            "Thema: {topic}\n"
            "Kontext:\n{context}\n\n"
            "Antworte nur mit dem JSON-Objekt, ohne erklaerende Saetze darum."
        ),
        "technical_to_customer_language": (
            "Formuliere den folgenden technischen Sachverhalt so um, dass ein Geschaeftskunde ihn versteht.\n"
            "Ton: {tone}. Zielgruppe: {audience_level}.\n\n"
            "Regeln:\n"
            "- Erklaere was passiert ist, welche Auswirkung das hat und was als naechstes geschieht\n"
            "- Keine internen Fachbegriffe, keine Schuldzuweisungen, kein IT-Jargon\n"
            "- Kein Markdown, keine Aufzaehlungszeichen — fliesender Text\n"
            "- Maximal 4 Saetze\n\n"
            "Technischer Text:\n{technical_text}\n\n"
            "Zusaetzlicher Kontext:\n{context}"
        ),
        "customer_contract_draft": (
            "Extrahiere aus dem folgenden Freitext strukturierte Vertragsdaten fuer einen IT-Dienstleister.\n\n"
            "Regeln:\n"
            "- Antworte ausschliesslich als JSON-Objekt\n"
            "- Vertragspreis ist immer ein fester individueller Monatswert, kein Tarifmodell\n"
            "- Wenn ein Wert nicht eindeutig erkennbar ist, leer lassen oder sinnvollen Standard verwenden und in hints/missing_fields markieren\n"
            "- Datumswerte als YYYY-MM-DD, falls eindeutig erkennbar\n"
            "- doc_type ist einer von: wartung, monitoring, avv_dsgvo\n"
            "- monthly_total_eur ist eine Zahl ohne Waehrungszeichen\n\n"
            "JSON-Schema:\n"
            "{\n"
            "  \"title\": \"kurzer Vertragstitel\",\n"
            "  \"doc_type\": \"wartung|monitoring|avv_dsgvo\",\n"
            "  \"service_scope\": \"knapper Leistungsumfang\",\n"
            "  \"monthly_total_eur\": 0,\n"
            "  \"valid_from\": \"YYYY-MM-DD oder leer\",\n"
            "  \"runtime_months\": 12,\n"
            "  \"termination_notice_months\": 3,\n"
            "  \"auto_extension_months\": 12,\n"
            "  \"monthly_hours_included\": 0,\n"
            "  \"billing_interval\": \"monatlich\",\n"
            "  \"hints\": [\"kurze Hinweise\"],\n"
            "  \"missing_fields\": [\"preis\", \"startdatum\"]\n"
            "}\n\n"
            "Kunde: {customer_name}\n"
            "Freitext:\n{source_text}"
        ),
    }


class WorkbenchAiService:
    def __init__(self, runtime: WorkbenchAiRuntime):
        self.runtime = runtime

    def execute(self, use_case: str, data: Dict[str, Any]) -> Dict[str, Any]:
        normalized = clean_text(use_case)
        if normalized == WORKBENCH_USE_CASE_IMPROVE_OFFER_TEXT:
            return self.improve_offer_text(data)
        if normalized == WORKBENCH_USE_CASE_GENERATE_CUSTOMER_REPORT_ENTRY:
            return self.generate_customer_report_entry(data)
        if normalized == WORKBENCH_USE_CASE_GENERATE_CUSTOMER_TEXT_SUGGESTIONS:
            return self.generate_customer_text_suggestions(data)
        if normalized == WORKBENCH_USE_CASE_TRANSLATE_TECHNICAL_TO_CUSTOMER_LANGUAGE:
            return self.translate_technical_to_customer_language(data)
        if normalized == WORKBENCH_USE_CASE_GENERATE_CUSTOMER_CONTRACT_DRAFT:
            return self.generate_customer_contract_draft(data)
        raise ValueError(f"Unsupported Workbench AI use case: {use_case}")

    def improve_offer_text(self, data: Dict[str, Any]) -> Dict[str, Any]:
        mode = clean_text(data.get("mode")).lower()
        if not mode:
            raise ValueError("Mode required")
        preserve_lines = mode == "invoice_position_text"
        cleaner = clean_multiline_text if preserve_lines else clean_text
        current_text = cleaner(data.get("current_text") or data.get("currentText"))
        context = cleaner(data.get("context"))
        purpose = "invoice_summary" if mode == "invoice_position_text" else "offer_text"

        prompts = self.runtime.load_prompts()
        mode_instructions = prompts.get("offer_mode_instructions") or {}
        instruction = mode_instructions.get(mode, "Schreibe einen kurzen, passenden Text.")
        prompt = self.runtime.render_prompt(
            prompts.get("offer_base_prompt") or "",
            {
                "instruction": instruction,
                "context": context or "n/a",
                "current_text": current_text or "n/a",
            },
        )

        payload, model, provider = self.runtime.generate(
            prompt,
            model_candidates=self.runtime.resolve_models(purpose=purpose),
            purpose=purpose,
            temperature=0.2,
            max_tokens=self.runtime.tool_max_tokens,
            timeout=self.runtime.tool_timeout_seconds,
            system_prompt=self.runtime.system_prompt,
        )
        text = cleaner((payload or {}).get("response"))
        if mode == "invoice_position_text":
            text = self.runtime.sanitize_invoice_text(text)
        if not text:
            return {
                "text": self.runtime.build_offer_fallback(mode, current_text, context),
                "provider": "fallback",
                "model": "",
                "usedFallback": True,
            }
        return {"text": text, "provider": provider, "model": model, "usedFallback": False}

    def generate_customer_report_entry(self, data: Dict[str, Any]) -> Dict[str, Any]:
        text = clean_text(data.get("text") or data.get("source_text") or data.get("sourceText"))
        if not text:
            raise ValueError("Text required")

        prompts = self.runtime.load_prompts()
        action_prompt = prompts.get("action_prompt") or ""
        prompt = self.runtime.render_prompt(action_prompt, {"text": text})
        if "{text}" not in action_prompt and "Text:" not in prompt:
            prompt = f"{prompt}\n\nText: {text}"

        payload, model, provider = self.runtime.generate(
            prompt,
            model_candidates=self.runtime.resolve_models(purpose="action"),
            purpose="action",
            response_format="json",
            temperature=0.2,
            max_tokens=self.runtime.tool_max_tokens,
            timeout=self.runtime.tool_timeout_seconds,
            system_prompt=self.runtime.system_prompt,
        )
        action = self.runtime.parse_action_json((payload or {}).get("response"))
        if not action:
            fallback = self.runtime.build_action_fallback(text)
            fallback.update({"provider": "fallback", "model": "", "usedFallback": True})
            return fallback
        action.update({"provider": provider, "model": model, "usedFallback": False})
        return action

    def generate_customer_text_suggestions(self, data: Dict[str, Any]) -> Dict[str, Any]:
        prompts = self.runtime.load_prompts()
        workbench_prompts = {
            **default_workbench_prompts(),
            **(prompts.get("workbench_use_case_prompts") or {}),
        }
        count = max(1, min(5, int(data.get("count") or 3)))
        prompt = self.runtime.render_prompt(
            workbench_prompts["customer_text_suggestions"],
            {
                "tone": normalize_tone(data.get("tone")),
                "mode": clean_text(data.get("mode")) or "kundenfreundlich",
                "count": str(count),
                "customer_name": clean_text(data.get("customer_name") or data.get("customerName")) or "n/a",
                "topic": clean_text(data.get("topic")) or "n/a",
                "context": clean_text(data.get("context")) or "n/a",
            },
        )
        payload, model, provider = self.runtime.generate(
            prompt,
            model_candidates=self.runtime.resolve_models(purpose="customer_development"),
            purpose="customer_development",
            response_format="json",
            temperature=0.35,
            max_tokens=min(900, self.runtime.tool_max_tokens),
            timeout=self.runtime.tool_timeout_seconds,
            system_prompt=self.runtime.system_prompt,
        )
        suggestions = normalize_suggestions((payload or {}).get("response"))
        if not suggestions:
            source = clean_text(data.get("context") or data.get("topic"))
            fallback_text = source[:420].rstrip(" ,;:-") or "Wir melden uns mit einer klaren Einschaetzung und dem naechsten sinnvollen Schritt."
            suggestions = [{"title": "Vorschlag", "text": fallback_text, "purpose": "fallback"}]
            return {
                "suggestions": suggestions,
                "provider": "fallback",
                "model": "",
                "usedFallback": True,
            }
        return {"suggestions": suggestions, "provider": provider, "model": model, "usedFallback": False}

    def translate_technical_to_customer_language(self, data: Dict[str, Any]) -> Dict[str, Any]:
        technical_text = clean_text(data.get("technical_text") or data.get("technicalText") or data.get("text"))
        if not technical_text:
            raise ValueError("Technical text required")
        prompts = self.runtime.load_prompts()
        workbench_prompts = {
            **default_workbench_prompts(),
            **(prompts.get("workbench_use_case_prompts") or {}),
        }
        prompt = self.runtime.render_prompt(
            workbench_prompts["technical_to_customer_language"],
            {
                "tone": normalize_tone(data.get("tone")),
                "audience_level": clean_text(data.get("audience_level") or data.get("audienceLevel")) or "leicht verstaendlich",
                "technical_text": technical_text,
                "context": clean_text(data.get("context")) or "n/a",
            },
        )
        payload, model, provider = self.runtime.generate(
            prompt,
            model_candidates=self.runtime.resolve_models(purpose="customer_development"),
            purpose="customer_development",
            temperature=0.25,
            max_tokens=min(800, self.runtime.tool_max_tokens),
            timeout=self.runtime.tool_timeout_seconds,
            system_prompt=self.runtime.system_prompt,
        )
        text = clean_text((payload or {}).get("response"))
        if not text:
            text = technical_text[:520].rstrip(" ,;:-") + "."
            return {"text": text, "provider": "fallback", "model": "", "usedFallback": True}
        return {"text": text, "provider": provider, "model": model, "usedFallback": False}

    def generate_customer_contract_draft(self, data: Dict[str, Any]) -> Dict[str, Any]:
        source_text = clean_text(data.get("source_text") or data.get("sourceText") or data.get("text"))
        if not source_text:
            raise ValueError("Text required")
        prompts = self.runtime.load_prompts()
        workbench_prompts = {
            **default_workbench_prompts(),
            **(prompts.get("workbench_use_case_prompts") or {}),
        }
        prompt = self.runtime.render_prompt(
            workbench_prompts["customer_contract_draft"],
            {
                "customer_name": clean_text(data.get("customer_name") or data.get("customerName")) or "n/a",
                "source_text": source_text,
            },
        )
        payload, model, provider = self.runtime.generate(
            prompt,
            model_candidates=self.runtime.resolve_models(purpose="customer_development"),
            purpose="customer_development",
            response_format="json",
            temperature=0.15,
            max_tokens=min(900, self.runtime.tool_max_tokens),
            timeout=self.runtime.tool_timeout_seconds,
            system_prompt=self.runtime.system_prompt,
        )
        draft = extract_json_object((payload or {}).get("response")) or {}
        if not draft:
            draft = {
                "title": "",
                "doc_type": "wartung",
                "service_scope": source_text[:700],
                "monthly_total_eur": 0,
                "valid_from": "",
                "runtime_months": 12,
                "termination_notice_months": 3,
                "auto_extension_months": 12,
                "monthly_hours_included": 0,
                "billing_interval": "monatlich",
                "hints": ["KI-Antwort konnte nicht strukturiert gelesen werden."],
                "missing_fields": ["preis"],
            }
            return {"draft": draft, "provider": "fallback", "model": "", "usedFallback": True}
        return {"draft": draft, "provider": provider, "model": model, "usedFallback": False}
