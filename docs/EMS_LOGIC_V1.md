# EMS Lastgang- & Profil-Synchronisation (v1.0.1)

*Philosophie: Ein EMS ist kein Home Automation Dashboard. Es betreibt strategisches Energiemanagement und dokumentiert getroffene Entscheidungen.*

## 1. Ereignisbasierte Erfassung (Callback-Driven)
Es werden ausschließlich Daten verarbeitet, die durch Miele Cloud SPINE Callbacks (Webhooks) angekündigt werden. Kontinuierliches Polling der Restlaufzeiten für Detailanimationen entfällt vollständig.

## 2. Lebenszyklus der Lastgänge
- **Festtackern bei Erscheinen:** Sobald ein Gerät im System auftaucht (z.B. Status `SCHEDULED`), wird die Lastkurve fest im Diagramm hinterlegt.
- **Rescheduling:** Verschiebt der Algorithmus oder der Benutzer den Startzeitpunkt, wandert die festgetackerte Lastkurve an das neue Zeitfenster.
- **Direktstart:** Geht ein Gerät ohne Scheduling direkt in `RUNNING`, wird die Lastkurve sofort an diesem Zeitpunkt verankert.
- **Block Execution (Gantt):** Auch die Ausführungsblöcke im Gantt-Diagramm werden beim Übergang auf `RUNNING` fest getrackt. Weitere Durchläufe sind eigenständige Events.

## 3. Abgeschaffte Features (Obsolete)
- **Dynamische Hover Popups:** Keine dynamischen Restlaufzeitanzeigen im Tooltip.
- **Live Remaining Time:** Kein permanentes Herunterzählen von Profilkapazitäten.