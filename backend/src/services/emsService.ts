import { getPrices } from './priceService';
import { getSolarForecast } from './solarService';
import { getMieleDevices, scheduleDevice, MieleDevice } from './mieleService';

export const runOptimization = async () => {
  console.log('[emsService]: Running optimization cycle...');
  
  const devices = await getMieleDevices();
  const prices = await getPrices();
  const solar = await getSolarForecast();

  if (prices.length === 0) {
    console.log('[emsService]: No price data available. Skipping optimization.');
    return;
  }

  const readyDevices = devices.filter(d => d.status === 'READY');

  for (const device of readyDevices) {
    await optimizeDeviceSchedule(device, prices, solar);
  }
};

const optimizeDeviceSchedule = async (device: MieleDevice, prices: any[], solar: any[]) => {
  const now = new Date();
  const durationMs = device.programDurationMinutes * 60 * 1000;
  const latestStart = new Date(device.readyAt.getTime() - durationMs);

  if (latestStart <= now) {
    console.log(`[emsService]: ${device.name} must start immediately!`);
    await scheduleDevice(device.id, now);
    return;
  }

  let bestStartTime = now;
  let lowestCost = Infinity;

  // Check slots every 30 minutes
  for (let time = now.getTime(); time <= latestStart.getTime(); time += 30 * 60 * 1000) {
    const slotStart = new Date(time);
    const slotEnd = new Date(time + durationMs);

    // Calculate cost for this slot
    const cost = calculateSlotCost(slotStart, slotEnd, prices, solar);

    if (cost < lowestCost) {
      lowestCost = cost;
      bestStartTime = slotStart;
    }
  }

  console.log(`[emsService]: Best slot for ${device.name} found: ${bestStartTime.toISOString()} with cost metric ${lowestCost}`);
  await scheduleDevice(device.id, bestStartTime);
};

const calculateSlotCost = (start: Date, end: Date, prices: any[], solar: any[]) => {
  let totalCost = 0;

  // Average price in this slot
  const relevantPrices = prices.filter(p => {
    const pTime = new Date(p.timestamp);
    return pTime >= start && pTime <= end;
  });

  if (relevantPrices.length > 0) {
    const avgPrice = relevantPrices.reduce((sum, p) => sum + p.price, 0) / relevantPrices.length;
    totalCost += avgPrice;
  }

  // Factor in Solar (PV lowers cost)
  const relevantSolar = solar.filter(s => {
    const sTime = new Date(s.timestamp);
    return sTime >= start && sTime <= end;
  });

  if (relevantSolar.length > 0) {
    const totalSolarWattHours = relevantSolar.reduce((sum, s) => sum + s.watt_hours, 0);
    // Arbitrary reduction: 1 kWh of PV saves 30 cents equivalent (or avoids high price)
    totalCost -= (totalSolarWattHours / 1000) * 30; 
  }

  return totalCost;
};
