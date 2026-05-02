import WebSocket from 'ws';
import dotenv from 'dotenv';
import { updateTelemetry } from './telemetryStore';
dotenv.config();

import { getConfig } from './configService';

const HA_URL = getConfig().homeAssistant.url;
const HA_TOKEN = process.env.HA_LL_TOKEN || '';

let ws: WebSocket | null = null;
let messageId = 1;
let pingInterval: NodeJS.Timeout | null = null;
let pongTimeout: NodeJS.Timeout | null = null;

export const connectToHomeAssistant = () => {
  if (!HA_TOKEN) {
    console.error('[homeAssistantService]: No HA_LL_TOKEN found in .env!');
    return;
  }

  if (ws) {
    ws.terminate();
  }

  console.log('[homeAssistantService]: Connecting to Home Assistant...');
  ws = new WebSocket(HA_URL);

  ws.on('open', () => {
    console.log('[homeAssistantService]: WebSocket connection established.');
    startHeartbeat();
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'pong') {
        if (pongTimeout) clearTimeout(pongTimeout);
        return;
      }

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
    stopHeartbeat();
    setTimeout(connectToHomeAssistant, 10000);
  });

  ws.on('error', (err) => {
    console.error('[homeAssistantService]: WebSocket error:', err.message);
  });
};

const startHeartbeat = () => {
  stopHeartbeat();
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ id: messageId++, type: 'ping' }));
      
      pongTimeout = setTimeout(() => {
        console.warn('[homeAssistantService]: Heartbeat timeout! Closing connection.');
        ws?.terminate();
      }, 10000);
    }
  }, 30000);
};

const stopHeartbeat = () => {
  if (pingInterval) clearInterval(pingInterval);
  if (pongTimeout) clearTimeout(pongTimeout);
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

    const entities = getConfig().homeAssistant.entities;
    if (entityId === entities.pvPower || 
        entityId === entities.gridPower || 
        entityId === entities.evChargingPower ||
        entityId === entities.batteryLevel ||
        entityId === entities.batteryChargingState ||
        entityId === entities.heatPumpPower) {
        
      const value = newState?.state;
      const numValue = parseFloat(value);
      
      console.log(`[homeAssistantService]: ${entityId} updated to ${value}`);
      
      if (entityId === entities.pvPower && !isNaN(numValue)) updateTelemetry(numValue, null, null);
      if (entityId === entities.gridPower && !isNaN(numValue)) updateTelemetry(null, numValue, null);
      if (entityId === entities.evChargingPower && !isNaN(numValue)) updateTelemetry(null, null, numValue);
      if (entityId === entities.batteryLevel && !isNaN(numValue)) updateTelemetry(null, null, null, numValue);
      if (entityId === entities.batteryChargingState) updateTelemetry(null, null, null, undefined, value);
      if (entityId === entities.heatPumpPower && !isNaN(numValue)) updateTelemetry(null, null, null, undefined, undefined, numValue);
    }



  }
};
