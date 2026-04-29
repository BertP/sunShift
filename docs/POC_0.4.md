# Proof of Concept (POC) v0.4 - SunShift EMS

Dieses Dokument beschreibt den erreichten Funktionsumfang des POC v0.4 mit Fokus auf Stabilität, Bereinigung und Transparenz.

## 1. Neue Features & Anpassungen in v0.4

### Fernsteuerung & Miele Cloud Bindings
* **Geräte-Befehle**: Der Start-Button wird exklusiv für Appliances freigegeben, deren Status auf `scheduled` steht.
* **Automatisierte Geräteregistrierung**: Dynamischer Aufbau von Miele Cloud Use Cases.

### Factory Defaults & Cloud Teardown
* **Lokales Zurücksetzen**: Leeren aller PostgreSQL-Datenbanktabellen (`device_bindings`, `miele_oauth_tokens`).
* **Aktives Cloud-Cleanup**: 
  * Holt bestehende Partnerschafts-Tokens.
  * Führt ein `GET /bindings` aus.
  * Löscht sämtliche IDs über ein iteratives `DELETE /bindings?bindingId=...`.
  * Beendet Sitzungen über `POST {{authURL}}/logout`.

### Erweiterte Transparenz (Developer Experience)
* **Geteilte Live-Diagnose**: Entkopplung von REST-Payloads und Business-Abläufen.
* **System Ticker Narrative**: Neues, skalierbares Fenster für textuelle Updates.

## 2. Benutzeroberfläche
* Visuelles Feedback sperrt Interaktionen während Resets über Countdown-Ladescreens.

## 3. Überprüfung & DB-Status
* Bindings Tabelle: `SELECT * FROM device_bindings;`
