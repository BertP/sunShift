export const liveTelemetry = {
  pvLeistung: 0,
  netzzustand: 0,
  eUpPower: 0,
  lastUpdated: new Date().toISOString()
};

export const updateTelemetry = (pv: number | null, grid: number | null, eup: number | null) => {
  if (pv !== null) liveTelemetry.pvLeistung = pv;
  if (grid !== null) liveTelemetry.netzzustand = grid;
  if (eup !== null) liveTelemetry.eUpPower = eup;
  liveTelemetry.lastUpdated = new Date().toISOString();
};

