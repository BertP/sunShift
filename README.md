# SunShift EMS (Energy Management System) - POC v0.9

Ein intelligentes Energiemanagement-System zur automatischen Taktung von Haushaltsgeräten (Miele Cloud) basierend auf dynamischen Tarifen (Awattar) und Solarprognosen (Open-Meteo).

## Features

* **Live Gantt-Schedules**: Dynamische Zuweisung von Startzeitfenstern für intelligente EEBUS Use Cases (`flexibleStartForWhiteGoods`).
* **Interpolierte Datenströme**: 15-Minuten Interpolation zwischen Preispeaks und solaren Überschusswerten für flüssige Visualisierungen.
* **Optimierte API Zyklen**: Vermeidung von Limits mittels asynchroner 24h/60m Cron-Services.
* **Interaktive Steuern & Umlagen**: Anpassbare Schwellenwerte im Configure-Bereich.

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

