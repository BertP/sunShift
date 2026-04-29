# Offene Fragen (OPEN QUESTIONS)

Da wir uns aktuell in der **Spezifikationsphase** befinden, müssen folgende Punkte geklärt werden, bevor die Implementierung (das "GO!") erfolgen kann:

## 1. Architektur & Technologie
* **Technologie-Stack**: Welche Frameworks sollen für das Frontend (z. B. React, Vue, Svelte) und das Backend (z. B. Python/FastAPI, Node.js, Go) verwendet werden?
    - Ich habe mich in PHASE_1_TECHNICAL_SLICE.md für TypeScript entschieden.- Deine Entscheidung ich möchte ein mordernes Frontend, zudem soll die anwendung als Docker Compose Stack deployerd werden können
* **Datenbank**: Wie und wo werden historische Energiedaten und Zustände gespeichert (z. B. Time-Series-DB wie InfluxDB, oder relationale DB wie PostgreSQL)?
    - ebenfalls deine
## 2. Datenquellen & Integrationen (`DATA_SOURCES.md`)
* **Hardware-Anbindung**: Welche Wechselrichter (z. B. SMA, Fronius, Victron) und Smart Meter sollen in Phase 1 unterstützt werden?
    - Schritt eins ohne Hardwar, nur PV Forecast Daten berücksichtigen
* **Protokolle**: Erfolgt die Kommunikation lokal (Modbus TCP, MQTT) oder über Cloud-APIs der Hersteller?
    - Cloud APIs für Miele, ForecastSolar und dyn. Stromtarif
* **Externe Daten**: Werden dynamische Strompreise (z. B. Tibber, Awattar) oder Wetterprognosen direkt integriert?
    - bitte Wetter für PLZ 33335, ForecastSolar API und Stromörsen API breücksichtigen

## 3. EMS-Logik (`EMS_LOGIC_V1.md`)
* **Priorisierung**: Was hat Vorrang? Eigenverbrauchsmaximierung, Batterieschonung oder Kostenminimierung durch dynamische Tarife?
    - Kostenminierung in Step 1
* **Steuerbare Verbraucher**: Welche Geräte (Wallboxen, Wärmepumpen, Heizstäbe) werden aktiv geregelt?
    - nur Cloud API Miele Waschmaschine, Trockner, Geschirrspüler

## 4. Agenten & Workflow (`.agents/`)
* **Zusammenarbeit**: Wie interagieren die definierten Agenten-Rollen im Detail? Wer hat die finale Code-Hoheit?
    - im Konfliktfall melden

## 5 Weitere Infos
* **Setup** Wie in den andren Projekten, die in Verbindung mit *.never2sunny.eu aufgesetzt wurden
* **Testing** ebenfalls in verbindung mit der bestehenden Testinfrastruktur aus den anderen Projekten
