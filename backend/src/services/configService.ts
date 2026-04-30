import fs from 'fs';
import path from 'path';

let config: any = null;

export const loadConfig = () => {
  if (config) return config;

  const configPath = path.join(process.cwd(), 'sunshift-config.json');
  try {
    const fileContents = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(fileContents);
    console.log('[configService]: Successfully loaded sunshift-config.json');
  } catch (err: any) {
    console.error(`[configService]: Failed to load sunshift-config.json from ${configPath}: ${err.message}`);
    // Provide sensible defaults if the file is missing so the system doesn't crash completely
    config = {
      system: { baseUrl: 'https://sunshift.never2sunny.eu' },
      homeAssistant: {
        url: 'wss://home.never2sunny.eu/api/websocket',
        entities: {
          pvPower: 'sensor.pv_leistung',
          gridPower: 'sensor.netzzustand',
          evChargingPower: 'sensor.smaev_3011444125_charging_station_power'
        }
      },
      solarPlant: {
        location: { lat: 51.9, lon: 8.4 },
        arrays: [
          { name: 'Ost', dec: 45, az: -90, kwp: 4.0 },
          { name: 'West', dec: 45, az: 90, kwp: 6.0 }
        ]
      }
    };
  }
  return config;
};

export const getConfig = () => {
  if (!config) return loadConfig();
  return config;
};
