import React from 'react';

interface FloatingPanelsProps {
  isLogsDetached: boolean;
  setIsLogsDetached: (val: boolean) => void;
  apiLogs: any[];
  callbackLogs: any[];
  tickerPos: { x: number; y: number };
  setTickerDragging: (val: boolean) => void;
  setTickerRel: (rel: { x: number; y: number }) => void;
  callbackPos: { x: number; y: number };
  setCallbackDragging: (val: boolean) => void;
  setCallbackRel: (rel: { x: number; y: number }) => void;
  logPos: { x: number; y: number };
  setDragging: (val: boolean) => void;
  setRel: (rel: { x: number; y: number }) => void;
}

export const FloatingPanels: React.FC<FloatingPanelsProps> = ({
  isLogsDetached,
  setIsLogsDetached,
  apiLogs,
  callbackLogs,
  tickerPos,
  setTickerDragging,
  setTickerRel,
  callbackPos,
  setCallbackDragging,
  setCallbackRel,
  logPos,
  setDragging,
  setRel
}) => {

  if (!isLogsDetached) return null;

  return (
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
          zIndex: 10000, 
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
          left: `${callbackPos.x}px`, 
          top: `${callbackPos.y}px`, 
          width: '400px', 
          height: '500px',
          background: 'rgba(15, 23, 42, 0.95)', 
          backdropFilter: 'blur(12px)', 
          color: '#f1f5f9', 
          border: '1px solid rgba(34, 197, 94, 0.3)', 
          borderRadius: '0.75rem', 
          padding: '1rem', 
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', 
          zIndex: 10001, 
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
            setCallbackDragging(true);
            setCallbackRel({
              x: e.clientX - callbackPos.x,
              y: e.clientY - callbackPos.y
            });
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
            <h3 style={{ fontSize: '1rem', color: '#f1f5f9', margin: 0 }}>SPINE Webhook Callbacks</h3>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0', fontFamily: 'monospace', fontSize: '0.8rem' }}>
          {callbackLogs.map(log => {
            let payloadStr = log.payload;
            try {
              if (typeof log.payload !== 'string') {
                payloadStr = JSON.stringify(log.payload, null, 2);
              }
            } catch (_) {}

            return (
              <div key={log.id} style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22c55e', fontWeight: 'bold', fontSize: '0.75rem' }}>
                  <span>📥 {log.feature_type}</span>
                  <span style={{ color: '#64748b' }}>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', color: '#94a3b8', margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                  {payloadStr}
                </pre>
              </div>
            );
          })}
          {callbackLogs.length === 0 && (
            <p style={{ color: '#64748b', textAlign: 'center', marginTop: '2rem' }}>Keine persistenten Callbacks gefunden.</p>
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
          zIndex: 10002, 
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
  );
};
