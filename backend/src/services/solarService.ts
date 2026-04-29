import axios from 'axios';
import pool from '../db';

// Default coordinates for PLZ 33335 (Gütersloh area)
const LAT = 51.9;
const LON = 8.4;
const DEC = 35; // Declination
const AZ = 0; // Azimuth (0 is South in Forecast.Solar? Wait, 0 is South, -90 East, 90 West)
const KWP = 10; // 10 kWp system

export const fetchAndStoreSolarForecast = async () => {
  try {
    const apiKey = process.env.FORECAST_SOLAR_API_KEY;
    const url = apiKey 
      ? `https://api.forecast.solar/${apiKey}/estimate/${LAT}/${LON}/${DEC}/${AZ}/${KWP}`
      : `https://api.forecast.solar/estimate/${LAT}/${LON}/${DEC}/${AZ}/${KWP}`;

    const response = await axios.get(url);
    const watts = response.data.result.watts;

    const client = await pool.connect();
    try {
      for (const [timeStr, wattValue] of Object.entries(watts)) {
        const timestamp = new Date(timeStr);
        const wattHours = Number(wattValue);

        await client.query(`
          INSERT INTO pv_forecast (timestamp, watt_hours)
          VALUES ($1, $2)
          ON CONFLICT (timestamp) DO UPDATE SET watt_hours = EXCLUDED.watt_hours
        `, [timestamp, wattHours]);
      }
      console.log(`[solarService]: Successfully updated ${Object.keys(watts).length} solar data points`);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[solarService]: Failed to fetch or store solar forecast', err.message);
    // If API limits hit, we could mock data for testing
    console.log('[solarService]: Falling back to mock data for development');
    await storeMockSolarData();
  }
};

const storeMockSolarData = async () => {
  const client = await pool.connect();
  try {
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), i, 0, 0);
      // Bell curve for solar production peaking at noon
      const hour = i;
      let wattHours = 0;
      if (hour >= 6 && hour <= 18) {
        wattHours = Math.sin((hour - 6) / 12 * Math.PI) * 8000; // Peak 8kW
      }

      await client.query(`
        INSERT INTO pv_forecast (timestamp, watt_hours)
        VALUES ($1, $2)
        ON CONFLICT (timestamp) DO UPDATE SET watt_hours = EXCLUDED.watt_hours
      `, [timestamp, wattHours]);
    }
  } finally {
    client.release();
  }
};

export const getSolarForecast = async () => {
  const result = await pool.query('SELECT * FROM pv_forecast WHERE timestamp >= CURRENT_DATE ORDER BY timestamp ASC LIMIT 24');
  return result.rows;
};
