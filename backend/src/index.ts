import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db';

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

import { getPrices, fetchAndStorePrices } from './services/priceService';
import { getSolarForecast, fetchAndStoreSolarForecast } from './services/solarService';
import { getMieleDevices } from './services/mieleService';
import { runOptimization } from './services/emsService';
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
    res.json(sequenceData);
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
  res.json({ connected: isConnected() });
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

// Initial Sync after startup
setTimeout(async () => {
  console.log('[cron]: Running initial sync...');
  await loadTokensFromDB();
  await fetchAndStorePrices();
  await fetchAndStoreSolarForecast();
  await runOptimization();
}, 5000);

app.listen(PORT, () => {
  console.log(`[server]: Server is running at http://localhost:${PORT}`);
});
