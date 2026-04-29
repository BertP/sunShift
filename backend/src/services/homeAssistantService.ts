import WebSocket from 'ws';
import dotenv from 'dotenv';
import { updateTelemetry } from './telemetryStore';
dotenv.config();


const HA_URL = 'wss://home.never2sunny.eu/api/websocket';
const HA_TOKEN = process.env.HA_LL_TOKEN || '';

let ws: WebSocket | null = null;
let messageId = 1;

export const connectToHomeAssistant = () => {
  if (!HA_TOKEN) {
    console.error('[homeAssistantService]: No HA_LL_TOKEN found in .env!');
    return;
  }

  console.log('[homeAssistantService]: Connecting to Home Assistant...');
  ws = new WebSocket(HA_URL);

  ws.on('open', () => {
    console.log('[homeAssistantService]: WebSocket connection established.');
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log('[homeAssistantService]: Received message:', msg.type);

      if (msg.type === 'auth_required') {
        // Step 2: Authenticate
        console.log('[homeAssistantService]: Authenticating...');
        ws?.send(JSON.stringify({
          type: 'auth',
          access_token: HA_TOKEN
        }));
      } else if (msg.type === 'auth_ok') {
        console.log('[homeAssistantService]: Authentication successful!');
        // Step 3: Subscribe to telemetry
        subscribeToSensors();
      } else if (msg.type === 'event') {
        handleTelemetryEvent(msg.event);
      }
    } catch (err) {
      console.error('[homeAssistantService]: Error parsing message', err);
    }
  });

  ws.on('close', () => {
    console.log('[homeAssistantService]: WebSocket closed. Reconnecting in 10s...');
    setTimeout(connectToHomeAssistant, 10000);
  });

  ws.on('error', (err) => {
    console.error('[homeAssistantService]: WebSocket error:', err.message);
  });
};

const subscribeToSensors = () => {
  if (!ws) return;
  console.log('[homeAssistantService]: Subscribing to sensor states...');

  // Subscribe to state changes
  ws.send(JSON.stringify({
    id: messageId++,
    type: 'subscribe_events',
    event_type: 'state_changed'
  }));
};

const handleTelemetryEvent = (event: any) => {
  if (event.data && event.data.entity_id) {
    const entityId = event.data.entity_id;
    const newState = event.data.new_state;

    if (entityId === 'sensor.pv_leistung' || entityId === 'sensor.netzzustand' || entityId === 'sensor.smaev_3011444125_charging_station_power') {
      const value = parseFloat(newState?.state);
      console.log(`[homeAssistantService]: ${entityId} updated to ${value} W`);
      
      if (!isNaN(value)) {
        if (entityId === 'sensor.pv_leistung') updateTelemetry(value, null, null);
        if (entityId === 'sensor.netzzustand') updateTelemetry(null, value, null);
        if (entityId === 'sensor.smaev_3011444125_charging_station_power') updateTelemetry(null, null, value);
      }
    }



  }
};
