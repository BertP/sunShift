# Projekt-Übersicht: SunShift EMS

## 1. Worum geht es in diesem Projekt?
**SunShift EMS** (Energy Management System) ist ein System zur intelligenten Steuerung und Optimierung von Energieflüssen.

**Phase 1 Fokus:**
* **Ziel**: Kostenminimierung durch Nutzung dynamischer Stromtarife.
* **Geräte**: Reine Cloud-Steuerung von Miele Haushaltsgeräten (Waschmaschine, Trockner, Geschirrspüler).
* **Hardware**: Keine direkte Hardware-Anbindung (kein Wechselrichter/Smart Meter in Phase 1).
* **Daten**: Nutzung von PV-Prognosen (Forecast.Solar für PLZ 33335) und Börsenstrompreisen.

Das Projekt befindet sich aktuell in der **Spezifikationsphase**. Es wird noch kein Code implementiert.

---

## 2. Projektstruktur & Dokumente

### A. Dokumentation (`docs/`)
* **ARCHITECTURE_OVERVIEW.md**: Docker Compose Setup, TypeScript Stack (Frontend & Backend).
* **DATA_SOURCES.md**: Cloud APIs (Miele, Forecast.Solar, Strompreis).
* **EMS_LOGIC_V1.md**: Kostenoptimierungs-Algorithmus.
* **PHASE_1_TECHNICAL_SLICE.md**: MVP-Planung.
* **OPEN_QUESTIONS.md**: Protokoll der getroffenen Entscheidungen.

### B. Agenten-Konfiguration (`.agents/`)
* Rollendefinitionen für die spätere Umsetzung nach Freigabe (GO!).
