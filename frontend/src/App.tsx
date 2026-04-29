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
  Zap
} from 'lucide-react';

import { Chart as ChartJS, registerables } from 'chart.js';
import { Bar } from 'react-chartjs-2';

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

  const [telemetry, setTelemetry] = useState({ pvLeistung: 0, netzzustand: 0, eUpPower: 0 });



  const [priceSurcharge, setPriceSurcharge] = useState<number>(() => {
    const saved = localStorage.getItem('sunshift_price_surcharge');
    return saved ? parseFloat(saved) : 0;
  });
  
  useEffect(() => {
    localStorage.setItem('sunshift_price_surcharge', priceSurcharge.toString());
  }, [priceSurcharge]);

  const [visibleDatasets, setVisibleDatasets] = useState<string[]>(['price', 'pv', 'washer', 'dryer', 'dishwasher', 'eup']);



  const chartRef = useRef<any>(null);


  const [apiLogs, setApiLogs] = useState<any[]>([]);
  const [isLogsDetached, setIsLogsDetached] = useState(false);
  const [viewMode, setViewMode] = useState<'customer' | 'developer'>('developer');
  const [showHelp, setShowHelp] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [tickerPos, setTickerPos] = useState({ x: 50, y: window.innerHeight - 550 });
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

  const [logPos, setLogPos] = useState({ x: window.innerWidth - 450, y: window.innerHeight - 550 });
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
  const [helpSection, setHelpSection] = useState<'overview' | 'chart' | 'devices' | 'developer'>('overview');

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/dashboard');
      setPrices(response.data.prices);
      setSolar(response.data.solar);
      setDevices(response.data.devices);
      
      setPowerSequences({});
      setPowerTimeSlots({});


      try {
        const runsRes = await axios.get('/api/executed-runs');
        setExecutedRuns(runsRes.data);
      } catch (runErr) {}


      
      // Fetch Spine Devices only if connected
      if (isMieleConnected) {
        const spineRes = await axios.get('/api/spine/devices');
        setSpineDevices(spineRes.data);

        const logsRes = await axios.get('/api/miele/logs');
        setApiLogs(logsRes.data);
      } else {
        setSpineDevices([]);
        setApiLogs([]);
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
  }, [isMieleConnected]);

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
      const xPos = xAxis.left + (xAxis.width * (index / 96));
      
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

        {/* Option 1: Dynamic Power Flow Widget */}
        <div className="power-flow-widget" style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1.5rem', borderRadius: '2rem', border: '1px solid rgba(255,255,255,0.1)', margin: '0 auto 0 2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Sun style={{ color: '#fbbf24', width: 20, height: 20 }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#fbbf24' }}>{telemetry.pvLeistung} W</span>
          </div>
          <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.2)', position: 'relative' }}>
            <div style={{ position: 'absolute', width: 6, height: 6, background: '#fbbf24', borderRadius: '50%', top: -2, left: '50%', transform: 'translateX(-50%)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Home style={{ color: '#38bdf8', width: 20, height: 20 }} />
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Haus</span>
          </div>
          <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.2)', position: 'relative' }}>
            <div style={{ position: 'absolute', width: 6, height: 6, background: '#38bdf8', borderRadius: '50%', top: -2, left: '50%', transform: 'translateX(-50%)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Zap style={{ color: telemetry.netzzustand < 0 ? '#4ade80' : '#f87171', width: 20, height: 20 }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: telemetry.netzzustand < 0 ? '#4ade80' : '#f87171' }}>{telemetry.netzzustand} W</span>
          </div>
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
                  <div key={device.id} className="compact-device-card" style={{ 
                    background: 'rgba(30, 41, 59, 0.4)', 
                    backdropFilter: 'blur(12px)',
                    padding: '1.25rem', 
                    borderRadius: '1rem', 
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    marginBottom: '0.75rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
                  }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '1.1rem', color: '#f8fafc', letterSpacing: '-0.01em' }}>{device.name}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', padding: '0.2rem 0.5rem', borderRadius: '0.25rem' }}>ID: {device.id}</span>
                        {device.bindingId && (
                          <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>🔗 {device.bindingId}</span>
                        )}
                        {device.subscriptionId && (
                          <span style={{ fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontFamily: 'monospace' }}>📝 {device.subscriptionId}</span>
                        )}
                      </div>

                      {device.validUntil && (
                        <span style={{ fontSize: '0.75rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                          ⏳ Gültig bis: {formattedValidity}
                        </span>
                      )}
                    </div>
                    <span style={{ 
                      background: 'rgba(74, 222, 128, 0.15)', 
                      color: '#4ade80', 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      padding: '0.35rem 0.75rem', 
                      borderRadius: '2rem',
                      letterSpacing: '0.05em',
                      border: '1px solid rgba(74, 222, 128, 0.3)',
                      boxShadow: '0 0 12px rgba(74, 222, 128, 0.2)'
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
        {/* Chart Section */}

        <section className="glass-card chart-card">
          <h2>Energy & Price Forecast for {prices.length ? new Date(prices[0].timestamp).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'}) : new Date().toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})} {lastUpdated && `(last Update: ${lastUpdated})`}</h2>
          
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
            <Bar ref={chartRef} data={chartData as any} options={chartOptions} plugins={[ganttLayoutSync, currentTimeLine]} />

          </div>

          {/* Gantt Chart Schedules directly aligned under graph */}

          <div id="gantt-chart-container" className="gantt-chart" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxSizing: 'border-box' }}>

            {devices.map((device) => {
              const firstPriceTime = prices.length ? new Date(prices[0].timestamp).getTime() : Date.now();
              const totalSpan = 24 * 60 * 60 * 1000;

              const seq = powerSequences[device.id];
              const isScheduledOrRunning = seq && (seq.state === 'scheduled' || seq.state === 'running');

              const earliestTime = seq && seq.earliestStartTime ? new Date(seq.earliestStartTime).getTime() : firstPriceTime; 
              const latestTime = seq && seq.latestEndTime ? new Date(seq.latestEndTime).getTime() : (firstPriceTime + totalSpan);
              const startTime = seq && seq.startTime ? new Date(seq.startTime).getTime() : earliestTime;
              const endTime = seq && seq.endTime ? new Date(seq.endTime).getTime() : earliestTime;

              const deviceSlots = powerTimeSlots[device.id]?.slots || [];
              const totalMins = deviceSlots.reduce((acc: number, s: any) => acc + s.durationMinutes, 0) || 1;
              const maxW = Math.max(...deviceSlots.map((s: any) => s.powerConsumptionW), 1);

              // Calculate Percentages

              const flexLeft = Math.max(0, Math.min(100, ((earliestTime - firstPriceTime) / totalSpan) * 100));
              const flexWidth = Math.max(0, Math.min(100 - flexLeft, ((latestTime - earliestTime) / totalSpan) * 100));

              const activeLeft = Math.max(0, Math.min(100, ((startTime - firstPriceTime) / totalSpan) * 100));
              const activeWidth = Math.max(0, Math.min(100 - activeLeft, ((endTime - startTime) / totalSpan) * 100));

              // Colors
              let colorBase = 'rgba(34, 197, 94, 0.2)';
              let colorBorder = 'rgba(34, 197, 94, 0.6)';
              let colorActive = 'rgba(34, 197, 94, 0.8)';
              
              if (device.type === 'Dryer') {
                colorBase = 'rgba(56, 189, 248, 0.2)';
                colorBorder = 'rgba(56, 189, 248, 0.6)';
                colorActive = 'rgba(56, 189, 248, 0.8)';
              } else if (device.type === 'Dishwasher') {
                colorBase = 'rgba(249, 115, 22, 0.2)';
                colorBorder = 'rgba(249, 115, 22, 0.6)';
                colorActive = 'rgba(249, 115, 22, 0.8)';
              }

              return (
                <div key={device.id} className="gantt-row" style={{ display: 'flex', alignItems: 'center', position: 'relative', height: '1.5rem' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'rgba(148, 163, 184, 0.2)', top: '50%', transform: 'translateY(-50%)' }}></div>
                  <div style={{ position: 'relative', width: '100%', height: '1rem' }}>
                    {/* Earliest to Latest bar */}
                    {isScheduledOrRunning && seq?.earliestStartTime && (
                      <>
                        <div className="tooltip-trigger" style={{ position: 'absolute', left: `${flexLeft}%`, width: `${flexWidth}%`, height: '100%', background: colorBase, borderRadius: '0.125rem', border: `1px solid ${colorBorder}`, cursor: 'pointer' }}>
                          <div className="gantt-tooltip">
                            <div style={{ fontWeight: 'bold', color: '#38bdf8', marginBottom: '0.25rem' }}>{device.name} Flexibility</div>
                            <div>Earliest: {new Date(seq.earliestStartTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</div>
                            <div>Latest: {new Date(seq.latestEndTime).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})}</div>
                          </div>
                        </div>
                        {/* Start to End bar with custom Power Profile tooltip */}
                        {seq.startTime && (
                          <div className="tooltip-trigger" style={{ position: 'absolute', left: `${activeLeft}%`, width: `${activeWidth}%`, height: '100%', background: colorActive, borderRadius: '0.125rem', cursor: 'pointer' }}>
                            <div className="gantt-tooltip" style={{ minWidth: '400px', padding: '1.5rem' }}>
                              <div style={{ fontWeight: 'bold', color: '#fbbf24', marginBottom: '0.75rem', fontSize: '1rem' }}>{device.name} Power Profile</div>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '120px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: '0.5rem' }}>

                                {deviceSlots.map((slot: any, idx: number) => {
                                  const heightPercent = Math.max(10, (slot.powerConsumptionW / maxW) * 100);
                                  const widthPercent = (slot.durationMinutes / totalMins) * 100;
                                  return (
                                    <div 
                                      key={idx} 
                                      style={{ 
                                        width: `${widthPercent}%`, 
                                        height: `${heightPercent}%`, 
                                        background: '#fbbf24', 
                                        borderRadius: '2px 2px 0 0' 
                                      }} 
                                      title={`${slot.powerConsumptionW}W`}
                                    />
                                  );
                                })}

                            </div>


                              <div style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                                <span>0 min</span>
                                <span>Peak: {powerTimeSlots[device.id]?.slots ? Math.max(...powerTimeSlots[device.id].slots.map((s: any) => s.powerConsumptionW)) : 0}W</span>
                                <span>{device.programDurationMinutes}m</span>
                              </div>
                            </div>
                          </div>
                        )}

                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Legend */}
            <div className="gantt-legend" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              {devices.map(device => {
                let colorActive = 'rgba(34, 197, 94, 0.8)';
                if (device.type === 'Dryer') colorActive = 'rgba(56, 189, 248, 0.8)';
                if (device.type === 'Dishwasher') colorActive = 'rgba(249, 115, 22, 0.8)';

                return (
                  <div key={`legend-${device.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: colorActive, padding: '0.25rem 0.75rem', borderRadius: '0.25rem', color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
                    {device.name}
                  </div>
                );
              })}
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
        <p>&copy; 2026 SunShift EMS | Smart Energy. Perfect Timing. | v{packageJson.version}</p>

      </footer>
      {isLogsDetached && (

        <>
          {/* System Ticker Window */}
          <div 
            style={{ 
              position: 'fixed', 
              left: `${tickerPos.x}px`, 
              top: `${tickerPos.y}px`, 
              width: '450px', 
              height: '500px',
              minWidth: '300px',
              minHeight: '200px',
              background: 'rgba(15, 23, 42, 0.95)', 
              backdropFilter: 'blur(12px)', 
              color: '#f1f5f9', 
              border: '1px solid rgba(168, 85, 247, 0.3)', 
              borderRadius: '0.75rem', 
              padding: '1rem', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
              zIndex: 9999, 
              display: 'flex', 
              flexDirection: 'column',
              resize: 'both',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingBottom: '0.75rem', 
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                cursor: 'move',
                userSelect: 'none'
              }}
              onMouseDown={(e) => {
                setTickerDragging(true);
                setTickerRel({
                  x: e.clientX - tickerPos.x,
                  y: e.clientY - tickerPos.y
                });
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#a855f7', borderRadius: '50%', display: 'inline-block' }}></span>
                <h3 style={{ fontSize: '1rem', color: '#f1f5f9', margin: 0 }}>System Ticker Narrative</h3>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0', fontFamily: 'sans-serif', fontSize: '0.85rem' }}>
              {apiLogs.filter(log => log.method === 'STORY').map(log => {
                let displayContent = log.response;
                try {
                  const parsed = JSON.parse(log.response);
                  if (typeof parsed === 'string') displayContent = parsed;
                } catch (_) {}

                return (
                  <div key={log.id} style={{ 
                    marginBottom: '0.75rem', 
                    padding: '0.75rem', 
                    background: 'rgba(168, 85, 247, 0.12)', 
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(168, 85, 247, 0.25)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a855f7', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      <span>✨ {log.endpoint}</span>
                      <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#f1f5f9', margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {displayContent}
                    </pre>
                  </div>
                );
              })}
              {apiLogs.filter(log => log.method === 'STORY').length === 0 && (
                <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Warte auf System-Ereignisse...</p>
              )}
            </div>
          </div>

          {/* Callback Log Window */}
          <div 
            style={{ 
              position: 'fixed', 
              left: `${logPos.x}px`, 
              top: `${logPos.y}px`, 
              width: '400px', 
              height: '500px',
              background: 'rgba(15, 23, 42, 0.95)', 
              backdropFilter: 'blur(12px)', 
              color: '#f1f5f9', 
              border: '1px solid rgba(34, 197, 94, 0.3)', 
              borderRadius: '0.75rem', 
              padding: '1rem', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
              zIndex: 9997, 
              display: 'flex', 
              flexDirection: 'column',
              resize: 'both',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingBottom: '0.75rem', 
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                cursor: 'move',
                userSelect: 'none'
              }}
              onMouseDown={(e) => {
                setDragging(true);
                setRel({
                  x: e.clientX - logPos.x,
                  y: e.clientY - logPos.y
                });
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
                <h3 style={{ fontSize: '1rem', color: '#f1f5f9', margin: 0 }}>SPINE Webhook Callbacks</h3>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {apiLogs.filter(log => log.endpoint === '/api/spine/callback').map(log => {
                let payloadStr = log.response;
                try {
                  if (typeof log.response !== 'string') {
                    payloadStr = JSON.stringify(log.response, null, 2);
                  }
                } catch (_) {}

                return (
                  <div key={log.id} style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22c55e', fontWeight: 'bold', fontSize: '0.75rem' }}>
                      <span>📥 Webhook Received</span>
                      <span style={{ color: '#64748b' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <pre style={{ whiteSpace: 'pre-wrap', color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                      {payloadStr}
                    </pre>
                  </div>
                );
              })}
              {apiLogs.filter(log => log.endpoint === '/api/spine/callback').length === 0 && (
                <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Warte auf SPINE Callbacks...</p>
              )}
            </div>
          </div>

          {/* API Activity Window */}
          <div 
            style={{ 

              position: 'fixed', 
              left: `${logPos.x}px`, 
              top: `${logPos.y}px`, 
              width: '400px', 
              height: '500px',
              minWidth: '250px',
              minHeight: '200px',
              background: 'rgba(15, 23, 42, 0.95)', 
              backdropFilter: 'blur(12px)', 
              color: '#f1f5f9', 
              border: '1px solid rgba(56, 189, 248, 0.3)', 
              borderRadius: '0.75rem', 
              padding: '1rem', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
              zIndex: 9998, 
              display: 'flex', 
              flexDirection: 'column',
              resize: 'both',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                paddingBottom: '0.75rem', 
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                cursor: 'move',
                userSelect: 'none'
              }}
              onMouseDown={(e) => {
                setDragging(true);
                setRel({
                  x: e.clientX - logPos.x,
                  y: e.clientY - logPos.y
                });
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '50%', display: 'inline-block' }}></span>
                <h3 style={{ fontSize: '1rem', color: '#f1f5f9', margin: 0 }}>Live API Activity</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsLogsDetached(false)}
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0', fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {apiLogs.filter(log => log.method !== 'STORY').map(log => {
                let displayContent = log.response;
                try {
                  const parsed = JSON.parse(log.response);
                  if (typeof parsed === 'string') displayContent = parsed;
                  else displayContent = JSON.stringify(parsed, null, 2);
                } catch (_) {}

                return (
                  <div key={log.id} style={{ 
                    marginBottom: '0.5rem', 
                    paddingBottom: '0.5rem', 
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <span style={{ color: '#60a5fa' }}>[{new Date(log.timestamp).toLocaleTimeString()}] </span>
                    <span style={{ color: '#34d399', fontWeight: 'bold' }}>{log.method} </span>
                    <span style={{ color: '#fbbf24' }}>{log.endpoint}</span>
                    <details style={{ marginTop: '0.25rem', color: '#94a3b8' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#38bdf8' }}>Payload</summary>
                      <pre style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.75rem', background: '#1e293b', color: '#e2e8f0', padding: '0.5rem', borderRadius: '0.25rem' }}>
                        {displayContent}
                      </pre>
                    </details>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
