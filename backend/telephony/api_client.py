import json
import os
import time
from typing import Dict, Generator, Optional

import requests


class NfonCtiClient:
    def __init__(
        self,
        base_url: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        refresh_token: Optional[str] = None,
    ):
        default_base_url = "https://providersupportdata.cloud-cfg.com"
        self.base_url = (
            base_url or os.environ.get("NFON_CTI_BASE_URL") or default_base_url
        ).rstrip("/")
        self.username = username or os.environ.get("NFON_CTI_USER")
        self.password = password or os.environ.get("NFON_CTI_PASSWORD")
        self._refresh_token = refresh_token or os.environ.get("NFON_CTI_REFRESH_TOKEN")
        self._token: Optional[str] = None
        self._token_expiry = 0.0

    def login(self) -> str:
        if not self.base_url:
            raise RuntimeError("NFON_CTI_BASE_URL is not configured")
        if self._refresh_token:
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {self._refresh_token}",
            }
            response = requests.put(
                f"{self.base_url}/v1/login", headers=headers, timeout=15
            )
        else:
            if not self.username or not self.password:
                raise RuntimeError(
                    "NFON_CTI_USER/NFON_CTI_PASSWORD or refresh token missing"
                )
            payload = {"username": self.username, "password": self.password}
            response = requests.post(
                f"{self.base_url}/v1/login", json=payload, timeout=15
            )
        response.raise_for_status()
        data = response.json()
        token = (
            data.get("accessToken")
            or data.get("access_token")
            or data.get("access-token")
            or data.get("token")
        )
        if not token:
            raise RuntimeError("Login succeeded but no token returned")
        self._token = token
        refresh_token = (
            data.get("refreshToken")
            or data.get("refresh_token")
            or data.get("refresh-token")
        )
        if refresh_token:
            self._refresh_token = refresh_token
        ttl = data.get("expiresIn") or data.get("expires_in") or 3600
        self._token_expiry = time.time() + int(ttl) - 30
        return token

    def _get_token(self) -> str:
        if not self._token or time.time() >= self._token_expiry:
            return self.login()
        return self._token

    def stream_calls(self) -> Generator[Dict, None, None]:
        token = self._get_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "text/event-stream",
        }
        url = f"{self.base_url}/v1/extensions/phone/calls"
        with requests.get(url, headers=headers, stream=True, timeout=60) as response:
            response.raise_for_status()
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                if line.startswith("data:"):
                    raw = line.replace("data:", "", 1).strip()
                    if not raw:
                        continue
                    try:
                        payload = json.loads(raw)
                    except json.JSONDecodeError:
                        continue
                    yield payload
