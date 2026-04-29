# SunShift EMS (Energy Management System) - POC v0.9

Ein intelligentes Energiemanagement-System zur automatischen Taktung von Haushaltsgeräten (Miele Cloud) basierend auf dynamischen Tarifen (Awattar) und Solarprognosen (Open-Meteo).

## Features

* **Live Gantt-Schedules**: Dynamische Zuweisung von Startzeitfenstern für intelligente EEBUS Use Cases (`flexibleStartForWhiteGoods`).
* **Live-Telemetry & Multi-Day History**: Kontinuierliche 7-Tage Speicherung von PV-Ertrag und Netzstatus mit interaktiver Liniendiagramm-Sicht.
* **Vergangenheits- & Prognose-Navigation**: Footer-Widget zur freien Datumsauswahl `< TT.MM.JJJJ >` (Prognosewerte für den Folgetag ab 14:00 Uhr verfügbar).
* **Optimierte API Zyklen**: Reduzierung interner Polling-Overheads auf EEBUS/Miele Spine-Netzwerkgrenzen.


## Deployment & Setup

### Voraussetzungen
* Docker und Docker Compose v2+
* Node.js (für lokale Frontend-Entwicklung)

### Docker Compose Stack starten
Um das Gesamtsystem (Frontend, Backend & PostgreSQL) direkt mittels vorkompilierter Images zu starten:

```bash
# Gesamten Stack kompilieren und im Hintergrund ausführen
docker compose up -d --build --pull=never
```

### Container einzeln verwalten
* Logs einsehen: `docker compose logs -f`
* Stack stoppen: `docker compose down -v`

