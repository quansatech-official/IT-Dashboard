#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request


def fetch_json(url: str):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))


def post_json(url: str, payload: dict):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))


def parse_folder_name(folder: str):
    match = re.match(r"^(\d+)[ _-]+(.+)$", folder)
    if not match:
        return None
    internal_number = match.group(1).strip()
    name = match.group(2).replace("_", " ").strip()
    if not internal_number or not name:
        return None
    return internal_number, name


def main():
    parser = argparse.ArgumentParser(
        description="Import customers (name + internal number) from folder names."
    )
    parser.add_argument(
        "--path",
        default="/Users/benji/Nextcloud/2.Kundendaten",
        help="Root folder containing customer directories.",
    )
    parser.add_argument(
        "--api-base",
        default=os.getenv("API_BASE_URL", "http://localhost:9873/api"),
        help="Backend API base URL.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing.")
    args = parser.parse_args()

    try:
        customers = fetch_json(f"{args.api_base}/customers")
    except urllib.error.URLError as exc:
        print(f"Failed to fetch customers from {args.api_base}: {exc}", file=sys.stderr)
        return 1

    existing_numbers = {
        str(c.get("internal_number") or "").strip()
        for c in customers
        if str(c.get("internal_number") or "").strip()
    }
    existing_names = {
        str(c.get("name") or "").strip().lower()
        for c in customers
        if str(c.get("name") or "").strip()
    }

    created = 0
    skipped = 0
    invalid = []

    try:
        entries = sorted(os.scandir(args.path), key=lambda e: e.name.lower())
    except FileNotFoundError:
        print(f"Folder not found: {args.path}", file=sys.stderr)
        return 1

    for entry in entries:
        if not entry.is_dir():
            continue
        parsed = parse_folder_name(entry.name)
        if not parsed:
            invalid.append(entry.name)
            continue
        internal_number, name = parsed
        name_key = name.lower()
        if internal_number in existing_numbers or name_key in existing_names:
            skipped += 1
            continue
        payload = {"name": name, "internal_number": internal_number}
        if args.dry_run:
            print(f"CREATE {internal_number} {name}")
        else:
            try:
                post_json(f"{args.api_base}/customers", payload)
            except urllib.error.URLError as exc:
                print(f"Failed to create {name}: {exc}", file=sys.stderr)
                continue
        existing_numbers.add(internal_number)
        existing_names.add(name_key)
        created += 1

    print(f"Created: {created}")
    print(f"Skipped (existing): {skipped}")
    if invalid:
        print("Skipped (unmatched folder names):")
        for name in invalid:
            print(f"- {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
