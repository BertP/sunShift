import { EventEmitter } from 'events';

export interface ApiLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  response: string;
}

// Extended protocol entry for bidirectional SPINE monitoring
export interface ProtocolEntry {
  id: string;
  timestamp: string;
  direction: 'OUT' | 'IN' | 'SYSTEM';
  category: 'binding' | 'subscription' | 'callback' | 'command' | 'query' | 'auth' | 'system' | 'other';
  method: string;
  endpoint: string;
  deviceId?: string;
  featureType?: string;
  statusCode?: number;
  requestPayload?: any;
  responsePayload?: any;
  errorMessage?: string;
  durationMs?: number;
}

let logs: ApiLog[] = [];
let protocolLog: ProtocolEntry[] = [];
export const protocolEmitter = new EventEmitter();
protocolEmitter.setMaxListeners(50);

export const addApiLog = (method: string, endpoint: string, responseData: any) => {
  logs.unshift({
    id: String(Math.random()),
    timestamp: new Date().toISOString(),
    method,
    endpoint,
    response: JSON.stringify(responseData, null, 2)
  });
  if (logs.length > 30) {
    logs.pop();
  }
};

export const addProtocolEntry = (entry: Omit<ProtocolEntry, 'id' | 'timestamp'>) => {
  const newEntry: ProtocolEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  protocolLog.unshift(newEntry);
  if (protocolLog.length > 200) {
    protocolLog.pop();
  }
  protocolEmitter.emit('new_entry', newEntry);
};

export const getProtocolLog = (): ProtocolEntry[] => protocolLog;

export const clearProtocolLog = () => {
  protocolLog = [];
  protocolEmitter.emit('clear');
};

export const getApiLogs = () => logs;

export const clearApiLogs = () => {
  logs = [];
  protocolLog = [];
  protocolEmitter.emit('clear');
};

