# SunShift EMS: Architectural Overview

SunShift is a smart Energy Management System (EMS) designed to optimize appliance runtime based on real-time solar production and dynamic electricity prices.

## System Components

### 1. Frontend (React + Vite)
- **Role**: Real-time visualization and manual control.
- **Key Feature**: Linear time-scale dashboard that synchronizes telemetry and forecasts.
- **Communication**: REST API to the backend.

### 2. Backend (Node.js + Express)
- **Role**: Data aggregation, optimization logic, and external API handling.
- **Services**:
    - `priceService`: Fetches Awattar market data.
    - `solarService`: Fetches Open-Meteo irradiance data and calculates PV yield.
    - `spineService`: Interfaces with Miele Cloud and local SPINE devices.
    - `homeAssistantService`: Receives real-time telemetry via webhooks.
    - `optimizerService`: Calculates the most cost-effective start times for appliances.

### 3. Database (PostgreSQL)
- **Role**: Persistent storage for historical telemetry and forecasts.
- **Retention**: 30-day rolling window for all time-series data.

## Data Flow
1. **Inputs**: Prices (Hourly), Solar (Hourly), Live Telemetry (Event-driven).
2. **Storage**: All inputs are normalized and stored with timezone-aware timestamps.
3. **Logic**: The Optimizer matches appliance power profiles against price and solar curves.
4. **Output**: GANTT schedules and manual/automatic start commands sent to devices.

---
*Last Updated: 2026-05-04*
