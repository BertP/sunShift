import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS prices (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL UNIQUE,
        price FLOAT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pv_forecast (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL UNIQUE,
        watt_hours FLOAT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS device_schedules (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        scheduled_start TIMESTAMPTZ NOT NULL,
        scheduled_end TIMESTAMPTZ NOT NULL,
        status VARCHAR(50) DEFAULT 'SCHEDULED',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS miele_oauth_tokens (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_in INTEGER NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS device_bindings (
        device_id VARCHAR(255) PRIMARY KEY,
        bound_at TIMESTAMPTZ DEFAULT NOW(),
        binding_id VARCHAR(255),
        expires_at VARCHAR(255)
      );
      ALTER TABLE device_bindings ADD COLUMN IF NOT EXISTS binding_id VARCHAR(255);
      ALTER TABLE device_bindings ADD COLUMN IF NOT EXISTS expires_at VARCHAR(255);
      CREATE TABLE IF NOT EXISTS executed_runs (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        device_name VARCHAR(255) NOT NULL,
        start_time TIMESTAMPTZ NOT NULL,
        profile_slots JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dynamic_power_slots (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL,
        slot_number INTEGER NOT NULL,
        duration_minutes FLOAT NOT NULL,
        power_w FLOAT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(device_id, slot_number)
      );
    `);


    console.log('[db]: Database tables initialized');
  } catch (err) {
    console.error('[db]: Database initialization failed', err);
  } finally {
    client.release();
  }
};

export default pool;
