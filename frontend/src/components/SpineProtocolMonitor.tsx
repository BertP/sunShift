import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface ProtocolEntry {
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

interface SpineProtocolMonitorProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; border: string; accent: string; label: string }> = {
  binding:      { bg: 'rgba(251, 191, 36, 0.08)',  border: 'rgba(251, 191, 36, 0.35)', accent: '#fbbf24', label: 'BINDING' },
  subscription: { bg: 'rgba(167, 139, 250, 0.08)', border: 'rgba(167, 139, 250, 0.35)', accent: '#a78bfa', label: 'SUBSCRIPTION' },
  callback:     { bg: 'rgba(34, 197, 94, 0.08)',   border: 'rgba(34, 197, 94, 0.35)',  accent: '#22c55e', label: 'WEBHOOK PUSH' },
  command:      { bg: 'rgba(248, 113, 113, 0.08)', border: 'rgba(248, 113, 113, 0.35)', accent: '#f87171', label: 'COMMAND' },
  query:        { bg: 'rgba(56, 189, 248, 0.08)',  border: 'rgba(56, 189, 248, 0.35)', accent: '#38bdf8', label: 'QUERY' },
  auth:         { bg: 'rgba(251, 146, 60, 0.08)',  border: 'rgba(251, 146, 60, 0.35)', accent: '#fb923c', label: 'AUTH' },
  system:       { bg: 'rgba(148, 163, 184, 0.08)', border: 'rgba(148, 163, 184, 0.35)', accent: '#94a3b8', label: 'SYSTEM' },
  other:        { bg: 'rgba(148, 163, 184, 0.06)', border: 'rgba(148, 163, 184, 0.2)',  accent: '#64748b', label: 'OTHER' },
};

const DIRECTION_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  OUT:    { icon: '⬆', color: '#38bdf8', label: 'OUT → Miele Cloud' },
  IN:     { icon: '⬇', color: '#4ade80', label: 'IN ← Miele Cloud' },
  SYSTEM: { icon: '⚙', color: '#a78bfa', label: 'SYSTEM' },
};

function JsonViewer({ data, label }: { data: any; label: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (data === null || data === undefined) return null;

  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(str).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ marginTop: '0.4rem' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748b', fontSize: '0.72rem', padding: '0',
          display: 'flex', alignItems: 'center', gap: '0.3rem'
        }}
      >
        <span style={{ color: open ? '#38bdf8' : '#475569', transition: 'transform 0.15s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span style={{ color: '#64748b' }}>{label}</span>
      </button>
      {open && (
        <div style={{ position: 'relative', marginTop: '0.35rem' }}>
          <pre style={{
            background: '#0a1628',
            color: '#e2e8f0',
            borderRadius: '0.4rem',
            padding: '0.6rem 2.5rem 0.6rem 0.6rem',
            fontSize: '0.72rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            margin: 0,
            maxHeight: '200px',
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.07)',
          }}>
            {str}
          </pre>
          <button
            onClick={handleCopy}
            title="Copy JSON"
            style={{
              position: 'absolute', top: '0.3rem', right: '0.3rem',
              background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(56,189,248,0.15)',
              border: 'none', borderRadius: '0.25rem', cursor: 'pointer',
              color: copied ? '#22c55e' : '#38bdf8', fontSize: '0.65rem',
              padding: '0.15rem 0.35rem', transition: 'all 0.2s'
            }}
          >
            {copied ? '✓' : '⎘'}
          </button>
        </div>
      )}
    </div>
  );
}

