import os
import sqlite3
from typing import Iterable, List, Optional

from app.models.normalized_item import NormalizedItem


SCHEMA = """
CREATE TABLE IF NOT EXISTS also_items (
    sku TEXT PRIMARY KEY,
    manufacturer_part_number TEXT,
    manufacturer TEXT,
    ean TEXT,
    title TEXT,
    stock INTEGER,
    ek REAL,
    recommended_vk REAL,
    category TEXT,
    family TEXT,
    product_group TEXT,
    eol INTEGER,
    weight REAL
);
CREATE TABLE IF NOT EXISTS also_import_meta (
    id INTEGER PRIMARY KEY,
    last_imported_at TEXT,
    last_imported_count INTEGER,
    last_skipped_count INTEGER,
    last_error_count INTEGER,
    last_filename TEXT
);
CREATE INDEX IF NOT EXISTS idx_also_items_title ON also_items(title);
CREATE INDEX IF NOT EXISTS idx_also_items_manufacturer ON also_items(manufacturer);
CREATE INDEX IF NOT EXISTS idx_also_items_ean ON also_items(ean);
"""


class AlsoFeedStore:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.db_path)

    def _init_db(self) -> None:
        with self._connect() as conn:
            for statement in SCHEMA.strip().split(";"):
                if statement.strip():
                    conn.execute(statement)

    def replace_items(self, items: Iterable[NormalizedItem]) -> int:
        rows = 0
        with self._connect() as conn:
            conn.execute("DELETE FROM also_items")
            for item in items:
                conn.execute(
                    """
                    INSERT INTO also_items (
                        sku,
                        manufacturer_part_number,
                        manufacturer,
                        ean,
                        title,
                        stock,
                        ek,
                        recommended_vk,
                        category,
                        family,
                        product_group,
                        eol,
                        weight
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.sku,
                        item.manufacturerPartNumber,
                        item.manufacturer,
                        item.ean,
                        item.title,
                        item.stock,
                        item.ek,
                        item.recommendedVK,
                        item.category,
                        item.family,
                        item.group,
                        1 if item.eol else 0 if item.eol is not None else None,
                        item.weight,
                    ),
                )
                rows += 1
        return rows

    def update_meta(
        self,
        imported: int,
        skipped: int,
        errors: int,
        filename: str,
        imported_at: str,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO also_import_meta (
                    id, last_imported_at, last_imported_count, last_skipped_count,
                    last_error_count, last_filename
                )
                VALUES (1, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    last_imported_at = excluded.last_imported_at,
                    last_imported_count = excluded.last_imported_count,
                    last_skipped_count = excluded.last_skipped_count,
                    last_error_count = excluded.last_error_count,
                    last_filename = excluded.last_filename
                """,
                (imported_at, imported, skipped, errors, filename),
            )

    def get_meta(self) -> dict:
        with self._connect() as conn:
            cursor = conn.execute(
                """
                SELECT last_imported_at, last_imported_count, last_skipped_count,
                       last_error_count, last_filename
                  FROM also_import_meta
                 WHERE id = 1
                 LIMIT 1
                """
            )
            row = cursor.fetchone()
        if not row:
            return {}
        return {
            "last_imported_at": row[0] or "",
            "last_imported_count": row[1] or 0,
            "last_skipped_count": row[2] or 0,
            "last_error_count": row[3] or 0,
            "last_filename": row[4] or "",
        }

    def search(self, query: str, limit: int = 50) -> List[NormalizedItem]:
        needle = f"%{query.lower()}%"
        with self._connect() as conn:
            cursor = conn.execute(
                """
                SELECT sku, manufacturer_part_number, manufacturer, ean, title,
                       stock, ek, recommended_vk, category, family, product_group,
                       eol, weight
                  FROM also_items
                 WHERE lower(title) LIKE ?
                    OR lower(sku) LIKE ?
                    OR lower(manufacturer) LIKE ?
                    OR lower(ean) LIKE ?
                 LIMIT ?
                """,
                (needle, needle, needle, needle, limit),
            )
            rows = cursor.fetchall()
        return [self._row_to_item(row) for row in rows]

    def get_by_sku(self, sku: str) -> Optional[NormalizedItem]:
        with self._connect() as conn:
            cursor = conn.execute(
                """
                SELECT sku, manufacturer_part_number, manufacturer, ean, title,
                       stock, ek, recommended_vk, category, family, product_group,
                       eol, weight
                  FROM also_items
                 WHERE sku = ?
                 LIMIT 1
                """,
                (sku,),
            )
            row = cursor.fetchone()
        return self._row_to_item(row) if row else None

    @staticmethod
    def _row_to_item(row) -> NormalizedItem:
        ek_value = row[6]
        return NormalizedItem(
            source="also",
            sku=row[0] or "",
            manufacturerPartNumber=row[1],
            manufacturer=row[2],
            ean=row[3],
            title=row[4] or "",
            stock=row[5],
            ek=ek_value,
            recommendedVK=row[7],
            ekMin=ek_value,
            ekMax=ek_value,
            category=row[8],
            family=row[9],
            group=row[10],
            eol=bool(row[11]) if row[11] is not None else None,
            weight=row[12],
            shortDescription="",
        )
