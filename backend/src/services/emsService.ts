import { getPrices } from './priceService';
import { getSolarForecast } from './solarService';
import { getMieleDevices, scheduleDevice, MieleDevice } from './mieleService';
import { getPowerTimeSlot } from './spineService';


export const runOptimization = async () => {
  console.log('[emsService]: Running optimization cycle V1 (POC 0.6)...');
  
  const devices = await getMieleDevices();
  const prices = await getPrices();
  const solar = await getSolarForecast();

  if (prices.length === 0) {
    console.log('[emsService]: No price data available. Skipping optimization.');
    return;
  }

  // 5. Rescheduling is allowed (READY & SCHEDULED)
  // 4. Prioritization: Dishwasher goes first
  const optimizedDevices = devices.filter(d => d.status === 'READY' || d.status === 'SCHEDULED')
    .sort((a, b) => {
      const aIsDW = a.name.toLowerCase().includes('dishwasher') || a.name.toLowerCase().includes('spülmaschine');
      const bIsDW = b.name.toLowerCase().includes('dishwasher') || b.name.toLowerCase().includes('spülmaschine');
      return aIsDW ? -1 : (bIsDW ? 1 : 0);
    });

  for (const device of optimizedDevices) {
    try {
      const timeSlotData = await getPowerTimeSlot(device.id);
      console.log(`[emsService]: Fetched real-time slot constraints for ${device.name} (${timeSlotData.slots?.length || 0} phases)`);
    } catch (err: any) {
      console.log(`[emsService]: Warning: Could not fetch real-time slot constraints for ${device.name}: ${err.message}`);
    }

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

  // Check slots every 15 minutes
  for (let time = now.getTime(); time <= latestStart.getTime(); time += 15 * 60 * 1000) {
    const slotStart = new Date(time);
    const slotEnd = new Date(time + durationMs);

    const cost = calculateSlotCost(slotStart, slotEnd, prices, solar, device);

    if (cost < lowestCost) {
      lowestCost = cost;
      bestStartTime = slotStart;
    }
  }

  console.log(`[emsService]: Best V1 slot for ${device.name} found: ${bestStartTime.toISOString()} with cost metric ${lowestCost}`);
  await scheduleDevice(device.id, bestStartTime);
};

const calculateSlotCost = (start: Date, end: Date, prices: any[], solar: any[], device: MieleDevice) => {
  let totalCost = 0;

  const relevantPrices = prices.filter(p => {
    const pTime = new Date(p.timestamp);
    return pTime >= start && pTime <= end;
  });

  // 3. Negative prices = Green Grid (low cost)
  if (relevantPrices.length > 0) {
    const avgPrice = relevantPrices.reduce((sum, p) => sum + p.price, 0) / relevantPrices.length;
    totalCost += avgPrice;
  }

  const relevantSolar = solar.filter(s => {
    const sTime = new Date(s.timestamp);
    return sTime >= start && sTime <= end;
  });

  // 1 & 2. PV over Grid & CO2 reduction proxy
  if (relevantSolar.length > 0) {
    const totalSolarWattHours = relevantSolar.reduce((sum, s) => sum + s.watt_hours, 0);
    totalCost -= (totalSolarWattHours / 1000) * 50; 
  }

  // 4. Prioritize early completion for Dishwasher
  const isDW = device.name.toLowerCase().includes('dishwasher') || device.name.toLowerCase().includes('spülmaschine');
  if (isDW) {
    const waitHours = (start.getTime() - Date.now()) / (1000 * 60 * 60);
    totalCost += waitHours * 15; 
  }

  return totalCost;
};

