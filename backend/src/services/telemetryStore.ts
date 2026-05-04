import pool from '../db';

export const liveTelemetry = {
  pvLeistung: 0,
  netzzustand: 0,
  eUpPower: 0,
  batteryLevel: 85,
  batteryState: 'discharging',
  heatPumpPower: 0,
  lastUpdated: new Date().toISOString()
};

export const updateTelemetry = async (pv: number | null, grid: number | null, eup: number | null, batteryLevel?: number, batteryState?: string, heatPump?: number) => {
  if (pv !== null) liveTelemetry.pvLeistung = pv;
  if (grid !== null) liveTelemetry.netzzustand = grid;
  if (eup !== null) liveTelemetry.eUpPower = eup;
  if (batteryLevel !== undefined) liveTelemetry.batteryLevel = batteryLevel;
  if (batteryState !== undefined) liveTelemetry.batteryState = batteryState;
  if (heatPump !== undefined) liveTelemetry.heatPumpPower = heatPump;
  liveTelemetry.lastUpdated = new Date().toISOString();

  try {
    await pool.query(
      "INSERT INTO live_telemetry_history (pv_power_w, grid_power_w, ev_power_w, hp_power_w, battery_level, battery_state) VALUES ($1, $2, $3, $4, $5, $6)",
      [liveTelemetry.pvLeistung, liveTelemetry.netzzustand, liveTelemetry.eUpPower, liveTelemetry.heatPumpPower, liveTelemetry.batteryLevel, liveTelemetry.batteryState]
    );
    
    // Prune anything older than 30 days
    await pool.query(
      "DELETE FROM live_telemetry_history WHERE timestamp < NOW() - INTERVAL '30 days'"
    );
  } catch (dbErr) {
    console.error('[telemetryStore]: Failed logging real-time values:', dbErr);
  }
};
