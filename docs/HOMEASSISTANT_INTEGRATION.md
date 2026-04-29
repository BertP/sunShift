# Spezifikation: Home Assistant WebSocket Integration (POC v0.7)

Dieses Dokument beschreibt die Integration von Home Assistant zur Erfassung von Live-Telemetrie für die PV-Erzeugung und den Netzübergabepunkt.

## 1. Zielsetzung
* Direkte Übernahme realer Leistungswerte statt statischer Mock-Daten.
* Kontinuierliche Aktualisierung per WebSocket (`wss://home.never2sunny.eu/api/websocket`).

## 2. Aufgabenpaket & Implementierungsschritte
- [x] **Schritt 1: WebSocket-Client aufsetzen**
  * Einbindung der `ws` Bibliothek im Backend.
- [x] **Schritt 2: Authentifizierung (MAuth)**
  * Senden des HA Long-Lived Access Tokens.
- [x] **Schritt 3: State Subscription**
  * Überwachung von:
    * `sensor.pv_power` (Aktuelle Solarerzeugung in W)
    * `sensor.grid_power` (Netzbezug/-einspeisung in W)

- [ ] **Schritt 4: EMS Logic Hook**
  * Echtzeit-Triggerung des Reschedulings bei starken Leistungs-Fluktuationen.
