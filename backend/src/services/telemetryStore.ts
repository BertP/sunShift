import pool from '../db';

export const liveTelemetry = {
  pvLeistung: 0,
  netzzustand: 0,
  eUpPower: 0,
  batteryLevel: 85,
  batteryState: 'discharging',
  lastUpdated: new Date().toISOString()
};

export const updateTelemetry = async (pv: number | null, grid: number | null, eup: number | null, batteryLevel?: number, batteryState?: string) => {
  if (pv !== null) liveTelemetry.pvLeistung = pv;
  if (grid !== null) liveTelemetry.netzzustand = grid;
  if (eup !== null) liveTelemetry.eUpPower = eup;
  if (batteryLevel !== undefined) liveTelemetry.batteryLevel = batteryLevel;
  if (batteryState !== undefined) liveTelemetry.batteryState = batteryState;
  liveTelemetry.lastUpdated = new Date().toISOString();

  try {
    await pool.query(
      "INSERT INTO live_telemetry_history (pv_power_w, grid_power_w, ev_power_w) VALUES ($1, $2, $3)",
      [liveTelemetry.pvLeistung, liveTelemetry.netzzustand, liveTelemetry.eUpPower]
    );
    
    // Prune anything older than 7 days
    await pool.query(
      "DELETE FROM live_telemetry_history WHERE timestamp < NOW() - INTERVAL '7 days'"
    );
  } catch (dbErr) {
    console.error('[telemetryStore]: Failed logging real-time values:', dbErr);
  }
};
