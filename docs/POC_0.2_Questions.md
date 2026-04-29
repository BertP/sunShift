# POC 0.2 - Open Questions & Unresolved Aspects

This document tracks the open questions regarding the Spine-IoT API integration and Phase 2 planning.

## Technical Questions
1. **Spine-IoT Authentication**: Which specific OAuth2 flow does the Miele/EEBUS Spine API require for local network access vs. cloud access?

    - https://developer.miele.com/docs/spine-iot-api/authorization
    
2. **Real-Time Data**: Does the Spine-IoT API support WebSockets/MQTT for real-time power consumption updates, or do we need to poll?
    - Websockets sind supportet, API Cookbock gibt es hier: https://developer.miele.com/docs/spine-iot-api/Guidelines_for_Implementation_SPINE-IoT_Use_Case_Flexible_Start_for_White_Goods_v_1.0.pdf
3. **Device Capabilities**: Do we have access to the state machine of the heat pump (e.g., "SG Ready" signals) via the Spine API?

    - Im ersten Schritt kümmern wir uns nur um die Miele Geräte

## Product & Scope Questions
1. **Prioritization**: Should Spine-IoT devices (Heat Pump, Wallbox) always take precedence over Miele white goods in the optimization algorithm?
2. **User Interaction**: Should users be able to manually override Spine schedules via the UI, or is it fully autonomous?
    - Ja, er soll in der Lafe sein einen "Jetzt starten" Befehl zu schicken
