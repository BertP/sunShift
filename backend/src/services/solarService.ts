import axios from 'axios';
import pool from '../db';

import { getConfig } from './configService';

export const fetchAndStoreSolarForecast = async () => {
  try {
    const apiKey = process.env.FORECAST_SOLAR_API_KEY;
    
    // Wir sammeln die aggregierten Watt-Werte hier
    const aggregatedWatts: Record<string, number> = {};

    const solarConfig = getConfig().solarPlant;
    const LAT = solarConfig.location.lat;
    const LON = solarConfig.location.lon;
    const ROOFS = solarConfig.arrays;

    for (const roof of ROOFS) {
      // Wir nutzen die Open-Meteo Forecast API mit 'global_tilted_irradiance',
      // da dies die Einstrahlung auf die geneigte und ausgerichtete Fläche berechnet.
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=global_tilted_irradiance&tilt=${roof.dec}&azimuth=${roof.az}&forecast_days=7`;
      
      console.log(`[solarService]: Fetching Open-Meteo forecast for ${roof.name} roof (${roof.kwp} kWp)`);
      const response = await axios.get(url);
      
      const times = response.data.hourly.time;
      const radiations = response.data.hourly.global_tilted_irradiance;

      // Aggregieren der Werte
      for (let i = 0; i < times.length; i++) {
        const timeStr = times[i];
        const radiation = radiations[i]; // W/m²

        if (radiation === null) continue;

        // Umrechnung von Strahlung (W/m²) in elektrische Leistung (Watt)
        // Standard-Testbedingung (STC) für PV-Module ist 1000 W/m² für 1 kWp.
        // Formel: Watt = (Strahlung / 1000) * (kWp * 1000) * Wirkungsgrad (0.85)
        // Vereinfacht: Watt = Strahlung * kWp * 0.85
        const wattValue = radiation * roof.kwp * 0.85;

        const dateObj = new Date(timeStr + "Z"); // Open-Meteo liefert lokale Zeit oder UTC? Standard ist UTC (iso8601). Wait, es liefert "2026-04-30T00:00" ohne Z. Da OpenMeteo default UTC nimmt, hängen wir ein Z dran.
        dateObj.setMinutes(0, 0, 0); // Normalize to full hour
        const hourKey = dateObj.toISOString();

        if (!aggregatedWatts[hourKey]) {
          aggregatedWatts[hourKey] = 0;
        }
        aggregatedWatts[hourKey] += wattValue;
      }
    }

    const client = await pool.connect();
    try {
      for (const [timeStr, wattValue] of Object.entries(aggregatedWatts)) {
        const timestamp = new Date(timeStr);
        const wattHours = wattValue;

        await client.query(`
          INSERT INTO pv_forecast (timestamp, watt_hours)
          VALUES ($1, $2)
          ON CONFLICT (timestamp) DO UPDATE SET watt_hours = EXCLUDED.watt_hours
        `, [timestamp, wattHours]);
      }
      console.log(`[solarService]: Successfully updated ${Object.keys(aggregatedWatts).length} aggregated solar data points`);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[solarService]: Failed to fetch or store solar forecast', err.message);
    // FALLBACK REMOVED AS PER USER REQUEST
  }
};

export const getSolarForecast = async (dateString?: string) => {
  let query = 'SELECT * FROM pv_forecast WHERE timestamp >= CURRENT_DATE ORDER BY timestamp ASC LIMIT 48';
  let params: any[] = [];

  if (dateString) {
    const start = new Date(dateString);
    start.setHours(0,0,0,0);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    query = `
      SELECT * FROM pv_forecast 
      WHERE timestamp >= $1 AND timestamp < $2 
      ORDER BY timestamp ASC
    `;
    params = [start.toISOString(), end.toISOString()];
  }

  const result = await pool.query(query, params);
  return result.rows;
};

