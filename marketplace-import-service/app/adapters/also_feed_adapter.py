import csv
import io
import logging
import os
import stat
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

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
        if not host or not user:
            raise ValueError("ALSO SFTP credentials missing")
        transport = paramiko.Transport((host, port))
        transport.connect(username=user, password=password)
        return paramiko.SFTPClient.from_transport(transport)

    def fetch_latest_price_file(self, sftp: paramiko.SFTPClient) -> Tuple[str, bytes]:
        override = load_also_config()
        directory = override.get("dir") or settings.also_sftp_dir or "."
        latest = self._find_latest_entry(sftp, directory)
        if not latest:
            raise ValueError("No price files found")
        path = f"{directory.rstrip('/')}/{latest.filename}"
        logger.info("Fetching ALSO price file: %s", path)
        with sftp.open(path, "rb") as handle:
            data = handle.read()
        if latest.filename.lower().endswith(".zip"):
            inner_name, inner_data = self._extract_zip_payload(data)
            return f"{latest.filename}:{inner_name}", inner_data
        return latest.filename, data

    @staticmethod
    def _find_latest_entry(
        sftp: paramiko.SFTPClient, directory: str
    ) -> Optional[paramiko.SFTPAttributes]:
        entries = sftp.listdir_attr(directory)
        candidates = []
        for entry in entries:
            if stat.S_ISDIR(entry.st_mode):
                continue
            if entry.filename.lower().endswith((".csv", ".txt", ".zip")):
                candidates.append(entry)
        if not candidates:
            return None
        return max(candidates, key=lambda item: item.st_mtime)

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
            dialect = csv.Sniffer().sniff(sample, delimiters=";\t,|")
        except csv.Error:
            dialect = csv.excel
            dialect.delimiter = ";"
        reader = csv.reader(stream, dialect=dialect)
        first_row = next(reader, None)
        if not first_row:
            return
        if self._looks_like_header(first_row):
            dict_reader = csv.DictReader(stream, fieldnames=first_row, dialect=dialect)
            for row in dict_reader:
                try:
                    item = self.map_to_normalized_item(row)
                    if not item.sku:
                        logger.warning("Skipping row without SKU")
                        continue
                    yield item
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Skipping invalid row: %s", exc)
                    continue
            return

        # No header present: map by column positions
        rows = [first_row]
        for row in rows:
            try:
                item = self.map_to_normalized_item(self._map_row_by_index(row))
                if not item.sku:
                    logger.warning("Skipping row without SKU")
                    continue
                yield item
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping invalid row: %s", exc)
                continue
        for row in reader:
            try:
                item = self.map_to_normalized_item(self._map_row_by_index(row))
                if not item.sku:
                    logger.warning("Skipping row without SKU")
                    continue
                yield item
            except Exception as exc:  # noqa: BLE001
                logger.warning("Skipping invalid row: %s", exc)
                continue

    @staticmethod
    def _looks_like_header(row: List[str]) -> bool:
        expected = {
            "ArtikelNr",
            "Hersteller",
            "HerstellerArtNr",
            "Bezeichnung",
            "Bestand",
            "HEK",
            "Listpreis",
            "Produktkategorie",
            "Produktfamilie",
            "Produktgruppe",
            "EAN",
            "EOL",
            "Gewicht",
            "prodid",
            "manufacturerpartnumber",
            "manufacturername",
            "description",
            "availablequantity",
            "netprice",
        }
        return any(
            cell.strip().replace(" ", "").lower() in expected
            for cell in row
            if isinstance(cell, str)
        )

    @staticmethod
    def _map_row_by_index(row: List[str]) -> Dict[str, str]:
        def get(idx: int) -> str:
            if idx < 0 or idx >= len(row):
                return ""
            return str(row[idx]).strip()

        return {
            "ArtikelNr": get(0),
            "HerstellerArtNr": get(1),
            "Hersteller": get(2),
            "EAN": get(3),
            "Bezeichnung": get(4),
            "Bestand": get(5),
            "HEK": get(6),
            "Listpreis": get(7),
            "Produktkategorie": get(8),
            "Produktfamilie": get(9),
            "Produktgruppe": get(10),
            "EOL": get(11),
            "Gewicht": get(12),
        }

    def map_to_normalized_item(self, row: dict) -> NormalizedItem:
        def get_any(*keys: str) -> str:
            for key in keys:
                value = row.get(key)
                if value not in (None, ""):
                    return str(value).strip()
            normalized = {
                str(k).strip().lower().replace(" ", ""): k for k in row.keys()
            }
            for key in keys:
                lookup = key.strip().lower().replace(" ", "")
                if lookup in normalized:
                    value = row.get(normalized[lookup])
                    if value not in (None, ""):
                        return str(value).strip()
            return ""

        sku = get_any("ArtikelNr", "ProdID", "ProductID", "SKU")
        manufacturer = get_any("Hersteller", "ManufacturerName", "Manufacturer")
        manufacturer_part = get_any("HerstellerArtNr", "ManufacturerPartNumber", "MPN")
        short_description = " ".join(
            value
            for value in [
                manufacturer,
                manufacturer_part,
                get_any("Produktfamilie", "ProductFamily"),
                get_any("Produktgruppe", "ProductGroup"),
            ]
            if value
        )
        item = NormalizedItem(
            source="also",
            sku=sku,
            manufacturerPartNumber=manufacturer_part,
            manufacturer=manufacturer,
            ean=get_any("EAN"),
            title=get_any("Bezeichnung", "Description", "Title"),
            stock=self._parse_int(get_any("Bestand", "AvailableQuantity", "Stock")),
            ek=self._parse_decimal(get_any("HEK", "NetPrice", "PriceNet")),
            recommendedVK=self._parse_decimal(get_any("Listpreis", "ListPrice", "PriceList")),
            category=get_any("Produktkategorie", "ProductCategory", "Category"),
            family=get_any("Produktfamilie", "ProductFamily"),
            group=get_any("Produktgruppe", "ProductGroup"),
            eol=self._parse_bool(get_any("EOL")),
            weight=self._parse_decimal(get_any("Gewicht", "Weight")),
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
            override = load_also_config()
            directory = override.get("dir") or settings.also_sftp_dir or "."
            latest = self._find_latest_entry(sftp, directory)
            if not latest:
                raise ValueError("No price files found")
            filename = latest.filename
            size = int(latest.st_size or 0)
            latest_mtime = datetime.fromtimestamp(latest.st_mtime, tz=timezone.utc).isoformat().replace(
                "+00:00", "Z"
            )
            meta = self._store.get_meta()
            return {
                "connected": True,
                "latest_file": filename,
                "latest_size": size,
                "latest_mtime": latest_mtime,
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
                "latest_mtime": "",
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
