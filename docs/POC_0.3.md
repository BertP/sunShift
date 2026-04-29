# Proof of Concept (POC) v0.3 - SunShift EMS

This document outlines the architecture and state of the POC v0.3, marking the full transition from mock operations to robust, live API integrations.

## 1. New Features in v0.3
* **Live Miele API Connectivity**: Direct fetching from `https://ems.domestic.miele-iot.com/v1/devices` using live Bearer tokens.
* **Zero-Mock Database Schemas**: Eliminated hardcoded demo units. 
* **Secure PostgreSQL Token Persistence**: Automated loading, caching, and validating OAuth credentials across reboots.
* **Embedded API Logs Console**: Real-time execution tracking in the frontend dashboard.

## 2. Frontend Improvements
The "Connect Miele Appliances" section now maps real hardware IDs and offers quick inspection overlays for telemetry data.

## 3. Verification Paths
* Tokens stored in DB: `SELECT * FROM miele_oauth_tokens;`
* API monitoring point: `/api/miele/logs`
