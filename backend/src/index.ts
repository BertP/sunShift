import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db';
import { connectToHomeAssistant } from './services/homeAssistantService';


dotenv.config();

// Initialize Database
initDB();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'SunShift EMS Backend is running' });
});

app.get('/api/telemetry', (req: Request, res: Response) => {
  res.json(liveTelemetry);
});

import { getPrices, fetchAndStorePrices } from './services/priceService';
import { getSolarForecast, fetchAndStoreSolarForecast } from './services/solarService';
import { getMieleDevices } from './services/mieleService';
import { runOptimization } from './services/emsService';
import { liveTelemetry } from './services/telemetryStore';

import pool from './db';

app.get('/api/dashboard', async (req: Request, res: Response) => {
  try {
    addApiLog('STORY', 'System Ticker', '• Initialisiere Dashboard Aktualisierung\n• Lese Strompreise & PV-Ertragsprognose (lokal)\n• Synchronisiere Miele Cloud Geräte');
    const prices = await getPrices();
    const solar = await getSolarForecast();
    const devices = await getMieleDevices();
    const schedulesResult = await pool.query('SELECT * FROM device_schedules ORDER BY scheduled_start DESC LIMIT 10');

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    const alignedPrices: any[] = [];
    const alignedSolar: any[] = [];

    for (let i = 0; i < 24; i++) {
      const targetTime = new Date(startOfDay.getTime() + i * 60 * 60 * 1000);
      
      const pricePoint = prices.find(p => {
        const pTime = new Date(p.timestamp);
        return pTime.getHours() === i;
      });
      
      const solarPoint = solar.find(s => {
        const sTime = new Date(s.timestamp);
        return sTime.getHours() === i;
      });

      alignedPrices.push({
        timestamp: targetTime.toISOString(),
        price: pricePoint ? pricePoint.price : (prices.length > 0 ? prices[Math.min(prices.length - 1, i)].price : 0)
      });

      alignedSolar.push({
        timestamp: targetTime.toISOString(),
        watt_hours: solarPoint ? solarPoint.watt_hours : 0
      });
    }

    res.json({
      prices: alignedPrices,
      solar: alignedSolar,
      devices,
      schedules: schedulesResult.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { getSpineDevices, configureSpineApi, getPowerSequence } from './services/spineService';

app.get('/api/features/powerSequence', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });

    const sequenceData = await getPowerSequence(deviceId as string);
    const schedResult = await pool.query('SELECT * FROM device_schedules WHERE device_id = $1 ORDER BY id DESC LIMIT 1', [deviceId]);
    
    if (schedResult.rows.length > 0 && sequenceData) {
      const sched = schedResult.rows[0];
      return res.json({
        ...sequenceData,
        state: sequenceData.state || 'scheduled',
        startTime: sequenceData.startTime || new Date(sched.scheduled_start).toISOString(),
        endTime: sequenceData.endTime || new Date(sched.scheduled_end).toISOString()
      });

    }

    res.json(sequenceData);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/features/powerTimeSlot', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.query;
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    
    let timeSlots: any[] = [
      { chunkIndex: 0, durationMinutes: 15, powerConsumptionW: 500 },
      { chunkIndex: 1, durationMinutes: 15, powerConsumptionW: 1200 },
      { chunkIndex: 2, durationMinutes: 15, powerConsumptionW: 1800 },
      { chunkIndex: 3, durationMinutes: 15, powerConsumptionW: 1000 }
    ];
    
    if (deviceId === '000186348553') { 
      timeSlots = [
        { chunkIndex: 0, durationMinutes: 7.5, powerConsumptionW: 50 },
        { chunkIndex: 1, durationMinutes: 31.3, powerConsumptionW: 2100 },
        { chunkIndex: 2, durationMinutes: 110.25, powerConsumptionW: 150 }
      ];
    } else if (deviceId === '000105666767') { 
      timeSlots = [
        { chunkIndex: 0, durationMinutes: 15, powerConsumptionW: 150 },
        { chunkIndex: 1, durationMinutes: 15, powerConsumptionW: 1800 },
        { chunkIndex: 2, durationMinutes: 15, powerConsumptionW: 2000 },
        { chunkIndex: 3, durationMinutes: 15, powerConsumptionW: 1200 },
        { chunkIndex: 4, durationMinutes: 15, powerConsumptionW: 600 },
        { chunkIndex: 5, durationMinutes: 15, powerConsumptionW: 800 },
        { chunkIndex: 6, durationMinutes: 15, powerConsumptionW: 200 },
        { chunkIndex: 7, durationMinutes: 15, powerConsumptionW: 50 }
      ];
    } else if (deviceId === '000091093524') { 
      timeSlots = [
        { chunkIndex: 0, durationMinutes: 10.2, powerConsumptionW: 300 },
        { chunkIndex: 1, durationMinutes: 49.8, powerConsumptionW: 800 }
      ];
    }


    res.json({
      deviceId,
      slots: timeSlots
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/spine/devices', async (req: Request, res: Response) => {
  try {
    const devices = await getSpineDevices();
    res.json(devices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/spine/configure', async (req: Request, res: Response) => {
  try {
    const result = await configureSpineApi(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import { getApiLogs } from './services/logService';

app.get('/api/miele/logs', (req: Request, res: Response) => {
  res.json(getApiLogs());
});

import { exchangeCodeForToken, isConnected, disconnectMiele, loadTokensFromDB } from './services/mieleAuthService';

app.post('/api/miele/connect', (req: Request, res: Response) => {
  const clientId = process.env.MIELE_CLIENT_ID || '';
  const redirectUri = 'https://sunshift.never2sunny.eu/api/miele/callback';
  const scope = 'openid mcs_energy_management';
  
  const authUrl = `https://auth.domestic.miele-iot.com/partner/realms/mcs/protocol/openid-connect/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code`;
  
  res.json({ url: authUrl });
});

app.get('/api/miele/callback', async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;
  
  if (error) {
    return res.redirect(`https://sunshift.never2sunny.eu/?connected=false&error=${encodeURIComponent(error as string)}`);
  }
  
  if (!code) {
    return res.redirect('https://sunshift.never2sunny.eu/?connected=false&error=no_code_provided');
  }
  
  try {
    await exchangeCodeForToken(code as string);
    res.redirect('https://sunshift.never2sunny.eu/?connected=true');
  } catch (err: any) {
    res.redirect(`https://sunshift.never2sunny.eu/?connected=false&error=${encodeURIComponent(err.message)}`);
  }
});

app.get('/api/miele/status', (req: Request, res: Response) => {
  const { getAccessToken } = require('./services/mieleAuthService');
  res.json({ connected: isConnected(), token: getAccessToken() });
});


app.post('/api/miele/disconnect', (req: Request, res: Response) => {
  disconnectMiele();
  res.json({ success: true });
});

app.post('/api/factory-defaults', async (req: Request, res: Response) => {
  try {
    const { getAccessToken } = require('./services/mieleAuthService');
    const token = getAccessToken();
    const axios = require('axios');
    
    if (token) {
      try {
        const cloudBindings = await axios.get('https://ems.domestic.miele-iot.com/v1/bindings', {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        
        if (Array.isArray(cloudBindings.data)) {
          for (const b of cloudBindings.data) {
            const bId = b.bindingId || b.id;
            if (bId) {
              try {
                await axios.delete(`https://ems.domestic.miele-iot.com/v1/bindings?bindingId=${bId}`, {
                  headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
                });
              } catch (delErr: any) {
                console.error(`[server]: Failed to delete cloud binding ${bId}:`, delErr.message);
              }
            }
          }
        }
        
        // Clear Cloud Subscriptions
        try {
          const cloudSubs = await axios.get('https://ems.domestic.miele-iot.com/v1/subscriptions', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
          });
          
          if (Array.isArray(cloudSubs.data)) {
            for (const s of cloudSubs.data) {
              const sId = s.subscriptionId || s.id;
              if (sId) {
                try {
                  await axios.delete(`https://ems.domestic.miele-iot.com/v1/subscriptions?subscriptionId=${sId}`, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
                  });
                } catch (delErr: any) {
                  console.error(`[server]: Failed to delete cloud subscription ${sId}:`, delErr.message);
                }
              }
            }
          }
        } catch (subFetchErr: any) {
          console.error('[server]: Failed to fetch cloud subscriptions for cleanup:', subFetchErr.message);
        }
      } catch (bindFetchErr: any) {
        console.error('[server]: Failed to fetch cloud bindings for cleanup:', bindFetchErr.message);
      }

    }

    await pool.query('TRUNCATE TABLE device_bindings CASCADE');
    await pool.query('TRUNCATE TABLE miele_oauth_tokens CASCADE');
    
    const { clearBoundDevices } = require('./services/spineService');
    const { clearApiLogs } = require('./services/logService');
    clearBoundDevices();
    clearApiLogs();

    disconnectMiele();
    console.log('[server]: Factory defaults executed.');
    res.json({ success: true, message: 'Factory defaults executed successfully.' });
  } catch (err: any) {
    console.error('[server]: Factory reset failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

import { getAccessToken } from './services/mieleAuthService';
import { addApiLog } from './services/logService';
import axios from 'axios';

app.post('/api/devices/:id/start', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`[server]: Manually starting device ${id} now.`);
    
    const seqData = await getPowerSequence(id as string);
    const sequenceId = seqData?.sequenceId ?? 0;

    const token = getAccessToken();
    const startTime = new Date(Date.now() + 60000).toISOString();

    const payload = {
      deviceId: id,
      data: {
        shiftSelectSequence: {
          sequenceId: sequenceId,
          startTime: startTime
        }
      }
    };

    const response = await axios.post('https://ems.domestic.miele-iot.com/v1/usecaseInterfaces/flexibleStartForWhiteGoods/v1', payload, {
      headers: {
        'Authorization': `Bearer ${token || 'mock-token-poc'}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    addApiLog('POST', '/usecaseInterfaces/flexibleStartForWhiteGoods/v1', {
      statusCode: response.status,
      requestPayload: payload,
      responsePayload: response.data
    });

    res.json({ success: true, message: `Device ${id} start command dispatched.`, cloudData: response.data });
  } catch (err: any) {
    console.error('[server]: Failed to send start command to Miele Cloud:', err.response?.data || err.message);
    addApiLog('POST', '/usecaseInterfaces/flexibleStartForWhiteGoods/v1 [ERROR]', {
      statusCode: err.response?.status || 500,
      error: err.response?.data || err.message
    });
    res.status(500).json({ error: err.response?.data ? JSON.stringify(err.response.data) : err.message });
  }
});

app.post('/api/spine/callback', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    // Use existing API Log facility
    const { addApiLog } = require('./services/logService');

    addApiLog('POST', '/api/spine/callback', payload);
    console.log('[spineCallback]: Received webhook:', JSON.stringify(payload));

    if (Array.isArray(payload)) {
      for (const item of payload) {
        if (item.change === 'createReplace' && item.feature && item.feature.featureObjType === 'powerSequence') {
          const seq = item.feature;
          const deviceId = seq.deviceId;
          if (deviceId && seq.data) {
             const newState = seq.data.state ? seq.data.state.toUpperCase() : 'SCHEDULED';
             await pool.query(
               'UPDATE device_schedules SET status = $1, scheduled_start = $2, scheduled_end = $3 WHERE device_id = $4',
               [newState, seq.data.startTime, seq.data.endTime, deviceId]
             );
             console.log(`[spineCallback]: Updated ${deviceId} to ${newState}`);

             if (newState === 'SCHEDULED' || newState === 'RUNNING') {
               try {
                 const { getPowerTimeSlot } = require('./services/spineService');
                 await getPowerTimeSlot(deviceId);
                 console.log(`[spineCallback]: Re-read Power Time Slots for ${deviceId}`);
               } catch (ptsErr) {
                 console.error(`[spineCallback]: Failed to interpret dynamic power time slots for ${deviceId}:`, ptsErr);
               }
             }

          }
        }
      }
    }
    res.sendStatus(200);
  } catch (e: any) {
    console.error('[spineCallback]: Failed processing webhook:', e.message);
    res.sendStatus(500);
  }
});

app.post('/api/optimize', async (req: Request, res: Response) => {

  try {
    addApiLog('STORY', 'Optimizer', '• Starte intelligenten EMS-Abgleich\n• Aktualisiere Spot-Markt-Preise\n• Lade PV Prognose neu\n• Optimiere Einschaltzeiten der Geräte');
    await fetchAndStorePrices();
    await fetchAndStoreSolarForecast();
    await runOptimization();
    res.json({ message: 'Optimization successful' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Periodic Price Sync (every 24 hours)
setInterval(async () => {
  console.log('[cron]: Running 24-hourly price sync...');
  await fetchAndStorePrices();
  await runOptimization();
}, 24 * 60 * 60 * 1000);

// Periodic PV Forecast Sync (every 60 minutes)
setInterval(async () => {
  console.log('[cron]: Running hourly PV forecast sync...');
  await fetchAndStoreSolarForecast();
  await runOptimization();
}, 60 * 60 * 1000);
// Periodic PowerTimeSlot interpretation for scheduled/running devices (every 1 minute)
setInterval(async () => {
  try {
    const { getPowerTimeSlot } = require('./services/spineService');
    const activeSchedules = await pool.query(
      "SELECT device_id FROM device_schedules WHERE status IN ('SCHEDULED', 'RUNNING')"
    );
    
    for (const row of activeSchedules.rows) {
      try {
        await getPowerTimeSlot(row.device_id);
        console.log(`[cron]: Periodically refreshed PowerTimeSlots for active device ${row.device_id}`);
      } catch (ptsErr) {
        // Silent fallback
      }
    }
  } catch (cronErr: any) {
    console.error('[cron]: Failed polling active appliance constraints:', cronErr.message);
  }
}, 60 * 1000);

// Initial Sync after startup
setTimeout(async () => {
  console.log('[cron]: Running initial sync...');
  await loadTokensFromDB();
  await fetchAndStorePrices();
  await fetchAndStoreSolarForecast();
  await runOptimization();
  connectToHomeAssistant();

}, 5000);

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});
