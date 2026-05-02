import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Sun, 
  Cpu, 
  RefreshCw, 
  AlertCircle,
  Settings,
  HelpCircle,
  Cloud,
  CloudOff,
  Home,
  Zap,
  Battery,
  BatteryCharging,
  ChevronDown,
  ChevronUp,
  Car,
  Fan
} from 'lucide-react';

import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';


import { FloatingPanels } from './components/FloatingPanels';
import { GanttTimeline } from './components/GanttTimeline';
import packageJson from '../package.json';



ChartJS.register(...registerables);


interface PriceData {
  timestamp: string;
  price: number;
}

interface SolarData {
  timestamp: string;
  watt_hours: number;
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  programDurationMinutes: number;
  readyAt: string;
}


interface SpineDevice {
  id: string;
  name: string;
  type: string;
  protocol: string;
  status: string;
  powerConsumptionW: number;
  bindingId?: string;
  subscriptionId?: string;
  validUntil?: string;
}


function App() {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [solar, setSolar] = useState<SolarData[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [spineDevices, setSpineDevices] = useState<SpineDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Configure Section State
  const [showConfigure, setShowConfigure] = useState(false);
  const [configMessage, setConfigMessage] = useState('');
  const [isMieleConnected, setIsMieleConnected] = useState(false);
  const [powerSequences, setPowerSequences] = useState<Record<string, any>>({});
  const [powerTimeSlots, setPowerTimeSlots] = useState<Record<string, any>>({});
  const [executedRuns, setExecutedRuns] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const [telemetry, setTelemetry] = useState({ 
    pvLeistung: 0, 
    netzzustand: 0, 
    eUpPower: 0,
    batteryLevel: 0,
    batteryState: 'idle',
    heatPumpPower: 0
  });
  const [callbackLogs, setCallbackLogs] = useState<any[]>([]);



  const [priceSurcharge, setPriceSurcharge] = useState<number>(() => {
    const saved = localStorage.getItem('sunshift_price_surcharge');
    return saved ? parseFloat(saved) : 0;
  });
  
  useEffect(() => {
    localStorage.setItem('sunshift_price_surcharge', priceSurcharge.toString());
  }, [priceSurcharge]);

  const [visibleDatasets, setVisibleDatasets] = useState<string[]>(['price', 'pv', 'washer', 'dryer', 'dishwasher', 'eup']);
  const [viewType, setViewType] = useState<'forecast' | 'live'>('forecast');
  const getLocalISODate = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState<string>(getLocalISODate());
  const [liveHistory, setLiveHistory] = useState<any[]>([]);




  const chartRef = useRef<any>(null);
  const [isMonitoringExpanded, setIsMonitoringExpanded] = useState(false);


  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [isLogsDetached, setIsLogsDetached] = useState(false);
  const [viewMode, setViewMode] = useState<'customer' | 'developer'>('developer');
  const [showHelp, setShowHelp] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);

  const handleDateChange = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (current > tomorrow) return;

    if (current.getDate() === tomorrow.getDate() && current.getMonth() === tomorrow.getMonth() && current.getFullYear() === tomorrow.getFullYear()) {
      if (today.getHours() < 14) {
        alert("Prognosen für morgen sind erst ab 14:00 Uhr verfügbar.");
        return;
      }
    }

    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const [tickerPos, setTickerPos] = useState({ x: window.innerWidth - 450, y: 200 });
  const [tickerDragging, setTickerDragging] = useState(false);

  const [tickerRel, setTickerRel] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!tickerDragging) return;
      setTickerPos({
        x: Math.max(10, Math.min(window.innerWidth - 100, e.clientX - tickerRel.x)),
        y: Math.max(10, Math.min(window.innerHeight - 100, e.clientY - tickerRel.y))
      });
    };
    const onMouseUp = () => {
      setTickerDragging(false);
    };
    if (tickerDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [tickerDragging, tickerRel]);

  const [logPos, setLogPos] = useState({ x: window.innerWidth - 550, y: 80 });
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      setLogPos({
        x: Math.max(10, Math.min(window.innerWidth - 100, e.clientX - rel.x)),
        y: Math.max(10, Math.min(window.innerHeight - 100, e.clientY - rel.y))
      });
    };
    const onMouseUp = () => {
      setDragging(false);
    };
    if (dragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, rel]);
  
  const [callbackPos, setCallbackPos] = useState({ x: window.innerWidth - 500, y: 140 });
  const [callbackDragging, setCallbackDragging] = useState(false);
  const [callbackRel, setCallbackRel] = useState({ x: 0, y: 0 });


  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!callbackDragging) return;
      setCallbackPos({
        x: Math.max(10, Math.min(window.innerWidth - 100, e.clientX - callbackRel.x)),
        y: Math.max(10, Math.min(window.innerHeight - 100, e.clientY - callbackRel.y))
      });
    };
    const onMouseUp = () => {
      setCallbackDragging(false);
    };
    if (callbackDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [callbackDragging, callbackRel]);

  const [helpSection, setHelpSection] = useState<'overview' | 'chart' | 'devices' | 'developer'>('overview');


  const fetchData = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(`/api/dashboard?date=${selectedDate}`);
      setPrices(response.data.prices);
      setSolar(response.data.solar);
      setDevices(response.data.devices);
      
      if (response.data.powerSequences) {
        setPowerSequences(response.data.powerSequences);
      }
      if (response.data.powerTimeSlots) {
        setPowerTimeSlots(response.data.powerTimeSlots);
      }


      try {
        const histRes = await axios.get(`/api/telemetry-history?date=${selectedDate}`);
        setLiveHistory(histRes.data);
      } catch (histErr) {
        console.error('Failed to fetch telemetry history', histErr);
      }

      try {
        const runsRes = await axios.get('/api/executed-runs');
        setExecutedRuns(runsRes.data);
      } catch (runErr) {}

      try {
        const logsRes = await axios.get('/api/miele/logs');
        setApiLogs(logsRes.data);
      } catch (logErr) {
        console.error('Failed to fetch API logs', logErr);
      }

      try {
        const cbLogsRes = await axios.get('/api/spine/callback-logs');
        setCallbackLogs(cbLogsRes.data);
      } catch (cbErr) {
        console.error('Failed to fetch callback logs', cbErr);
      }
      
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'}));
    } catch (err: any) {
      console.error('Failed to fetch dashboard data', err);
      setError('Connection to backend failed.');
    } finally {
      setLoading(false);
    }
  };


  const triggerOptimize = async () => {
    try {
      setLoading(true);
      await axios.post('/api/optimize');
      await fetchData();
    } catch (err: any) {
      setError('Optimization failed.');
      setLoading(false);
    }
  };


  const handleMieleConnect = async () => {
    if (isMieleConnected) {
      try {
        setLoading(true);
        await axios.post('/api/miele/disconnect');
        setIsMieleConnected(false);
        setSpineDevices([]);
        setConfigMessage('No Cloud Connected');
      } catch (err) {
        setConfigMessage('Disconnect failed.');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/api/miele/connect');
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setConfigMessage('Connection failed.');
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/miele/status');
      if (res.data.token) {
        await navigator.clipboard.writeText(res.data.token);
        setConfigMessage('Token kopiert!');
      } else {
        setConfigMessage('Kein Token vorhanden.');
      }
    } catch (err) {
      setConfigMessage('Kopieren fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  const handleFactoryReset = async () => {

    if (!window.confirm('Are you sure you want to clear all bindings, disconnect accounts and reset to Factory Defaults?')) return;
    try {
      setLoading(true);
      await axios.post('/api/factory-defaults');
      setIsRebooting(true);
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err: any) {
      setConfigMessage('Factory Reset failed.');
      setLoading(false);
    }
  };

  const startDevice = async (id: string) => {
    try {
      setLoading(true);
      await axios.post(`/api/devices/${id}/start`);
      await fetchData();
    } catch (err: any) {
      setError('Failed to start device.');
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await axios.get('/api/telemetry');
        setTelemetry(res.data);
      } catch (e) {
        console.error('Failed to fetch telemetry', e);
      }
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check URL params for connection status
    const urlParams = new URLSearchParams(window.location.search);

    const connectedParam = urlParams.get('connected');
    
    const checkStatus = async () => {
      try {
        const res = await axios.get('/api/miele/status');
        setIsMieleConnected(res.data.connected);
        if (res.data.connected) {
          setConfigMessage('Cloud Connected');
        } else {
          setConfigMessage('No Cloud Connected');
        }
      } catch (err) {
        console.error('Failed to check Miele status', err);
      }
    };

    if (connectedParam === 'true') {
      setIsMieleConnected(true);
      setConfigMessage('Cloud Connected');
      // Clean up URL
      window.history.replaceState({}, document.title, '/');
    } else if (connectedParam === 'false') {
      const errorParam = urlParams.get('error');
      setIsMieleConnected(false);
      setConfigMessage(`Cloud not Connected (${errorParam || 'Unknown Error'})`);
      window.history.replaceState({}, document.title, '/');
    } else {
      checkStatus();
    }

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [isMieleConnected, selectedDate]);


  const getDevicePowerAtTime = (device: any, time: Date): number => {
    if (!device) return 0;
    let totalPower = 0;

    // 1. Add live schedule curve
    const seq = powerSequences[device.id];
    const state = seq?.state || 'inactive';
    if (seq && seq.startTime && (state === 'scheduled' || state === 'running')) {
      const startMs = new Date(seq.startTime).getTime();
      const currentMs = time.getTime();
      
      if (currentMs >= startMs) {
        const slots = powerTimeSlots[device.id]?.slots || [];
        let currentOffsetMs = 0;
        for (const slot of slots) {
          const slotDurationMs = slot.durationMinutes * 60 * 1000;
          if (currentMs >= (startMs + currentOffsetMs) && currentMs < (startMs + currentOffsetMs + slotDurationMs)) {
            totalPower += slot.powerConsumptionW;
            break;
          }
          currentOffsetMs += slotDurationMs;
        }
      }
    }

    // 2. Add persistent executed runs
    const deviceRuns = executedRuns.filter(r => r.device_id === device.id);
    for (const run of deviceRuns) {
      const startMs = new Date(run.start_time).getTime();
      const currentMs = time.getTime();
      
      if (currentMs >= startMs) {
        const slots = Array.isArray(run.profile_slots) ? run.profile_slots : [];
        let currentOffsetMs = 0;
        for (const slot of slots) {
          const slotDurationMs = slot.durationMinutes * 60 * 1000;
          if (currentMs >= (startMs + currentOffsetMs) && currentMs < (startMs + currentOffsetMs + slotDurationMs)) {
            totalPower += slot.powerConsumptionW;
            break;
          }
          currentOffsetMs += slotDurationMs;
        }
      }
    }

    return totalPower;
  };


  // Chart Data

  // Expand Price to 15-minute chunks
  const expandedLabels: string[] = [];
  const expandedSolar: number[] = [];
  const expandedPrices: number[] = [];

  const washerPower: number[] = [];
  const dryerPower: number[] = [];
  const dishwasherPower: number[] = [];
  const eUpPower: number[] = [];


  const washerDevice = devices.find(d => d.name.toLowerCase().includes('washer') || d.name.toLowerCase().includes('waschmaschine'));
  const dryerDevice = devices.find(d => d.name.toLowerCase().includes('dryer') || d.name.toLowerCase().includes('trockner'));
  const dishwasherDevice = devices.find(d => d.name.toLowerCase().includes('dishwasher') || d.name.toLowerCase().includes('spülmaschine'));

  
  prices.forEach((p) => {
    const baseTime = new Date(p.timestamp);
    
    // Find hourly solar equivalent or neighboring slots
    const currentSolar = solar.find(s => new Date(s.timestamp).getHours() === baseTime.getHours())?.watt_hours || 0;
    
    // Get next hour for interpolation bounds safely
    const nextHour = (baseTime.getHours() + 1) % 24;
    const nextSolar = solar.find(s => new Date(s.timestamp).getHours() === nextHour)?.watt_hours || currentSolar;

    for (let chunk = 0; chunk < 4; chunk++) {
      const chunkTime = new Date(baseTime.getTime() + chunk * 15 * 60 * 1000);
      expandedLabels.push(chunkTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      expandedPrices.push(p.price + priceSurcharge);
 
      
      // Linear chunk interpolation
      const chunkVal = currentSolar + ((nextSolar - currentSolar) * (chunk / 4));
      expandedSolar.push(chunkVal);
 
      washerPower.push(getDevicePowerAtTime(washerDevice, chunkTime));
      dryerPower.push(getDevicePowerAtTime(dryerDevice, chunkTime));
      dishwasherPower.push(getDevicePowerAtTime(dishwasherDevice, chunkTime));

      // Live EV Charging Power
      const nowMs = Date.now();
      const chunkMs = chunkTime.getTime();
      const isCurrentOrFuture = chunkMs >= nowMs && chunkMs < (nowMs + 2 * 60 * 60 * 1000); // Show next 2 hours if charging
      eUpPower.push((isCurrentOrFuture && telemetry.eUpPower > 0) ? telemetry.eUpPower : 0);
    }
  });

  // Build live data aligned with the 15‑minute forecast grid
  const livePvData = new Array(expandedLabels.length).fill(null);
  const liveGridData = new Array(expandedLabels.length).fill(null);

  // Map each live point to its corresponding 15‑minute slot, aligned with expandedLabels
  const firstPriceHour = prices.length ? new Date(prices[0].timestamp).getHours() : 0;
  
  liveHistory.forEach((pt: any) => {
    const d = new Date(pt.timestamp);
    const hour = d.getHours();
    const minute = d.getMinutes();
    
    // Calculate index relative to the start of the chart (prices[0])
    let slotIdx = (hour - firstPriceHour) * 4 + Math.floor(minute / 15);
    
    // Handle wrap-around if needed (though usually we are within a 24-48h window)
    if (slotIdx < 0) slotIdx += 96; 

    if (slotIdx >= 0 && slotIdx < livePvData.length) {
      livePvData[slotIdx] = pt.pv_power_w;
      liveGridData[slotIdx] = pt.grid_power_w;
    }
  });

  const liveChartData = {
    labels: expandedLabels,
    datasets: [
      {
        label: 'PV Ertrag (W)',
        data: livePvData,
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251, 189, 36, 0.1)',
        tension: 0.4,
        fill: true,
        spanGaps: true // Connect the dots even if some slots are missing
      },
      {
        label: 'Netzstatus (W)',
        data: liveGridData,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.1)',
        tension: 0.4,
        fill: true,
        spanGaps: true
      }
    ]
  };

  const liveChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: '#f1f5f9' }
      }
    },
    scales: {
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8' }
      },
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94a3b8', maxTicksLimit: 96 }
      }
    }
  };



  const chartData = {
    labels: expandedLabels.length ? expandedLabels : ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
    datasets: [
      ...(visibleDatasets.includes('price') ? [{
        type: 'bar' as const,
        label: 'Electricity Price (Cent/kWh)',
        data: expandedPrices,
        borderColor: '#a78bfa',
        backgroundColor: 'rgba(167, 139, 250, 0.6)',
        borderWidth: 1,
        yAxisID: 'y',
      }] : []),
      ...(visibleDatasets.includes('pv') ? [{
        type: 'line' as const,
        label: 'PV Forecast (W)',
        data: expandedSolar.length ? expandedSolar : [0,0,0,0,0,0],
        borderColor: '#fbbf24',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        yAxisID: 'y1',
        pointRadius: 0,
        pointHitRadius: 10,
      }] : []),
      ...(visibleDatasets.includes('washer') ? [{
        type: 'bar' as const,
        label: 'Washer Forecast (W)',
        data: washerPower,
        borderColor: 'rgba(34, 197, 94, 0.8)',
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderWidth: 1,
        yAxisID: 'y1',
        stack: 'appliances',
      }] : []),
      ...(visibleDatasets.includes('dryer') ? [{
        type: 'bar' as const,
        label: 'Dryer Forecast (W)',
        data: dryerPower,
        borderColor: 'rgba(56, 189, 248, 0.8)',
        backgroundColor: 'rgba(56, 189, 248, 0.6)',
        borderWidth: 1,
        yAxisID: 'y1',
        stack: 'appliances',
      }] : []),
      ...(visibleDatasets.includes('dishwasher') ? [{
        type: 'bar' as const,
        label: 'Dishwasher Forecast (W)',
        data: dishwasherPower,
        borderColor: 'rgba(249, 115, 22, 0.8)',
        backgroundColor: 'rgba(249, 115, 22, 0.6)',
        borderWidth: 1,
        yAxisID: 'y1',
        stack: 'appliances',
      }] : []),
      ...(visibleDatasets.includes('eup') ? [{
        type: 'bar' as const,
        label: 'e-up! Charging (W)',
        data: eUpPower,
        borderColor: 'rgba(236, 72, 153, 0.8)',
        backgroundColor: 'rgba(236, 72, 153, 0.6)',
        borderWidth: 1,
        yAxisID: 'y1',
        stack: 'appliances',
      }] : [])
    ]
  };



  const ganttLayoutSync = {
    id: 'ganttLayoutSync',
    afterLayout: (chart: any) => {
      const left = chart.chartArea?.left || 0;
      const right = chart.width - (chart.chartArea?.right || chart.width);
      const ganttEl = document.getElementById('gantt-chart-container');
      if (ganttEl) {
        ganttEl.style.paddingLeft = `${left}px`;
        ganttEl.style.paddingRight = `${right}px`;
      }
    }
  };

  const currentTimeLine = {
    id: 'currentTimeLine',
    afterDraw: (chart: any) => {
      const ctx = chart.ctx;
      const xAxis = chart.scales.x;
      const yAxis = chart.scales.y;
      
      if (!prices.length) return;
      const now = new Date();
      const firstPriceTime = new Date(prices[0].timestamp);
      const elapsedMs = now.getTime() - firstPriceTime.getTime();
      const index = elapsedMs / (1000 * 60 * 15);
      const xPos = xAxis.left + (xAxis.width * (index / (expandedLabels.length || 96)));
      
      if (xPos < xAxis.left || xPos > xAxis.right) return;


      
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(xPos, yAxis.top);
      ctx.lineTo(xPos, yAxis.bottom);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ef4444'; 
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }
  };


  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    barPercentage: 0.95,
    categoryPercentage: 0.95,

    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,

        labels: { 
          color: '#0f172a',
          font: {
            weight: 'bold' as const,
            size: 13
          }
        }
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: 'Cent/kWh', color: '#38bdf8' },
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { color: '#94a3b8' }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: { display: true, text: 'Watt', color: '#fbbf24' },
        grid: { drawOnChartArea: false },
        ticks: { color: '#94a3b8' }
      },
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  return (
    <div className="app-container">
      {isRebooting && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#f1f5f9',
          gap: '1.5rem'
        }}>
          <div className="reboot-spinner" style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <h2 style={{ fontSize: '2rem', margin: 0, fontWeight: 700 }}>SunShift EMS Rebooting...</h2>
          <p style={{ fontSize: '1.1rem', color: '#94a3b8', margin: 0 }}>All services are clearing caches and restarting safely.</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      <header className="glass-header">
        <div className="logo-area">
          <Sun className="icon-sun" />
          <h1>SunShift <span>EMS</span></h1>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>

          <div className="mode-toggle" style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid rgba(0,0,0,0.1)' }}>
            <button 
              onClick={() => setViewMode('customer')} 
              style={{ 
                border: 'none', 
                background: viewMode === 'customer' ? 'white' : 'transparent', 
                padding: '0.5rem 1rem', 
                borderRadius: '0.375rem', 
                fontWeight: 600, 
                fontSize: '0.875rem',
                color: viewMode === 'customer' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: viewMode === 'customer' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Endkunde
            </button>
            <button 
              onClick={() => setViewMode('developer')} 
              style={{ 
                border: 'none', 
                background: viewMode === 'developer' ? 'white' : 'transparent', 
                padding: '0.5rem 1rem', 
                borderRadius: '0.375rem', 
                fontWeight: 600, 
                fontSize: '0.875rem',
                color: viewMode === 'developer' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                boxShadow: viewMode === 'developer' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              Developer
            </button>
          </div>
          <button 
            onClick={() => setShowHelp(true)} 
            className="btn-secondary" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '2.5rem', 
              padding: 0, 
              borderRadius: '50%' 
            }}
            title="Hilfe & Erklärung"
          >
            <HelpCircle size={20} />
          </button>
          <button onClick={() => setShowConfigure(!showConfigure)} className="btn-secondary">
            <Settings />
            Configure
          </button>
          <button onClick={triggerOptimize} disabled={loading} className="btn-primary">
            <RefreshCw className={`icon-spin ${loading ? 'spinning' : ''}`} />
            Optimize Now
          </button>
        </div>
      </header>

      {error && (
        <div className="alert-error">
          <AlertCircle />
          <p>{error}</p>
        </div>
      )}

      {showHelp && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-card landscape-help" style={{ width: '85vw', maxWidth: '1000px', height: '70vh', maxHeight: '600px', display: 'flex', background: 'rgba(255,255,255,0.98)', borderRadius: '1rem', overflow: 'hidden', color: '#0f172a', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative' }}>
            
            {/* Top Right Close Button */}
            <button 
              onClick={() => setShowHelp(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.05)', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 'bold', color: '#64748b' }}
            >
              ✕
            </button>

            <div className="help-nav" style={{ width: '30%', background: '#f8fafc', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRight: '1px solid rgba(148,163,184,0.2)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>SunShift Guide</h2>
              <button 
                onClick={() => setHelpSection('overview')} 
                style={{ border: 'none', background: helpSection === 'overview' ? 'white' : 'transparent', padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer', color: helpSection === 'overview' ? 'var(--accent-blue)' : '#64748b', boxShadow: helpSection === 'overview' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none', transition: '0.2s' }}
              >
                Overview
              </button>
              <button 
                onClick={() => setHelpSection('chart')} 
                style={{ border: 'none', background: helpSection === 'chart' ? 'white' : 'transparent', padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer', color: helpSection === 'chart' ? 'var(--accent-blue)' : '#64748b', boxShadow: helpSection === 'chart' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none', transition: '0.2s' }}
              >
                Energy & Prices
              </button>
              <button 
                onClick={() => setHelpSection('devices')} 
                style={{ border: 'none', background: helpSection === 'devices' ? 'white' : 'transparent', padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer', color: helpSection === 'devices' ? 'var(--accent-blue)' : '#64748b', boxShadow: helpSection === 'devices' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none', transition: '0.2s' }}
              >
                Device Management
              </button>
              <button 
                onClick={() => setHelpSection('developer')} 
                style={{ border: 'none', background: helpSection === 'developer' ? 'white' : 'transparent', padding: '0.75rem 1rem', borderRadius: '0.5rem', textAlign: 'left', fontWeight: 600, cursor: 'pointer', color: helpSection === 'developer' ? 'var(--accent-blue)' : '#64748b', boxShadow: helpSection === 'developer' ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none', transition: '0.2s' }}
              >
                Developer Tools
              </button>
            </div>

            <div className="help-content" style={{ width: '70%', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '1rem' }}>
                {helpSection === 'overview' && (
                  <>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Welcome to SunShift</h3>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#475569', marginBottom: '1rem' }}>
                      SunShift EMS orchestrates your household energy usage flexibly to minimize expenses and utilize solar generation efficiently.
                    </p>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#475569', marginBottom: '1.5rem' }}>
                      Your Miele devices utilize SPINE-IoT bindings to automatically schedule workloads intelligently.
                    </p>
                    <div style={{ border: '1px solid rgba(0,0,0,0.1)', borderRadius: '0.5rem', overflow: 'hidden', background: '#f8fafc', padding: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '0.25rem', textAlign: 'center' }}>System Interface Preview:</span>
                      <img src="/screenshot.png" alt="System Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '0.25rem' }} />
                    </div>
                  </>
                )}
                {helpSection === 'chart' && (
                  <>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Forecasts & Tariffs</h3>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#475569', marginBottom: '1rem' }}>
                      This graph aligns real-time Awattar spot-market trends (blue curves) against local PV predictions (yellow peaks).
                    </p>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#475569' }}>
                      Optimization targets schedule tasks when renewable generation peaks or prices drop significantly.
                    </p>
                  </>
                )}
                {helpSection === 'devices' && (
                  <>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Appliance Control</h3>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#475569', marginBottom: '1rem' }}>
                      Displays registered endpoints mapping individual operational lifecycle constraints perfectly.
                    </p>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#475569' }}>
                      Manual override options guarantee absolute command execution on priority requests.
                    </p>
                  </>
                )}
                {helpSection === 'developer' && (
                  <>
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Trace Infrastructure</h3>
                    <p style={{ fontSize: '0.95rem', lineHeight: '1.6', color: '#475569', marginBottom: '1rem' }}>
                      View low-level background state migrations tracking packet payloads comprehensively.
                    </p>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button onClick={() => setShowHelp(false)} className="btn-primary" style={{ background: '#0f172a', color: 'white' }}>
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {showConfigure && (
        <section className="glass-card configure-card">
          <h2>Connect Miele Appliances</h2>
          <div className="config-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              type="button" 
              onClick={handleMieleConnect} 
              disabled={loading} 
              className={`btn-primary ${isMieleConnected ? 'btn-danger' : ''}`}
            >
              {isMieleConnected ? 'Disconnect' : 'Connect Account'}
            </button>
            
            {isMieleConnected && (
              <button 
                type="button" 
                onClick={handleCopyToken} 
                disabled={loading} 
                className="btn-primary"
                style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)' }}
              >
                Copy Token
              </button>
            )}

            
            <button 
              type="button" 
              onClick={handleFactoryReset} 
              disabled={loading} 
              className="btn-primary"
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.4)' }}
            >
              Factory Defaults
            </button>

            {configMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {configMessage.includes('Connected') && !configMessage.includes('No') ? (
                  <Cloud style={{ color: '#4ade80', width: '20px', height: '20px' }} />
                ) : (
                  <CloudOff style={{ color: '#f87171', width: '20px', height: '20px' }} />
                )}
                <p className="config-message" style={{ margin: 0, color: configMessage.includes('Connected') && !configMessage.includes('No') ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                  {configMessage}
                </p>
              </div>
            )}
          </div>

          <div className="surcharge-config" style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#475569', marginBottom: '0.5rem' }}>Steuern & Umlagen (Cent/kWh):</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="number" 
                value={priceSurcharge || ''} 
                onChange={(e) => setPriceSurcharge(e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                style={{
                  background: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.95rem',
                  width: '120px',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                  fontWeight: 600
                }} 
                placeholder="0.00"
                step="0.1"
              />
            </div>
          </div>


          {isMieleConnected && spineDevices.length > 0 && (

            <div className="compact-device-list" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Found Appliances:</h3>
              {spineDevices.map(device => {
                let formattedValidity = device.validUntil;
                if (device.validUntil && device.validUntil !== 'Unlimited' && device.validUntil !== 'N/A') {
                  try {
                    const d = new Date(device.validUntil);
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const seconds = String(d.getSeconds()).padStart(2, '0');
                    formattedValidity = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
                  } catch (_) {}
                }

                return (
                  <div key={device.id} className="compact-device-row" style={{ 
                    padding: '0.5rem 1rem', 
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc', minWidth: '140px' }}>{device.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {device.id}</span>
                      {device.bindingId && (
                        <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>Binding-ID: {device.bindingId}</span>
                      )}
                      {device.subscriptionId && (
                        <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>Subscription-ID: {device.subscriptionId}</span>
                      )}
                      {device.validUntil && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Gültig: {formattedValidity}</span>
                      )}
                    </div>
                    <span style={{ 
                      color: '#4ade80', 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      letterSpacing: '0.05em'
                    }}>
                      CONNECTED
                    </span>
                  </div>
                );
              })}

            </div>
          )}
          
          {viewMode === 'developer' && apiLogs.length > 0 && (

            <div className="api-logs-list" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>API Activity Logs:</h3>
                <button 
                  type="button"
                  onClick={() => setIsLogsDetached(!isLogsDetached)} 
                  style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.4)', padding: '0.25rem 0.75rem', borderRadius: '0.25rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {isLogsDetached ? '📌 Attach Log' : '↗️ Detach Log'}
                </button>
              </div>
              
              {!isLogsDetached ? (
                <div style={{ maxHeight: '150px', overflowY: 'auto', background: '#0f172a', color: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  {apiLogs.map(log => (
                    <div key={log.id} style={{ marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <span style={{ color: '#60a5fa' }}>[{new Date(log.timestamp).toLocaleTimeString()}] </span>
                      <span style={{ color: '#34d399', fontWeight: 'bold' }}>{log.method} </span>
                      <span style={{ color: '#fbbf24' }}>{log.endpoint}</span>
                      <details style={{ marginTop: '0.25rem', color: '#94a3b8' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#38bdf8' }}>View Payload</summary>
                        <pre style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.75rem', background: '#1e293b', color: '#e2e8f0', padding: '0.5rem', borderRadius: '0.25rem' }}>
                          {log.response}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic', margin: '0.5rem 0' }}>
                  API Logs detached. Check floating panel in bottom corner.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      <main className="dashboard-grid">
        {/* Energy Dashboard (formerly Monitoring) */}
        <section className="glass-card monitoring-card" style={{ 
          gridColumn: '1 / -1', 
          marginBottom: '0',
          padding: isMonitoringExpanded ? '2rem' : '1.5rem 2rem'
        }}>
          <div 
            onClick={() => setIsMonitoringExpanded(!isMonitoringExpanded)}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Energy Dashboard</h2>
            
            {!isMonitoringExpanded && (
              <div style={{ 
                display: 'flex', 
                gap: '1.25rem', 
                alignItems: 'center',
                margin: '0 auto 0 2rem',
                animation: 'fadeIn 0.4s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sun size={16} style={{ color: '#fbbf24' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fbbf24' }}>{Math.round(telemetry.pvLeistung)}W</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Home size={16} style={{ color: '#38bdf8' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8' }}>{Math.round(telemetry.pvLeistung + telemetry.netzzustand)}W</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Zap size={16} style={{ color: telemetry.netzzustand < 0 ? '#4ade80' : '#f87171' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: telemetry.netzzustand < 0 ? '#4ade80' : '#f87171' }}>{Math.round(telemetry.netzzustand)}W</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Battery size={16} style={{ color: '#4ade80' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#4ade80' }}>{Math.round(telemetry.batteryLevel)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Car size={16} style={{ color: '#38bdf8' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#38bdf8' }}>{Math.round(telemetry.eUpPower)}W</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Fan size={16} style={{ color: '#f472b6' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f472b6' }}>{Math.round(telemetry.heatPumpPower)}W</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <BatteryCharging size={16} style={{ color: '#fbbf24' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fbbf24', textTransform: 'uppercase' }}>
                    {isNaN(parseFloat(telemetry.batteryState)) ? telemetry.batteryState : `${Math.round(parseFloat(telemetry.batteryState))}W`}
                  </span>
                </div>
              </div>
            )}

            {isMonitoringExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </div>

          {isMonitoringExpanded && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-around', 
                marginTop: '1.5rem',
                padding: '1.5rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '1rem',
                border: '1px solid rgba(255,255,255,0.05)',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                  <Sun style={{ color: '#fbbf24', width: 32, height: 32 }} />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>PV ERTRAG</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{Math.round(telemetry.pvLeistung)} W</span>
                </div>
                
                <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.1)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                  <Home style={{ color: '#38bdf8', width: 32, height: 32 }} />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>HAUSVERBRAUCH</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{Math.round(telemetry.pvLeistung + telemetry.netzzustand)} W</span>
                </div>

                <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.1)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                  <Zap style={{ color: telemetry.netzzustand < 0 ? '#4ade80' : '#f87171', width: 32, height: 32 }} />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>NETZSTATUS</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: telemetry.netzzustand < 0 ? '#4ade80' : '#f87171' }}>{Math.round(telemetry.netzzustand)} W</span>
                </div>

                <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.1)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                  <Car style={{ color: '#38bdf8', width: 32, height: 32 }} />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>E-AUTO</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{Math.round(telemetry.eUpPower)} W</span>
                </div>

                <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.1)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '100px' }}>
                  <Fan style={{ color: '#f472b6', width: 32, height: 32 }} />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>WÄRMEPUMPE</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f472b6' }}>{Math.round(telemetry.heatPumpPower)} W</span>
                </div>
              </div>

              <div style={{ 
                marginTop: '1.5rem', 
                paddingTop: '1.5rem', 
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-around'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <Battery style={{ color: '#4ade80', width: 32, height: 32 }} />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>BATTERY LEVEL</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4ade80' }}>{Math.round(telemetry.batteryLevel)}%</span>
                </div>

                <div style={{ width: '1px', height: '50px', background: 'rgba(255,255,255,0.1)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <BatteryCharging style={{ color: '#fbbf24', width: 32, height: 32 }} />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.05em' }}>BATTERY POWER</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                    {isNaN(parseFloat(telemetry.batteryState)) ? telemetry.batteryState : `${Math.round(parseFloat(telemetry.batteryState))} W`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Chart Section */}
        <section className="glass-card chart-card" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>
              {viewType === 'forecast' ? 'Energy & Price Forecast' : 'Live Power Analytics'} for {selectedDate ? new Date(selectedDate).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')} {lastUpdated && `(last Update: ${lastUpdated})`}
            </h2>
            
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '2rem', padding: '2px' }}>
              <button 
                onClick={() => setViewType('forecast')}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '2rem',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewType === 'forecast' ? '#fbbf24' : 'transparent',
                  color: viewType === 'forecast' ? '#0f172a' : '#94a3b8',
                  transition: 'all 0.2s ease'
                }}
              >
                Forecast
              </button>
              <button 
                onClick={() => setViewType('live')}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '2rem',
                  border: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: viewType === 'live' ? '#38bdf8' : 'transparent',
                  color: viewType === 'live' ? '#0f172a' : '#94a3b8',
                  transition: 'all 0.2s ease'
                }}
              >
                Live
              </button>
            </div>
          </div>

          
          <div className="chart-filter-selector" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', justifyContent: 'center' }}>
            {[
              { id: 'price', label: 'Electricity Price', color: '#a78bfa' },
              { id: 'pv', label: 'PV Forecast', color: '#fbbf24' },
              { id: 'washer', label: 'Washer Forecast', color: 'rgba(34, 197, 94, 0.8)' },
              { id: 'dryer', label: 'Dryer Forecast', color: 'rgba(56, 189, 248, 0.8)' },
              { id: 'dishwasher', label: 'Dishwasher Forecast', color: 'rgba(249, 115, 22, 0.8)' },
              { id: 'eup', label: 'e-up! Charging', color: 'rgba(236, 72, 153, 0.8)' }

            ].map(filter => {
              const isActive = visibleDatasets.includes(filter.id);
              return (
                <button
                  key={filter.id}
                  onClick={() => {
                    if (isActive) {
                      setVisibleDatasets(visibleDatasets.filter(x => x !== filter.id));
                    } else {
                      setVisibleDatasets([...visibleDatasets, filter.id]);
                    }
                  }}
                  style={{
                    background: isActive ? filter.color : 'rgba(255,255,255,0.05)',
                    color: isActive ? '#0f172a' : '#94a3b8',
                    border: `1px solid ${filter.color}`,
                    padding: '0.4rem 1rem',
                    borderRadius: '2rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: isActive ? '#0f172a' : filter.color }} />
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="chart-wrapper">
            {viewType === 'forecast' ? (
              <Bar ref={chartRef} data={chartData as any} options={chartOptions} plugins={[ganttLayoutSync, currentTimeLine]} />
            ) : (
              <Line data={liveChartData as any} options={liveChartOptions as any} plugins={[currentTimeLine]} />
            )}
          </div>


          {/* Gantt Chart Schedules directly aligned under graph */}

          <GanttTimeline 
            devices={devices}
            prices={prices}
            powerSequences={powerSequences}
            powerTimeSlots={powerTimeSlots}
          />

            {/* Date Pagination Footer */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '1.5rem', 
              marginTop: '2rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '1.5rem'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1.5rem', 
                background: '#1e293b', 
                padding: '0.5rem 1.5rem', 
                borderRadius: '2rem', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.1)' 
              }}>
                <button 
                  onClick={() => handleDateChange(-1)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    transition: 'all 0.2s ease'
                  }}
                  title="Tag zurück"
                >
                  &lt;
                </button>
                
                <span style={{ 
                  fontSize: '1rem', 
                  fontWeight: 700, 
                  color: '#ffffff',
                  letterSpacing: '0.05em'
                }}>
                  {selectedDate ? new Date(selectedDate).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'}) : 'Tagesdaten'}
                </span>

                <button 
                  onClick={() => handleDateChange(1)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    transition: 'all 0.2s ease'
                  }}
                  title="Tag vorwärts"
                >
                  &gt;
                </button>
              </div>
            </div>
        </section>


        {/* Spine Devices Section */}
        {viewMode === 'developer' && (
          <section className="glass-card spine-card">
          <h2>Spine-IoT Devices (EEBUS)</h2>
          <div className="device-list">
            {spineDevices.map(device => (
              <div key={device.id} className="device-item">
                <div className="device-info">
                  <Cpu className="device-icon" style={{color: '#4ade80'}} />
                  <div>
                    <h3>{device.name}</h3>
                    <p>Protocol: {device.protocol}</p>
                  </div>
                </div>
                <div className="device-actions">
                  <span className="status-badge ready">
                    {device.powerConsumptionW} W
                  </span>
                  <button onClick={() => startDevice(device.id)} disabled={loading} className="btn-mini">
                    Start
                  </button>
                </div>
              </div>
            ))}
            {spineDevices.length === 0 && (
              <p className="empty-text">No Spine devices found. Please Connect Account.</p>
            )}
          </div>
        </section>
        )}

        {/* Miele Devices Section */}
        <section className="glass-card devices-card">
          <h2>Cloud Devices (Miele)</h2>
          <div className="device-list">
            {devices.map(device => {
              const seq = powerSequences[device.id];
              const state = seq?.state || 'inactive';
              
              let cardOpacity = 1;
              let cardBorder = '1px solid var(--glass-border)';
              let badgeBg = '#64748b';
              
              if (state === 'inactive') {
                cardOpacity = 0.5;
              } else if (state === 'scheduled') {
                cardBorder = '1px solid rgba(34, 197, 94, 0.4)';
                badgeBg = '#22c55e';
              } else if (state === 'running') {
                cardBorder = '1px solid rgba(56, 189, 248, 0.4)';
                badgeBg = '#38bdf8';
              } else if (state === 'completed') {
                cardBorder = '1px solid rgba(168, 85, 247, 0.4)';
                badgeBg = '#a855f7';
              }

              let remainingMin = 0;
              if (state === 'running' && seq?.endTime) {
                remainingMin = Math.max(0, Math.round((new Date(seq.endTime).getTime() - Date.now()) / 60000));
              }

              let calculatedDuration = device.programDurationMinutes;
              if (seq?.startTime && seq?.endTime) {
                calculatedDuration = Math.round((new Date(seq.endTime).getTime() - new Date(seq.startTime).getTime()) / 60000);
              }

              return (
                <div key={device.id} className="device-item" style={{ opacity: cardOpacity, border: cardBorder, transition: 'all 0.3s ease' }}>
                  <div className="device-info">
                    <Cpu className="device-icon" style={{ color: badgeBg }} />
                    <div>
                      <h3>{device.name}</h3>
                      {state === 'running' && (
                        <p style={{ color: '#38bdf8', fontWeight: 600, margin: 0 }}>Remaining: {remainingMin} min</p>
                      )}
                      {state !== 'inactive' && state !== 'running' && (
                        <p style={{ margin: 0 }}>Duration: {calculatedDuration} min</p>
                      )}
                      {state !== 'inactive' && seq && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          {state === 'scheduled' && seq.earliestStartTime && (
                            <>
                              <span>Flexibility: {new Date(seq.earliestStartTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} - {new Date(seq.latestEndTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</span>
                              <span>Execution: {new Date(seq.startTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} - {new Date(seq.endTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="device-actions">
                    <span className="status-badge" style={{ background: badgeBg }}>
                      {state.toUpperCase()}
                    </span>
                  {state === 'scheduled' && (
                    <button 
                      onClick={() => startDevice(device.id)} 
                      disabled={loading} 
                      className="btn-mini"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            );
          })}
            {devices.length === 0 && <p className="empty-text">No cloud devices found.</p>}
          </div>
        </section>

      </main>

      <footer className="glass-footer">
        <p>&copy; 2026 SunShift EMS | Smart Energy. Perfect Timing. | {import.meta.env.VITE_APP_VERSION || `v${packageJson.version}`}</p>

      </footer>
      <FloatingPanels 
        isLogsDetached={isLogsDetached}
        setIsLogsDetached={setIsLogsDetached}
        apiLogs={apiLogs}
        callbackLogs={callbackLogs}
        tickerPos={tickerPos}
        setTickerDragging={setTickerDragging}
        setTickerRel={setTickerRel}
        callbackPos={callbackPos}
        setCallbackDragging={setCallbackDragging}
        setCallbackRel={setCallbackRel}
        logPos={logPos}
        setDragging={setDragging}
        setRel={setRel}
      />


    </div>
  );
}

export default App;
