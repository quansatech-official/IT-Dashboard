# Tactical RMM Infrastructure Discovery (Ping/SNMP)

Dieses Setup ergänzt die bestehende Tactical-RMM-API-Anbindung um einen Netzscan für unmanaged Geräte.

## 1) Voraussetzungen

- Backend läuft mit Endpoint `POST /api/infrastructure/discovery`
- Optionales Security-Token über Env-Variable:
  - `INFRA_DISCOVERY_TOKEN=<dein_token>`
- RMM-Agent kann Python 3 ausführen
- Optional für SNMP: `snmpget` Binary auf dem Scanner-Host

## 2) Script

- Datei: `backend/scripts/rmm_infra_discovery_scan.py`
- Aufgabe:
  - Ping sweep je Subnetz
  - optional SNMP-Probe (`--snmp`)
  - Heuristik für `device_type`, `vendor`, `confidence`, `evidence`
  - Upload an IT-Dashboard
  - lokales TTL-Cache, damit nicht bei jedem Lauf neu gescannt wird

## 3) Beispiel-Aufruf (Tactical RMM Script)

```bash
python3 rmm_infra_discovery_scan.py \
  --api-url "https://dein-dashboard.example.com/api" \
  --discovery-token "DEIN_DISCOVERY_TOKEN" \
  --customer-number "K-1023" \
  --customer-name "Cont-Aigner GmbH" \
  --source "rmm_agent_scan" \
  --subnet "192.168.100.0/24" \
  --snmp \
  --snmp-community "public" \
  --cache-ttl-seconds 1800
```

Windows (analog):

```powershell
python .\rmm_infra_discovery_scan.py `
  --api-url "https://dein-dashboard.example.com/api" `
  --discovery-token "DEIN_DISCOVERY_TOKEN" `
  --customer-number "K-1023" `
  --customer-name "Cont-Aigner GmbH" `
  --subnet "192.168.100.0/24"
```

## 4) Empfohlene Ausführung

- Pro Standort/Kunde ein oder wenige dedizierte Scanner-Agents
- Intervall z.B. alle 30-120 Minuten
- Für sofortigen Lauf `--force` nutzen (ignoriert lokalen Cache)

## 5) Wichtige Parameter

- `--api-url`: Basis-API (mit oder ohne `/api`, wird normalisiert)
- `--discovery-token`: Header `X-Discovery-Token` (optional, aber empfohlen)
- `--customer-id` oder `--customer-number` oder `--customer-name`: Zuordnung im Dashboard
- `--subnet`: Scanbereich, mehrfach möglich
- `--snmp`: SNMP-Probe aktivieren
- `--managed-ip`: IP als managed markieren (mehrfach möglich)
- `--cache-ttl-seconds`: lokale Cache-Zeit

## 6) Backend-Verhalten

- Endpoint dedupliziert Einträge über `source + ip + mac + customer_id`
- Bestehende Datensätze werden mit `last_seen_at` aktualisiert
- Daten erscheinen in Kundenentwicklung unter Infrastruktur
