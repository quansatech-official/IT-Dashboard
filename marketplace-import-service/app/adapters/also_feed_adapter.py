import csv
import io
import logging
import os
import stat
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, List, Optional, Tuple

import paramiko

from app.config import settings
from app.models.normalized_item import NormalizedItem
from app.utils.also_feed_config import load_also_config
from app.utils.also_feed_store import AlsoFeedStore

logger = logging.getLogger("also_feed_adapter")


@dataclass
class AlsoImportResult:
    imported: int
    skipped: int
    errors: int
    filename: str


class AlsoFeedAdapter:
    def __init__(self) -> None:
        self._store = AlsoFeedStore(settings.also_feed_db_path)

    def connect_sftp(self) -> paramiko.SFTPClient:
        override = load_also_config()
        host = override.get("host") or settings.also_sftp_host
        port = int(override.get("port") or settings.also_sftp_port)
        user = override.get("user") or settings.also_sftp_user
        password = override.get("password") or settings.also_sftp_password
        key_path = override.get("key_path") or settings.also_sftp_key_path
        if not host or not user:
            raise ValueError("ALSO SFTP credentials missing")
        transport = paramiko.Transport((host, port))
        if key_path:
            key = paramiko.RSAKey.from_private_key_file(key_path)
            transport.connect(username=user, pkey=key)
        else:
            transport.connect(username=user, password=password)
        return paramiko.SFTPClient.from_transport(transport)

    def fetch_latest_price_file(self, sftp: paramiko.SFTPClient) -> Tuple[str, bytes]:
        override = load_also_config()
        directory = override.get("dir") or settings.also_sftp_dir or "."
        entries = sftp.listdir_attr(directory)
        candidates = []
        for entry in entries:
            if stat.S_ISDIR(entry.st_mode):
                continue
            if entry.filename.lower().endswith((".csv", ".txt", ".zip")):
                candidates.append(entry)
        if not candidates:
            raise ValueError("No price files found")
        latest = max(candidates, key=lambda item: item.st_mtime)
        path = f"{directory.rstrip('/')}/{latest.filename}"
        logger.info("Fetching ALSO price file: %s", path)
        with sftp.open(path, "rb") as handle:
            data = handle.read()
        if latest.filename.lower().endswith(".zip"):
            inner_name, inner_data = self._extract_zip_payload(data)
            return f"{latest.filename}:{inner_name}", inner_data
        return latest.filename, data

    @staticmethod
    def _extract_zip_payload(data: bytes) -> Tuple[str, bytes]:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            candidates = [
                info
                for info in archive.infolist()
                if not info.is_dir()
                and info.filename.lower().endswith((".csv", ".txt"))
            ]
            if not candidates:
                raise ValueError("Zip contains no CSV/TXT files")
            latest = max(candidates, key=lambda info: info.date_time)
            with archive.open(latest) as handle:
                content = handle.read()
            return latest.filename, content

    def parse_price_file(self, content: bytes) -> Iterable[NormalizedItem]:
        text = content.decode("latin-1", errors="replace")
        stream = io.StringIO(text)
        sample = stream.read(2048)
        stream.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=";\t,")
        except csv.Error:
            dialect = csv.excel
            dialect.delimiter = ";"
        reader = csv.DictReader(stream, dialect=dialect)
        for row in reader:
            try:
                item = self.map_to_normalized_item(row)
                if not item.sku:
                    logger.warning("Skipping row without SKU")
                    continue
                yield item
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping invalid row: %s", exc)
                continue

    def map_to_normalized_item(self, row: dict) -> NormalizedItem:
        def get(key: str) -> str:
            return str(row.get(key, "")).strip()

        sku = get("ArtikelNr")
        manufacturer = get("Hersteller")
        manufacturer_part = get("HerstellerArtNr")
        short_description = " ".join(
            value
            for value in [
                manufacturer,
                manufacturer_part,
                get("Produktfamilie"),
                get("Produktgruppe"),
            ]
            if value
        )
        item = NormalizedItem(
            source="also",
            sku=sku,
            manufacturerPartNumber=manufacturer_part,
            manufacturer=manufacturer,
            ean=get("EAN"),
            title=get("Bezeichnung"),
            stock=self._parse_int(get("Bestand")),
            ek=self._parse_decimal(get("HEK")),
            recommendedVK=self._parse_decimal(get("Listpreis")),
            category=get("Produktkategorie"),
            family=get("Produktfamilie"),
            group=get("Produktgruppe"),
            eol=self._parse_bool(get("EOL")),
            weight=self._parse_decimal(get("Gewicht")),
            shortDescription=short_description,
        )
        if item.ek is not None:
            item.ekMin = item.ek
            item.ekMax = item.ek
        return item

    def persist_items(self, items: Iterable[NormalizedItem]) -> int:
        return self._store.replace_items(items)

    def run_import(self) -> AlsoImportResult:
        imported = 0
        skipped = 0
        errors = 0
        filename = ""
        sftp = None
        imported_at = ""
        try:
            sftp = self.connect_sftp()
            filename, data = self.fetch_latest_price_file(sftp)
            items: List[NormalizedItem] = []
            for item in self.parse_price_file(data):
                if item.sku:
                    items.append(item)
                else:
                    skipped += 1
            imported = self.persist_items(items)
            imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            self._store.update_meta(imported, skipped, errors, filename, imported_at)
        except Exception as exc:  # noqa: BLE001
            logger.exception("ALSO import failed: %s", exc)
            errors += 1
            imported_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            self._store.update_meta(imported, skipped, errors, filename, imported_at)
        finally:
            if sftp:
                try:
                    sftp.close()
                except Exception:  # noqa: BLE001
                    pass
        return AlsoImportResult(imported=imported, skipped=skipped, errors=errors, filename=filename)

    def check_status(self) -> dict:
        sftp = None
        try:
            sftp = self.connect_sftp()
            filename, data = self.fetch_latest_price_file(sftp)
            size = len(data) if data else 0
            meta = self._store.get_meta()
            return {
                "connected": True,
                "latest_file": filename,
                "latest_size": size,
                "last_imported_at": meta.get("last_imported_at", ""),
                "last_imported_count": meta.get("last_imported_count", 0),
                "last_skipped_count": meta.get("last_skipped_count", 0),
                "last_error_count": meta.get("last_error_count", 0),
                "last_filename": meta.get("last_filename", ""),
                "error": "",
            }
        except Exception as exc:  # noqa: BLE001
            logger.exception("ALSO status check failed: %s", exc)
            meta = self._store.get_meta()
            return {
                "connected": False,
                "latest_file": "",
                "latest_size": 0,
                "last_imported_at": meta.get("last_imported_at", ""),
                "last_imported_count": meta.get("last_imported_count", 0),
                "last_skipped_count": meta.get("last_skipped_count", 0),
                "last_error_count": meta.get("last_error_count", 0),
                "last_filename": meta.get("last_filename", ""),
                "error": str(exc),
            }
        finally:
            if sftp:
                try:
                    sftp.close()
                except Exception:  # noqa: BLE001
                    pass

    @staticmethod
    def _parse_decimal(value: str) -> Optional[float]:
        if not value:
            return None
        normalized = value.replace(".", "").replace(",", ".")
        try:
            return float(normalized)
        except ValueError:
            return None

    @staticmethod
    def _parse_int(value: str) -> Optional[int]:
        if not value:
            return None
        try:
            return int(float(value.replace(",", ".")))
        except ValueError:
            return None

    @staticmethod
    def _parse_bool(value: str) -> Optional[bool]:
        if not value:
            return None
        lowered = value.lower()
        if lowered in ("1", "true", "yes", "ja"):
            return True
        if lowered in ("0", "false", "no", "nein"):
            return False
        return None
