# EMS Lastgang- & Profil-Synchronisation (v1.0)

Dieses Dokument beschreibt die Kernlogik zur Erfassung, Speicherung und Darstellung von Geräte-Lastkurven (PowerTimeSlots) im zeitlichen Ablauf des Energiemanagements.

## 1. Initiales Scheduling ("Scheduled")
- **Trigger:** Das Gerät wechselt per Webhook in den Status `SCHEDULED` (Benutzer wählt Programm & Flexibilitätsfenster).
- **Ablauf:**
  1. Die Miele-API wird einmalig aufgerufen, um die spezifischen `powerTimeSlots` des Programms zu ermitteln.
  2. Die Slots dienen als Grundlage für den ersten Optimierungsalgorithmus.

## 2. Übergang in den Betrieb ("Running")
- **Trigger:** Das Gerät wechselt von `SCHEDULED` auf `RUNNING` (oder wird direkt ohne Schedule gestartet).
- **Ablauf:**
  - Die ursprüngliche Lastkurve wird zu diesem Zeitpunkt **fest im Diagramm verankert** ("festgetackert").
  - Erfolgt ein zweiter Durchlauf, zeigt das Diagramm beide Lastkurven übereinander bzw. gestapelt.
  - Im laufenden Betrieb werden die `powerTimeSlots` kontinuierlich (z.B. minütlich) aktualisiert.

## 3. Datenanzeige & Tooltips
- **Verlaufsgrafik (Chart):** Zeigt stets die festgetackerte Ursprungs-Lastkurve.
- **Hover Popup (Gantt):** Berechnet und zeigt dynamisch den aktuell *verbleibenden* Lastgang auf Basis der Live-Slots.