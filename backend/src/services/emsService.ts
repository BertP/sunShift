import { getPrices } from './priceService';
import { getSolarForecast } from './solarService';
import { scheduleDevice, MieleDevice } from './mieleService';
import { getPowerTimeSlot, getSpineDevices, getPowerSequence } from './spineService';

export const runOptimization = async () => {
  console.log('[emsService]: Running optimization cycle V1 (POC 0.6)...');
  
  const spineDevices = await getSpineDevices();
  const prices = await getPrices();
  const solar = await getSolarForecast();

  if (prices.length === 0) {
    console.log('[emsService]: No price data available. Skipping optimization.');
    return;
  }

  // Use real Spine devices discovered via API
  for (const device of spineDevices) {
    try {
      // Only optimize if device is in a state that allows remote scheduling
      // Miele/EEBUS usually require the machine to be in 'PROGRAMMED' or 'SCHEDULED' state for the sequence to be valid.
      // If it's just 'READY', the user hasn't pressed 'SmartStart' yet.
      const liveStatus = device.status?.toLowerCase() || 'unknown';
      if (liveStatus !== 'programmed' && liveStatus !== 'scheduled' && liveStatus !== 'running') {
        console.log(`[emsService]: Device ${device.name} is in state '${liveStatus}'. Not ready for remote scheduling. Skipping.`);
        continue;
      }

      const sequence = await getPowerSequence(device.id, liveStatus);

      // Create a MieleDevice-compatible object for the optimizer
      const readyAt = sequence.endTime ? new Date(sequence.endTime) : new Date(Date.now() + 12 * 60 * 60 * 1000);
      const durationMs = sequence.duration ? parseDuration(sequence.duration) : 120 * 60 * 1000;

      const mappedDevice = {
        id: device.id,
        name: device.name,
        type: device.type,
        status: liveStatus.toUpperCase(),
        programDurationMinutes: durationMs / 60000,
        readyAt: readyAt
      };

      console.log(`[emsService]: Optimizing real device ${mappedDevice.name} (Ready until: ${readyAt.toISOString()})`);
      await optimizeDeviceSchedule(mappedDevice as any, prices, solar);

    } catch (err: any) {
      console.log(`[emsService]: Error optimizing device ${device.name}: ${err.message}`);
    }
  }

};

const parseDuration = (isoDuration: string): number => {
  const match = isoDuration.match(/PT(\d+)M/);
  if (match) return parseInt(match[1]) * 60 * 1000;
  return 120 * 60 * 1000; // Default 2h
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

