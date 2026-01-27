from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import requests


class SevdeskError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None, payload: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass
class SevdeskConfig:
    base_url: str
    api_token: str
    contact_person_id: Optional[int]
    address_country_id: int
    tax_type: str
    tax_rule_id: int
    tax_text: str
    currency: str
    invoice_type: str
    default_tax_rate: float
    unity_id: int
    service_unity_id: Optional[int] = None
    device_unity_id: Optional[int] = None
    hourly_rate_eur: Optional[float] = None


DEFAULT_ADDRESS_COUNTRY_ID = 1
DEFAULT_UNITY_ID = 1
DEFAULT_TAX_RULE_ID = 1
DEFAULT_TAX_TYPE = "default"
DEFAULT_TAX_TEXT = "zzgl. Umsatzsteuer"
DEFAULT_CURRENCY = "EUR"
DEFAULT_INVOICE_TYPE = "RE"


class SevdeskClient:
    def __init__(self, config: SevdeskConfig, timeout: int = 20) -> None:
        self.config = config
        self.timeout = timeout
        self._contact_person_id_cache: Optional[int] = None

    def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.config.base_url.rstrip('/')}{path}"
        headers = {
            "Authorization": self.config.api_token,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "IT-Dashboard",
        }
        response = requests.request(
            method,
            url,
            params=params,
            json=payload,
            headers=headers,
            timeout=self.timeout,
        )
        if not response.ok:
            raise SevdeskError(
                f"Sevdesk API error {response.status_code}: {response.text}",
                status_code=response.status_code,
                payload=response.text,
            )
        if not response.text:
            return {}
        return response.json()

    def _extract_first(self, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not isinstance(payload, dict):
            return None
        objects = payload.get("objects")
        if isinstance(objects, list):
            return objects[0] if objects else None
        if isinstance(objects, dict):
            return objects
        return None

    def get_contact_by_customer_number(self, customer_number: str) -> Optional[Dict[str, Any]]:
        payload = self.request(
            "GET",
            "/Contact",
            params={
                "customerNumber": customer_number,
                "limit": 1,
                "offset": 0,
            },
        )
        return self._extract_first(payload)

    def get_contact(self, contact_id: int) -> Optional[Dict[str, Any]]:
        payload = self.request("GET", f"/Contact/{contact_id}")
        return self._extract_first(payload)

    def find_draft_invoice(self, contact_id: int) -> Optional[Dict[str, Any]]:
        payload = self.request(
            "GET",
            "/Invoice",
            params={
                "status": 100,
                "contact[id]": contact_id,
                "contact[objectName]": "Contact",
                "limit": 1,
                "offset": 0,
            },
        )
        return self._extract_first(payload)

    def get_invoice(self, invoice_id: int) -> Optional[Dict[str, Any]]:
        payload = self.request("GET", f"/Invoice/{invoice_id}")
        return self._extract_first(payload)

    def extract_invoice_number(self, invoice: Optional[Dict[str, Any]]) -> Optional[str]:
        if not invoice:
            return None
        for key in ("invoiceNumber", "invoiceNumberDefault", "number"):
            value = invoice.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def get_next_invoice_number(self, invoice_type: Optional[str] = None) -> Optional[str]:
        params: Dict[str, Any] = {}
        if invoice_type:
            params["invoiceType"] = invoice_type
        payload = self.request("GET", "/Invoice/Factory/getNextInvoiceNumber", params=params)
        obj = self._extract_first(payload) or {}
        if isinstance(obj, dict):
            for key in ("invoiceNumber", "invoiceNumberDefault", "number", "nextInvoiceNumber"):
                value = obj.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        for key in ("invoiceNumber", "invoiceNumberDefault", "number", "nextInvoiceNumber"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    def list_invoices(
        self,
        params: Optional[Dict[str, Any]] = None,
        *,
        limit: int = 100,
        max_pages: int = 25,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        base_params = dict(params or {})
        safe_limit = max(1, min(int(base_params.get("limit") or limit), 500))
        for page in range(max_pages):
            request_params = {**base_params, "limit": safe_limit, "offset": page * safe_limit}
            payload = self.request("GET", "/Invoice", params=request_params)
            objects = payload.get("objects")
            if isinstance(objects, list):
                items = objects
            elif isinstance(objects, dict):
                items = [objects]
            else:
                items = []
            if not items:
                break
            results.extend(items)
            if len(items) < safe_limit:
                break
        return results

    def get_default_contact_person_id(self) -> Optional[int]:
        if self._contact_person_id_cache:
            return self._contact_person_id_cache
        payload = self.request("GET", "/SevUser", params={"limit": 1, "offset": 0})
        user = self._extract_first(payload)
        try:
            user_id = int(user.get("id")) if user and user.get("id") is not None else None
        except (TypeError, ValueError):
            user_id = None
        if user_id:
            self._contact_person_id_cache = user_id
        return user_id

    def save_invoice(self, invoice_payload: Dict[str, Any], positions: List[Dict[str, Any]]) -> Dict[str, Any]:
        payload = {
            "invoice": invoice_payload,
            "invoicePosSave": positions,
            "invoicePosDelete": None,
            "discountSave": [],
            "discountDelete": None,
        }
        return self.request("POST", "/Invoice/Factory/saveInvoice", payload=payload)

    def build_invoice_payload(
        self,
        contact_id: int,
        invoice_id: Optional[int] = None,
        invoice_snapshot: Optional[Dict[str, Any]] = None,
        header: Optional[str] = None,
    ) -> Dict[str, Any]:
        if invoice_snapshot:
            invoice_date = invoice_snapshot.get("invoiceDate")
            status = invoice_snapshot.get("status", 100)
            tax_type = invoice_snapshot.get("taxType") or self.config.tax_type or DEFAULT_TAX_TYPE
            tax_text = invoice_snapshot.get("taxText") or self.config.tax_text or DEFAULT_TAX_TEXT
            currency = invoice_snapshot.get("currency") or self.config.currency or DEFAULT_CURRENCY
            tax_rule = invoice_snapshot.get("taxRule") or {
                "id": str(self.config.tax_rule_id or DEFAULT_TAX_RULE_ID),
                "objectName": "TaxRule",
            }
            contact_person = invoice_snapshot.get("contactPerson")
            if not contact_person:
                contact_person_id = self.config.contact_person_id or self.get_default_contact_person_id()
                if contact_person_id:
                    contact_person = {
                        "id": contact_person_id,
                        "objectName": "SevUser",
                    }
            address_country = invoice_snapshot.get("addressCountry") or {
                "id": self.config.address_country_id or DEFAULT_ADDRESS_COUNTRY_ID,
                "objectName": "StaticCountry",
            }
            invoice_type = invoice_snapshot.get("invoiceType") or self.config.invoice_type or DEFAULT_INVOICE_TYPE
            discount = invoice_snapshot.get("discount", 0)
            tax_rate = invoice_snapshot.get("taxRate", self.config.default_tax_rate)
            header_value = None
        else:
            invoice_date = datetime.now().strftime("%d.%m.%Y")
            status = 100
            tax_type = self.config.tax_type or DEFAULT_TAX_TYPE
            tax_text = self.config.tax_text or DEFAULT_TAX_TEXT
            currency = self.config.currency or DEFAULT_CURRENCY
            tax_rule = {"id": str(self.config.tax_rule_id or DEFAULT_TAX_RULE_ID), "objectName": "TaxRule"}
            contact_person = None
            contact_person_id = self.config.contact_person_id or self.get_default_contact_person_id()
            if contact_person_id:
                contact_person = {
                    "id": contact_person_id,
                    "objectName": "SevUser"
                }
            address_country = {
                "id": self.config.address_country_id or DEFAULT_ADDRESS_COUNTRY_ID,
                "objectName": "StaticCountry"
            }
            invoice_type = self.config.invoice_type or DEFAULT_INVOICE_TYPE
            discount = 0
            tax_rate = self.config.default_tax_rate
            header_value = None

        payload = {
            "objectName": "Invoice",
            "mapAll": True,
            "invoiceDate": invoice_date,
            "status": status,
            "taxType": tax_type,
            "taxText": tax_text,
            "taxRule": tax_rule,
            "taxRate": tax_rate,
            "invoiceType": invoice_type,
            "currency": currency,
            "discount": discount,
            "contact": {"id": contact_id, "objectName": "Contact"},
            "addressCountry": address_country,
        }
        header_value = (header or "").strip()
        if not header_value and invoice_snapshot:
            existing_header = invoice_snapshot.get("header")
            if isinstance(existing_header, str) and existing_header.strip():
                header_value = existing_header.strip()
        if header_value:
            payload["header"] = header_value
        if not contact_person:
            raise SevdeskError(
                "Missing Sevdesk contact person. Please configure sevdesk_contact_person_id.",
                status_code=400,
            )
        if contact_person:
            payload["contactPerson"] = contact_person
        if invoice_id is not None:
            payload["id"] = invoice_id
        return payload

    def build_positions(self, items: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        positions: List[Dict[str, Any]] = []
        for item in items:
            unity_id = item.get("unity_id") or self.config.unity_id or DEFAULT_UNITY_ID
            quantity = item.get("quantity")
            price = item.get("price")
            tax_rate = item.get("tax_rate", self.config.default_tax_rate)
            try:
                quantity = float(quantity) if quantity is not None else None
            except (TypeError, ValueError):
                quantity = None
            try:
                price = float(price) if price is not None else None
            except (TypeError, ValueError):
                price = None
            try:
                tax_rate = float(tax_rate) if tax_rate is not None else None
            except (TypeError, ValueError):
                tax_rate = None
            position = {
                "objectName": "InvoicePos",
                "mapAll": True,
                "quantity": quantity,
                "price": price,
                "name": item.get("name"),
                "text": item.get("text"),
                "taxRate": tax_rate,
                "unity": {"id": unity_id, "objectName": "Unity"},
            }
            positions.append(position)
        return positions
