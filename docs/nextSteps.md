# Next Steps for POC 0.4 - SunShift EMS

Preparing the transition from static evaluation to active infrastructure coupling. 

## 📈 Open Topics for POC 0.4

### 1. Dynamic Pricing Integration
* Switch the internal static price charts to a live API feed (e.g., Tibber or Awattar).
* Update the `emsService.ts` to calculate actual monetary savings metrics per execution window.

### 2. Actionable Control Flows
* Map UI execution commands (such as "Force Start") directly onto standard action endpoints of the Spine-IoT infrastructure.
* Capture dynamic consumption feedback loops.

### 3. Agent Roles & Delegation
* **Hardware Agent**: Deploy local ESP32 sensor bindings.
* **Data Broker**: Enhance resilience profiles against temporary cloud rate-limiting.

Ready for PO review.