function ProtocolEntryCard({ entry, isNew }: { entry: ProtocolEntry; isNew: boolean }) {
  const cat = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other;
  const dir = DIRECTION_ICONS[entry.direction] || DIRECTION_ICONS.IN;
  const isError = entry.errorMessage || (entry.statusCode && entry.statusCode >= 400);

  return (
    <div
      style={{
        background: isError ? 'rgba(239, 68, 68, 0.07)' : cat.bg,
        border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : cat.border}`,
        borderLeft: `3px solid ${isError ? '#ef4444' : cat.accent}`,
        borderRadius: '0.45rem',
        padding: '0.55rem 0.7rem',
        marginBottom: '0.45rem',
        animation: isNew ? 'pulseNew 1s ease-out' : 'none',
        transition: 'opacity 0.3s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '1rem', lineHeight: 1, color: dir.color,
          filter: `drop-shadow(0 0 4px ${dir.color}66)`
        }}>
          {dir.icon}
        </span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
          background: `${cat.accent}22`, color: cat.accent,
          padding: '0.1rem 0.4rem', borderRadius: '3px',
        }}>
          {cat.label}
        </span>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
          {entry.method}
        </span>
        <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.endpoint}
        </span>
        {entry.statusCode && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            color: entry.statusCode < 300 ? '#4ade80' : entry.statusCode < 400 ? '#fbbf24' : '#f87171',
            padding: '0.1rem 0.3rem', borderRadius: '3px',
            background: entry.statusCode < 300 ? 'rgba(74,222,128,0.1)' : entry.statusCode < 400 ? 'rgba(251,191,36,0.1)' : 'rgba(248,113,113,0.1)',
          }}>
            {entry.statusCode}
          </span>
        )}
        <span style={{ fontSize: '0.63rem', color: '#475569', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
          {(() => {
            const d = new Date(entry.timestamp);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            const ms = String(d.getMilliseconds()).padStart(3, '0');
            return `${hh}:${mm}:${ss}.${ms}`;
          })()}
        </span>
      </div>

      {(entry.deviceId || entry.featureType) && (
        <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {entry.deviceId && (
            <span style={{ fontSize: '0.67rem', color: '#64748b', fontFamily: 'monospace' }}>
              📟 <span style={{ color: '#94a3b8' }}>{entry.deviceId}</span>
            </span>
          )}
          {entry.featureType && (
            <span style={{ fontSize: '0.67rem', color: '#64748b' }}>
              ✦ <span style={{ color: cat.accent }}>{entry.featureType}</span>
            </span>
          )}
        </div>
      )}

      {entry.errorMessage && (
        <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: '#fca5a5', fontFamily: 'monospace', background: 'rgba(239,68,68,0.08)', padding: '0.3rem 0.5rem', borderRadius: '0.25rem' }}>
          ✗ {entry.errorMessage}
        </div>
      )}

      <JsonViewer data={entry.requestPayload} label="Request Payload" />
      <JsonViewer data={entry.responsePayload} label="Response Payload" />
    </div>
  );
}

const ALL_DIRECTIONS = ['OUT', 'IN', 'SYSTEM'];

export const SpineProtocolMonitor: React.FC<SpineProtocolMonitorProps> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<ProtocolEntry[]>([]);
  const [filterDir, setFilterDir] = useState<string>('ALL');
  const [filterCat, setFilterCat] = useState<string>('ALL');
  const [filterDevice, setFilterDevice] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [isPulsing, setIsPulsing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const [pos, setPos] = useState({ x: Math.max(20, window.innerWidth - 740), y: 60 });
  const [dragging, setDragging] = useState(false);
  const [dragRel, setDragRel] = useState({ x: 0, y: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const fetchProtocolLog = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await axios.get('/api/spine/protocol-log');
      if (Array.isArray(res.data)) {
        const data: ProtocolEntry[] = res.data;
        const currentIds = new Set(data.map(e => e.id));
        const freshIds = new Set<string>();

        if (prevIdsRef.current.size > 0) {
          for (const id of currentIds) {
            if (!prevIdsRef.current.has(id)) {
              freshIds.add(id);
            }
          }
        }

        if (freshIds.size > 0) {
          setNewIds(freshIds);
          setIsPulsing(true);
          setTimeout(() => {
            setNewIds(new Set());
            setIsPulsing(false);
          }, 1500);
        }

        prevIdsRef.current = currentIds;
        setEntries(data);
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        setLastSync(`${hh}:${mm}:${ss}`);
      }
    } catch (_) {
    } finally {
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 300);
      }
    }
  };

  // Continuous high-frequency polling (1.5s) + SSE real-time stream
  useEffect(() => {
    if (!isOpen) return;

    // Initial fetch
    fetchProtocolLog();

    // Regular interval: 1.5 seconds for instant webhook detection
    const pollInterval = setInterval(() => {
      fetchProtocolLog();
    }, 1500);

    // Optional SSE accelerator
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/spine/protocol-stream');
      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'entry' && parsed.data) {
            fetchProtocolLog();
          } else if (parsed.type === 'clear') {
            setEntries([]);
            prevIdsRef.current = new Set();
          }
        } catch (_) {}
      };
    } catch (_) {}

    return () => {
      clearInterval(pollInterval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [entries, autoScroll]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragRel.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragRel.y)),
      });
    };
    const onUp = () => setDragging(false);
    if (dragging) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging, dragRel]);

  if (!isOpen) return null;

  const deviceIds = Array.from(new Set(entries.map(e => e.deviceId).filter(Boolean))) as string[];

  const filtered = entries.filter(e => {
    if (filterDir !== 'ALL' && e.direction !== filterDir) return false;
    if (filterCat !== 'ALL' && e.category !== filterCat) return false;
    if (filterDevice && e.deviceId !== filterDevice) return false;
    return true;
  });

  const handleClear = async () => {
    try {
      await axios.delete('/api/spine/protocol-log');
    } catch (_) {}
    setEntries([]);
    prevIdsRef.current = new Set();
  };

  return (
    <>
      <style>{`
        @keyframes pulseNew {
          0%   { box-shadow: 0 0 0 0 rgba(56,189,248,0.5); }
          60%  { box-shadow: 0 0 0 10px rgba(56,189,248,0); }
          100% { box-shadow: none; }
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
        .protocol-scroll::-webkit-scrollbar { width: 4px; }
        .protocol-scroll::-webkit-scrollbar-track { background: transparent; }
        .protocol-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
      `}</style>

      <div
        style={{
          position: 'fixed',
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: '700px',
          height: '620px',
          background: 'rgba(8, 14, 30, 0.97)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderTop: '2px solid rgba(56,189,248,0.6)',
          borderRadius: '0.75rem',
          boxShadow: '0 24px 80px rgba(0,0,0,0.75), 0 0 60px rgba(56,189,248,0.04)',
          zIndex: 20000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          resize: 'both',
        }}
      >
        {/* Title Bar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            padding: '0.65rem 0.9rem',
            background: 'rgba(56,189,248,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            cursor: 'move',
            userSelect: 'none',
          }}
          onMouseDown={(e) => {
            setDragging(true);
            setDragRel({ x: e.clientX - pos.x, y: e.clientY - pos.y });
          }}
        >
          <span style={{
            width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
            background: isPulsing ? '#38bdf8' : '#22c55e',
            boxShadow: isPulsing ? '0 0 10px #38bdf8' : '0 0 7px #22c55e',
            animation: 'livePulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>
            🔬 SPINE/EEBUS Protocol Inspector
          </span>
          <span style={{
            fontSize: '0.62rem',
            padding: '0.1rem 0.35rem',
            borderRadius: '0.2rem',
            background: 'rgba(34,197,94,0.15)',
            color: '#4ade80',
            fontWeight: 600,
            fontFamily: 'monospace'
          }}>
            ⚡ LIVE (1.5s Polling + Push)
          </span>
          <span style={{ fontSize: '0.68rem', color: '#334155', fontFamily: 'monospace' }}>
            ems.domestic.miele-iot.com
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.68rem', color: '#334155' }}>
            {filtered.length} / {entries.length} Einträge
          </span>
          <button
            onClick={() => fetchProtocolLog(true)}
            disabled={isRefreshing}
            title="Jetzt aktualisieren"
            style={{
              background: isRefreshing ? 'rgba(56,189,248,0.3)' : 'rgba(56,189,248,0.15)',
              border: '1px solid rgba(56,189,248,0.35)',
              color: '#38bdf8',
              borderRadius: '0.3rem',
              cursor: 'pointer',
              fontSize: '0.65rem',
              fontWeight: 600,
              padding: '0.2rem 0.5rem',
              marginLeft: '0.3rem'
            }}
          >
            {isRefreshing ? '⟳ Lade...' : '⟳ Aktualisieren'}
          </button>
          <button
            onClick={handleClear}
            style={{ background: 'rgba(239,68,68,0.12)', border: 'none', color: '#f87171', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.65rem', padding: '0.2rem 0.5rem', marginLeft: '0.3rem' }}
          >
            ✕ Clear
          </button>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#94a3b8', borderRadius: '50%', cursor: 'pointer', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', marginLeft: '0.2rem' }}
          >
            ✕
          </button>
        </div>

        {/* Filter Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          padding: '0.4rem 0.9rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.015)',
        }}>
          {/* Direction */}
          {['ALL', ...ALL_DIRECTIONS].map(d => (
            <button key={d} onClick={() => setFilterDir(d)} style={{
              background: filterDir === d ? (d === 'OUT' ? 'rgba(56,189,248,0.2)' : d === 'IN' ? 'rgba(74,222,128,0.2)' : d === 'SYSTEM' ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.12)') : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filterDir === d ? (d === 'OUT' ? '#38bdf8' : d === 'IN' ? '#4ade80' : '#a78bfa') : 'rgba(255,255,255,0.08)'}`,
              color: filterDir === d ? '#f1f5f9' : '#475569',
              borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.63rem', fontWeight: 600, padding: '0.15rem 0.4rem',
            }}>
              {d === 'OUT' ? '⬆ OUT' : d === 'IN' ? '⬇ IN' : d === 'SYSTEM' ? '⚙ SYS' : '≡ ALL'}
            </button>
          ))}
          <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.07)' }} />
          {['ALL', 'binding', 'subscription', 'callback', 'command', 'query'].map(c => {
            const cc = c !== 'ALL' ? CATEGORY_COLORS[c] : null;
            return (
              <button key={c} onClick={() => setFilterCat(c)} style={{
                background: filterCat === c ? (cc ? `${cc.accent}20` : 'rgba(255,255,255,0.12)') : 'rgba(255,255,255,0.03)',
                border: `1px solid ${filterCat === c ? (cc ? cc.accent : 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.07)'}`,
                color: filterCat === c ? (cc ? cc.accent : '#f1f5f9') : '#475569',
                borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.6rem', fontWeight: 600,
                padding: '0.15rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {c === 'ALL' ? 'ALL TYPES' : c}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          {deviceIds.length > 0 && (
            <select value={filterDevice} onChange={e => setFilterDevice(e.target.value)} style={{
              background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', borderRadius: '0.25rem', fontSize: '0.62rem', padding: '0.15rem 0.35rem', cursor: 'pointer',
            }}>
              <option value="">Alle Geräte</option>
              {deviceIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          )}
          <button onClick={() => setAutoScroll(v => !v)} style={{
            background: autoScroll ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${autoScroll ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
            color: autoScroll ? '#38bdf8' : '#475569',
            borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.62rem', padding: '0.15rem 0.4rem',
          }}>
            ↕ Auto
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '0.75rem', padding: '0.28rem 0.9rem', borderBottom: '1px solid rgba(255,255,255,0.04)', overflowX: 'auto' }}>
          <span style={{ fontSize: '0.58rem', color: '#1e293b', whiteSpace: 'nowrap' }}>Legend:</span>
          {Object.entries(CATEGORY_COLORS).slice(0, 6).map(([key, val]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.58rem', color: val.accent, whiteSpace: 'nowrap' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: val.accent, display: 'inline-block' }} />
              {val.label}
            </span>
          ))}
          <span style={{ fontSize: '0.58rem', color: '#1e3a5f', marginLeft: 'auto', whiteSpace: 'nowrap' }}>⬆ = sunShift→Cloud | ⬇ = Cloud→sunShift</span>
        </div>

        {/* Log Stream */}
        <div ref={listRef} className="protocol-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.8rem' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '4rem', color: '#1e293b' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📡</div>
              <div style={{ fontSize: '0.85rem', color: '#334155' }}>Warte auf SPINE-Protokollereignisse...</div>
              <div style={{ fontSize: '0.7rem', marginTop: '0.4rem', color: '#1e293b' }}>
                Verbinde Miele Cloud oder führe Webhook-Calls aus.
              </div>
            </div>
          ) : (
            filtered.map(entry => (
              <ProtocolEntryCard key={entry.id} entry={entry} isNew={newIds.has(entry.id)} />
            ))
          )}
        </div>

        {/* Status Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.28rem 0.9rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.25)',
        }}>
          <span style={{ fontSize: '0.58rem', color: '#4ade80' }}>
            ⚡ Live-Sync aktiv (1.5s) {lastSync ? `· Letzter Abgleich: ${lastSync}` : ''}
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.58rem', color: '#1e3a5f', fontFamily: 'monospace' }}>
            sunShift EMS ↔ Miele SPINE-IoT Cloud (EN 50631 / EEBUS)
          </span>
        </div>
      </div>
    </>
  );
};
