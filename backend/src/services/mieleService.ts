import pool from '../db';

export interface MieleDevice {
  id: string;
  name: string;
  type: string;
  status: string;
  programDurationMinutes: number;
  readyAt: Date;
}

// In-memory store for mock devices
let mockDevices: MieleDevice[] = [
  {
    id: '000186348553',
    name: 'Washer',
    type: 'Washer',
    status: 'READY',
    programDurationMinutes: 90,
    readyAt: new Date(Date.now() + 8 * 60 * 60 * 1000)
  },
  {
    id: '000091093524',
    name: 'Dryer',
    type: 'Dryer',
    status: 'READY',
    programDurationMinutes: 60,
    readyAt: new Date(Date.now() + 6 * 60 * 60 * 1000)
  },
  {
    id: '000105666767',
    name: 'Dishwasher',
    type: 'Dishwasher',
    status: 'READY',
    programDurationMinutes: 120,
    readyAt: new Date(Date.now() + 12 * 60 * 60 * 1000)
  }
];

export const getMieleDevices = async () => {
  return mockDevices;
};

export const scheduleDevice = async (deviceId: string, startTime: Date) => {
  const device = mockDevices.find(d => d.id === deviceId);
  if (!device) throw new Error('Device not found');

  const endTime = new Date(startTime.getTime() + device.programDurationMinutes * 60 * 1000);
  device.status = 'SCHEDULED';

  // Store in DB
  await pool.query(`
    INSERT INTO device_schedules (device_id, device_name, scheduled_start, scheduled_end, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [deviceId, device.name, startTime, endTime, 'SCHEDULED']);

  console.log(`[mieleService]: Scheduled ${device.name} from ${startTime.toISOString()} to ${endTime.toISOString()}`);
  return { device, startTime, endTime };
};
