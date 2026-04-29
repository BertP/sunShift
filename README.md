# SunShift EMS (Energy Management System) - POC v0.5

Ein intelligentes Energiemanagement-System zur automatischen Taktung von Haushaltsgeräten (Miele Cloud) basierend auf dynamischen Tarifen (Awattar) und Solarprognosen (Open-Meteo).

## Features

* **Live Gantt-Schedules**: Dynamische Zuweisung von Startzeitfenstern für intelligente EEBUS Use Cases (`flexibleStartForWhiteGoods`).
* **Interpolierte Datenströme**: 15-Minuten Interpolation zwischen Preispeaks und solaren Überschusswerten für flüssige Visualisierungen.
* **Optimierte API Zyklen**: Vermeidung von Limits mittels asynchroner 24h/60m Cron-Services.

## Quickstart

```bash
docker compose up -d --build
```
