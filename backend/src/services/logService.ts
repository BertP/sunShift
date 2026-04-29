export interface ApiLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  response: string;
}

let logs: ApiLog[] = [];

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

export const getApiLogs = () => logs;

export const clearApiLogs = () => {
  logs = [];
};
