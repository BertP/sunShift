import axios from 'axios';
import pool from '../db';

export const fetchAndStorePrices = async () => {
  try {
    // Awattar API for Germany
    const response = await axios.get('https://api.awattar.de/v1/marketdata');
    const data = response.data.data;

    const client = await pool.connect();
    try {
      for (const item of data) {
        const timestamp = new Date(item.start_timestamp);
        const price = item.marketprice / 10; // Awattar gives Eur/MWh, convert to Cent/kWh

        await client.query(`
          INSERT INTO prices (timestamp, price)
          VALUES ($1, $2)
          ON CONFLICT (timestamp) DO UPDATE SET price = EXCLUDED.price
        `, [timestamp, price]);
      }
      console.log(`[priceService]: Successfully updated ${data.length} price points`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[priceService]: Failed to fetch or store prices', err);
  }
};

export const getPrices = async () => {
  const result = await pool.query('SELECT * FROM prices WHERE timestamp >= CURRENT_DATE ORDER BY timestamp ASC LIMIT 24');
  return result.rows;
};
