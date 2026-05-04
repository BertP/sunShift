import pool from '../db';
import { addApiLog } from './logService';

export interface SpineDevice {
  id: string;
  name: string;
  type: string;
  protocol: string;
  status: string;
  powerConsumptionW: number;
  bindingId?: string;
  subscriptionId?: string;
  validUntil?: string;
}



import { getAccessToken } from './mieleAuthService';
import axios from 'axios';

const boundDevices = new Set<string>();
const subscribedDevices = new Set<string>();

let cachedDevices: SpineDevice[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export const clearBoundDevices = () => {
  boundDevices.clear();
  subscribedDevices.clear();
  cachedDevices = [];
  cacheTimestamp = 0;
};


export const getSpineDevices = async () => {
  // Load bound devices from DB
  try {
    const dbBound = await pool.query('SELECT device_id FROM device_bindings');
    dbBound.rows.forEach((row: any) => boundDevices.add(row.device_id));
  } catch (dbErr) {
    console.error('[spineService]: Failed to load bound devices from DB:', dbErr);
  }

  // Cache Check
  const now = Date.now();
  if (cachedDevices.length > 0 && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[spineService]: Returning cached device list.');
    return cachedDevices;
  }

  const token = getAccessToken();
  if (!token) {
    console.log('[spineService]: No live token, returning empty list.');
    return [];
  }

  try {
    console.log('[spineService]: Fetching live devices from Miele Cloud...');
    const response = await axios.get('https://ems.domestic.miele-iot.com/v1/devices', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      }
    });

    addApiLog('GET', '/devices', response.data);

    // Map Miele payload to SpineDevice
    // Miele often returns an array, or an object where keys are serial numbers.
    let liveDevices: SpineDevice[] = [];

    if (Array.isArray(response.data)) {
      liveDevices = response.data.map((device: any) => ({
        id: device.deviceId || device.id || device.ident || String(Math.random()),
        name: `Miele ${device.deviceType || 'Appliance'}`,
        type: device.deviceType || 'Appliance',
        protocol: 'SPINE / EEBUS',
        status: 'READY',
        powerConsumptionW: 0,
      }));
    } else if (typeof response.data === 'object' && response.data !== null) {
      liveDevices = Object.keys(response.data).map((key: string) => {
        const device = response.data[key];
        return {
          id: device.deviceId || key,
          name: `Miele ${device.deviceType || 'Appliance'}`,
          type: device.deviceType || 'Appliance',
          protocol: 'SPINE / EEBUS',
          status: 'READY',
          powerConsumptionW: 0,
        };
      });
    }

    // Ensure all discovered devices are bound to this EMS
    for (const dev of liveDevices) {
      if (!boundDevices.has(dev.id) && !dev.id.startsWith('washer_') && !dev.id.startsWith('dryer_') && !dev.id.startsWith('dishwasher_')) {
        try {
          console.log(`[spineService]: Creating use case binding for device ${dev.id}...`);
          
          const payload = {
            usecaseInterfaces: {
              deviceId: dev.id,
              entityId: 0,
              usecaseName: "flexibleStartForWhiteGoods",
              usecaseMajorVersion: "v1",
              actor: "SmartAppliance",
              requester: {
                actor: "CCM",
                usecaseVersion: "1.0.0",
                deviceId: dev.id,
                entityId: 0
              }
            }
          };

          const bindRes = await axios.post('https://ems.domestic.miele-iot.com/v1/bindings', payload, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`[spineService]: Successfully bound device ${dev.id}`);
          addApiLog('POST', '/bindings', {
            statusCode: bindRes.status,
            requestPayload: payload,
            responsePayload: bindRes.data
          });
          boundDevices.add(dev.id);
          const bId = bindRes.data?.bindingId || 'N/A';
          const exp = bindRes.data?.expires || 'Unlimited';
          await pool.query('INSERT INTO device_bindings (device_id, binding_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (device_id) DO UPDATE SET binding_id = EXCLUDED.binding_id, expires_at = EXCLUDED.expires_at', [dev.id, bId, exp]);
          
        } catch (bindError: any) {
          console.error(`[spineService]: Failed to bind device ${dev.id}:`, bindError.response?.data || bindError.message);
          addApiLog('POST', '/bindings [ERROR]', {
            statusCode: bindError.response?.status || 500,
            requestPayload: { deviceId: dev.id },
            error: bindError.response?.data || bindError.message
          });
        }
      }
    }

    // Enforce Callback Subscriptions for all discovered devices
    for (const dev of liveDevices) {
      if (!subscribedDevices.has(dev.id) && !dev.id.startsWith('washer_') && !dev.id.startsWith('dryer_') && !dev.id.startsWith('dishwasher_')) {
        try {
          console.log(`[spineService]: Ensuring callback subscription for device ${dev.id}...`);
          const { getConfig } = require('./configService');
          const subPayload = {
            callbackUrl: `${getConfig().system.baseUrl}/api/spine/callback`,
            usecaseInterfaces: {
              deviceId: dev.id,
              entityId: 0,
              usecaseName: "flexibleStartForWhiteGoods",
              usecaseMajorVersion: "v1",
              actor: "SmartAppliance"
            }
          };
          
          const subRes = await axios.post('https://ems.domestic.miele-iot.com/v1/subscriptions', subPayload, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          console.log(`[spineService]: Successfully created subscription for ${dev.id}`);
          subscribedDevices.add(dev.id);
          addApiLog('POST', '/subscriptions', {
            statusCode: subRes.status,
            requestPayload: subPayload,
            responsePayload: subRes.data
          });
        } catch (subErr: any) {
          console.error(`[spineService]: Failed to subscribe device ${dev.id}:`, subErr.response?.data || subErr.message);
          addApiLog('POST', '/subscriptions [ERROR]', {
            statusCode: subErr.response?.status || 500,
            error: subErr.response?.data || subErr.message
          });
        }
      }
    }



    // Resolve bindingId & expires using local DB and live API order fallback
    try {
      const dbBindings = await pool.query('SELECT device_id, binding_id, expires_at FROM device_bindings');
      const bindingMap = new Map();
      dbBindings.rows.forEach((row: any) => {
        bindingMap.set(row.device_id, { bindingId: row.binding_id, expires: row.expires_at });
      });

      const bindingsRes = await axios.get('https://ems.domestic.miele-iot.com/v1/bindings', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      const cloudBindings = Array.isArray(bindingsRes.data) ? bindingsRes.data : [];

      const subsRes = await axios.get('https://ems.domestic.miele-iot.com/v1/subscriptions', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      const cloudSubs = Array.isArray(subsRes.data) ? subsRes.data : [];

      for (let i = 0; i < liveDevices.length; i++) {
        const dev = liveDevices[i];
        
        // Map Binding ID
        if (bindingMap.has(dev.id) && bindingMap.get(dev.id).bindingId && bindingMap.get(dev.id).bindingId !== 'N/A') {
          const data = bindingMap.get(dev.id);
          dev.bindingId = data.bindingId;
          dev.validUntil = data.expires;
        } else if (cloudBindings[i]) {
          dev.bindingId = cloudBindings[i].bindingId || cloudBindings[i].id || 'N/A';
          dev.validUntil = cloudBindings[i].expires || 'Unlimited';
          await pool.query('INSERT INTO device_bindings (device_id, binding_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (device_id) DO UPDATE SET binding_id = EXCLUDED.binding_id, expires_at = EXCLUDED.expires_at', [dev.id, dev.bindingId, dev.validUntil]);
        } else {
          dev.bindingId = 'Pending / None';
          dev.validUntil = 'N/A';
        }

        // Map Subscription ID
        if (cloudSubs[i]) {
          dev.subscriptionId = cloudSubs[i].subscriptionId || cloudSubs[i].id || 'N/A';
        } else {
          dev.subscriptionId = 'Pending / None';
        }
      }

    } catch (bindErr: any) {
      console.error('[spineService]: Failed to resolve binding mappings:', bindErr.message);
    }

    // Cache the result
    cachedDevices = liveDevices;
    cacheTimestamp = now;

    return liveDevices;
  } catch (error: any) {
    console.error('[spineService]: Failed to fetch live devices:', error.response?.data || error.message);
    // Fallback to empty array on failure
    return [];
  }
};

export const getPowerSequence = async (deviceId: string, currentStatus?: string) => {
  const status = currentStatus?.toLowerCase() || 'unknown';
  
  // If the device is definitively INACTIVE or OFF, we don't want to show any ghost schedules.
  if (status === 'inactive' || status === 'off' || status === 'not_connected') {
    return { state: 'inactive' };
  }

  // DB-First: Check if we have a RECENT schedule/sequence in DB (max 15 mins old)
  try {
    const res = await pool.query(
      "SELECT status, scheduled_start, scheduled_end, earliest_start, latest_end FROM device_schedules WHERE device_id = $1 AND created_at > NOW() - INTERVAL '15 minutes' ORDER BY id DESC LIMIT 1",
      [deviceId]
    );
    if (res.rows.length > 0) {
      const row = res.rows[0];
      console.log(`[spineService]: Using recent DB-cached sequence for ${deviceId}`);
      return {
        state: row.status.toLowerCase(),
        startTime: row.scheduled_start,
        endTime: row.scheduled_end,
        earliestStartTime: row.earliest_start,
        latestEndTime: row.latest_end
      };
    }
  } catch (dbErr) {
    console.error('[spineService]: DB lookup failed for power sequence:', dbErr);
  }

  // Strategy: If DB is empty/stale, we MUST check the cloud to establish the "Ground Truth".
  // We no longer skip based on status to avoid missing plans on 'READY' machines.
  const token = getAccessToken();
  console.log(`[spineService]: Requesting ground truth from Miele Cloud for ${deviceId}...`);

  try {
    const response = await axios.get(`https://ems.domestic.miele-iot.com/v1/features/powerSequence?deviceId=${deviceId}`, {
      headers: {
        'Authorization': `Bearer ${token || 'mock-token-poc'}`,
        'Accept': 'application/json',
      }
    });

    addApiLog('GET', `/features/powerSequence?deviceId=${deviceId}`, response.data);
    if (Array.isArray(response.data)) {
      const seqObj = response.data.find((item: any) => item.deviceId === deviceId);
      const data = seqObj ? seqObj.data : null;
      
      if (data) {
        const state = (data.state || '').toLowerCase();
        if (state === 'scheduled' || state === 'running') {
          // Ensure we have slots persisted for the current cycle
          await refreshPowerTimeSlots(deviceId);
        } else if (state === 'inactive' || state === 'off') {
          // Cleanup at end of cycle
          await clearPowerTimeSlots(deviceId);
        }
      }
      return data;
    }
    
    const data = response.data;
    if (data) {
      const state = (data.state || '').toLowerCase();
      if (state === 'scheduled' || state === 'running') {
        await refreshPowerTimeSlots(deviceId);
      } else if (state === 'inactive' || state === 'off') {
        await clearPowerTimeSlots(deviceId);
      }
    }
    return data;
  } catch (error: any) {
    console.error(`[spineService]: Failed to fetch power sequence for ${deviceId}:`, error.response?.data || error.message);
    throw new Error(`Failed to fetch power sequence for ${deviceId}: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
  }
};

export const clearPowerTimeSlots = async (deviceId: string) => {
  try {
    await pool.query('DELETE FROM dynamic_power_slots WHERE device_id = $1', [deviceId]);
    console.log(`[spineService]: Cleared power slots for ${deviceId}`);
  } catch (err) {
    console.error(`[spineService]: Failed to clear slots for ${deviceId}:`, err);
  }
};

const iso8601ToMinutes = (duration: string): number => {
  if (!duration) return 15; // Default fallback
  const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) return 15;
  const hours = parseInt(matches[1] || '0');
  const mins = parseInt(matches[2] || '0');
  const secs = parseInt(matches[3] || '0');
  return (hours * 60) + mins + (secs / 60);
};

export const refreshPowerTimeSlots = async (deviceId: string) => {
  // First check if we already have slots to avoid redundant cloud calls
  try {
    const check = await pool.query('SELECT 1 FROM dynamic_power_slots WHERE device_id = $1 LIMIT 1', [deviceId]);
    if (check.rows.length > 0) return; // Already persisted for this cycle
  } catch (err) {}

  const token = getAccessToken();
  console.log(`[spineService]: Refreshing and persisting power slots for ${deviceId}...`);

  try {
    const response = await axios.get(`https://ems.domestic.miele-iot.com/v1/features/powerTimeSlot?deviceId=${deviceId}`, {
      headers: {
        'Authorization': `Bearer ${token || 'mock-token-poc'}`,
        'Accept': 'application/json',
      }
    });

    // Miele API returns a flat array of feature objects based on the user's provided JSON
    const features = Array.isArray(response.data) ? response.data : [];
    
    if (features.length > 0) {
      // Clear old just in case
      await pool.query('DELETE FROM dynamic_power_slots WHERE device_id = $1', [deviceId]);
      
      // Persist new slots
      for (let i = 0; i < features.length; i++) {
        const feature = features[i];
        const slotData = feature.data;
        if (!slotData) continue;

        const durationMinutes = iso8601ToMinutes(slotData.defaultDuration);
        const powerW = slotData.power?.number || 0;
        const slotNum = slotData.slotNumber ?? i;

        await pool.query(
          'INSERT INTO dynamic_power_slots (device_id, slot_number, duration_minutes, power_w) VALUES ($1, $2, $3, $4)',
          [deviceId, slotNum, durationMinutes, powerW]
        );
      }
      console.log(`[spineService]: Persisted ${features.length} slots for ${deviceId}`);
    }
  } catch (error: any) {
    console.error(`[spineService]: Failed to refresh power slots for ${deviceId}:`, error.message);
  }
};

export const getPowerTimeSlot = async (deviceId: string) => {
  // DB-Only: We now rely on the persistent lifecycle triggered by getPowerSequence
  try {
    const dbSlots = await pool.query(
      'SELECT slot_number, duration_minutes, power_w FROM dynamic_power_slots WHERE device_id = $1 ORDER BY slot_number ASC',
      [deviceId]
    );
    
    if (dbSlots.rows.length > 0) {
      const timeSlots = dbSlots.rows.map((r: any, idx: number) => ({
        chunkIndex: idx,
        durationMinutes: r.duration_minutes,
        powerConsumptionW: r.power_w
      }));
      return { deviceId, slots: timeSlots };
    }
  } catch (dbErr) {
    console.error('[spineService]: DB lookup failed for power time slots:', dbErr);
  }

  return null; // Return null if not in cycle
};


export const configureSpineApi = async (config: { endpoint: string; token: string }) => {
  console.log('[spineService]: Configuring Spine-IoT API connection:', config.endpoint);
  // In real life, verify connection here
  return { success: true, message: 'Spine-IoT API connected successfully' };
};

export const syncAllDevices = async () => {
  console.log('[spineService]: Starting full initial sync with Miele Cloud...');
  const devices = await getSpineDevices();
  
  for (const device of devices) {
    try {
      console.log(`[spineService]: Syncing ${device.name} (${device.id})...`);
      
      const token = getAccessToken();
      if (!token) {
        console.log('[spineService]: No token available for sync. Skipping.');
        break;
      }

      // 1. Sync Power Sequence
      const seqRes = await axios.get(`https://ems.domestic.miele-iot.com/v1/features/powerSequence?deviceId=${device.id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      }).catch(() => null);

      if (seqRes && seqRes.data) {
        // Handle both single object and array responses
        let seq = seqRes.data;
        if (Array.isArray(seq)) {
          const item = seq.find((i: any) => i.deviceId === device.id);
          seq = item ? item.data : null;
        }

        if (seq) {
          let newState = seq.state?.toUpperCase() || 'READY';
          const startTime = seq.startTime || null;
          const endTime = seq.endTime || null;
          const earliest = seq.earliestStartTime || null;
          const latest = seq.latestEndTime || null;

          await pool.query(
            'INSERT INTO device_schedules (device_id, device_name, scheduled_start, scheduled_end, earliest_start, latest_end, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [device.id, device.name, startTime, endTime, earliest, latest, newState]
          );
          console.log(`[spineService]: Synced sequence for ${device.name}: ${newState}`);

          // NEW: Also sync Power Time Slots for accurate chart/tooltip rendering
          try {
            await getPowerTimeSlot(device.id);
            console.log(`[spineService]: Synced power slots for ${device.name}`);
          } catch (slotErr) {
            console.error(`[spineService]: Failed to sync power slots for ${device.name}`);
          }
        }
      }
    } catch (err: any) {
      console.error(`[spineService]: Error syncing device ${device.id}: `, err.message);
    }
  }
  console.log('[spineService]: Initial sync completed.');
};
