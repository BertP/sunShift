# POC 0.6: Energy Management V1 & Lastkurven

Dieses Dokument fasst den Status und die Implementierungsergebnisse des Meilensteins POC 0.6 zusammen.

## 1. Erreichte Meilensteine
* **EMS Logic V1 Core**:
  * Berücksichtigung von PV-Eigenverbrauch mit höchster Priorität.
  * Auswertung negativer Strompreise als Indikator für das öffentliche "Green Grid".
  * Dynamisches Rescheduling bei Datenänderungen.
  * Bevorzugte Ausführung der Spülmaschine (`Dishwasher`).
* **Power Time Slots**:
  * Vorab-Abfrage detaillierter Verbrauchskurven über `/v1/features/powerTimeSlot`.
  * Echtzeit-Visualisierung variabler Ausführungsphasen direkt im Gantt-Chart per Hover.

## 2. Nächste Schritte
* **Home Assistant Integration**: Anbindung realer PV-Telemetrie über WebSockets (`wss://home.never2sunny.eu`).
