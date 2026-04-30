# SunShift EMS (Energy Management System) - POC v0.9

Ein intelligentes Energiemanagement-System zur automatischen Taktung von Haushaltsgeräten (Miele Cloud) basierend auf dynamischen Tarifen (Awattar) und Solarprognosen (Open-Meteo).

## Features

* **Live Gantt-Schedules**: Dynamische Zuweisung von Startzeitfenstern für intelligente EEBUS Use Cases (`flexibleStartForWhiteGoods`).
* **Live-Telemetry & Multi-Day History**: Kontinuierliche 7-Tage Speicherung von PV-Ertrag und Netzstatus mit interaktiver Liniendiagramm-Sicht.
* **Vergangenheits- & Prognose-Navigation**: Footer-Widget zur freien Datumsauswahl `< TT.MM.JJJJ >` (Prognosewerte für den Folgetag ab 14:00 Uhr verfügbar).
* **Optimierte API Zyklen**: Reduzierung interner Polling-Overheads auf EEBUS/Miele Spine-Netzwerkgrenzen.


## Konfiguration

Das System ist vollständig über eine zentrale Datei `sunshift-config.json` im Hauptverzeichnis konfigurierbar. Diese Datei steuert die Base-URLs, Home Assistant Sensoren und die Eigenschaften deiner PV-Anlage (z. B. mehrere Dachflächen, kWp, Neigung). 

Beispiel für `sunshift-config.json`:
```json
{
  "system": {
    "baseUrl": "https://sunshift.deine-domain.de"
  },
  "homeAssistant": {
    "url": "wss://homeassistant.local:8123/api/websocket",
    "entities": {
      "pvPower": "sensor.pv_leistung",
      "gridPower": "sensor.netzzustand",
      "evChargingPower": "sensor.wallbox_power"
    }
  },
  "solarPlant": {
    "location": { "lat": 51.9, "lon": 8.4 },
    "arrays": [
      { "name": "Ost", "dec": 45, "az": -90, "kwp": 4.0 },
      { "name": "West", "dec": 45, "az": 90, "kwp": 6.0 }
    ]
  }
}
```
Die Datei wird beim Start automatisch als Volume in den Backend-Container eingebunden.

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

