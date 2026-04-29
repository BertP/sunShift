# SunShift EMS - Gebrauchs- & Inbetriebnahme-Anleitung

*Wichtig: Ein EMS ist kein Home Automation Dashboard. Es optimiert Energieflüsse strategisch.*

## 1. Systemvoraussetzungen
- Docker & Docker Compose
- Vorhandene PostgreSQL-Instanz (wird automatisch via docker-compose deployed)
- Gültige `.env`-Konfiguration (inkl. `HA_LL_TOKEN`)

## 2. Erstinbetriebnahme
Führen Sie im Stammverzeichnis folgenden Befehl aus:
```bash
docker compose up -d --build
```
Nach dem Start ist das Dashboard unter `http://localhost:5173` erreichbar.

## 3. Bedienung im Alltag
- **Geräte anbinden:** Über die Miele-Cloud-Schnittstelle.
- **Lastgang-Anzeige:** Sobald Geräte über SPINE-Callbacks angemeldet werden, tackert das System die Lastkurven fest.

## 4. Wartung & Logs
```bash
docker compose logs -f sunshift-backend
```
