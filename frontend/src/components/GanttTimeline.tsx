import React from 'react';
import { Clock, Zap, Cpu, Activity } from 'lucide-react';

interface GanttTimelineProps {
  devices: any[];
  powerSequences: Record<string, any>;
  powerTimeSlots: Record<string, any>;
  selectedDate: string;
}

export const GanttTimeline: React.FC<GanttTimelineProps> = ({
  devices,
  powerSequences,
  powerTimeSlots,
  selectedDate
}) => {
  return (
    <div id="gantt-chart-container" className="gantt-chart" style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxSizing: 'border-box' }}>
      {devices.filter(d => d.status !== 'INACTIVE' && d.status !== 'OFF').map((device) => {
        // Force Day Bounds based on selected date matching the chart
        const firstPriceTime = new Date(selectedDate + 'T00:00:00');
        firstPriceTime.setHours(0, 0, 0, 0);
        const totalSpan = 24 * 60 * 60 * 1000;

        const seq = powerSequences[device.id];
        const isScheduledOrRunning = seq && (seq.state === 'scheduled' || seq.state === 'running');

        const deviceSlots = powerTimeSlots[device.id]?.slots || [];
        const maxW = Math.max(...deviceSlots.map((s: any) => s.powerConsumptionW), 1);
        const totalProgramMins = deviceSlots.reduce((acc: number, s: any) => acc + (s.durationMinutes || 15), 0);

        const earliestTime = seq && seq.earliestStartTime ? new Date(seq.earliestStartTime).getTime() : firstPriceTime.getTime(); 
        const latestTime = seq && seq.latestEndTime ? new Date(seq.latestEndTime).getTime() : (firstPriceTime.getTime() + totalSpan);
        const startTime = seq && seq.startTime ? new Date(seq.startTime).getTime() : earliestTime;
        
        const flexLeft = Math.max(0, Math.min(100, ((earliestTime - firstPriceTime.getTime()) / totalSpan) * 100));
        const flexWidth = Math.max(0, Math.min(100 - flexLeft, ((latestTime - earliestTime) / totalSpan) * 100));

        const activeLeft = Math.max(0, Math.min(100, ((startTime - firstPriceTime.getTime()) / totalSpan) * 100));
        const activeWidth = Math.max(0, Math.min(100 - activeLeft, (totalProgramMins * 60 * 1000 / totalSpan) * 100));

        const endTime = startTime + (totalProgramMins * 60 * 1000);

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
          <div key={device.id} className="gantt-row-container" style={{ padding: 0, marginBottom: '0.75rem' }}>
            <div className="gantt-row" style={{ position: 'relative', height: '1.5rem', display: 'flex', alignItems: 'center' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, height: '2px', background: 'rgba(148, 163, 184, 0.1)', top: '50%', transform: 'translateY(-50%)' }}></div>
              <div style={{ position: 'relative', width: '100%', height: '1.2rem' }}>
                {isScheduledOrRunning && (
                  <>
                    <div className="tooltip-trigger" style={{ position: 'absolute', left: `${flexLeft}%`, width: `${flexWidth}%`, height: '100%', background: colorBase, borderRadius: '0.25rem', border: `1px solid ${colorBorder}`, cursor: 'pointer' }}>
                      {/* Premium Flexibility Popup */}
                      <div className="gantt-premium-popup">
                        <div className="popup-header" style={{ borderBottomColor: colorBorder }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={16} color={colorActive} />
                            <span style={{ fontWeight: 700 }}>Zeitliche Flexibilität</span>
                          </div>
                        </div>
                        <div className="popup-time-row">
                          <span className="popup-time-label">Frühestens</span>
                          <span className="popup-time-value">{new Date(earliestTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="popup-time-row">
                          <span className="popup-time-label">Spätestens</span>
                          <span className="popup-time-value">{new Date(latestTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    </div>

                    <div className="tooltip-trigger" style={{ position: 'absolute', left: `${activeLeft}%`, width: `${activeWidth}%`, height: '100%', background: colorActive, borderRadius: '0.35rem', boxShadow: '0 3px 6px rgba(0,0,0,0.2)', border: `1px solid ${colorActive}`, cursor: 'pointer' }}>
                      {/* Premium Execution Popup */}
                      <div className="gantt-premium-popup" style={{ width: '320px' }}>
                        <div className="popup-header" style={{ borderBottomColor: 'rgba(255,255,255,0.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Activity size={16} color="#4ade80" />
                            <span style={{ fontWeight: 700 }}>Ausführungs-Details</span>
                          </div>
                          <Zap size={14} color="#fbbf24" />
                        </div>
                        
                        <div className="popup-time-row">
                          <span className="popup-time-label">Geplanter Start</span>
                          <span className="popup-time-value" style={{ color: '#4ade80' }}>{new Date(startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div className="popup-time-row">
                          <span className="popup-time-label">Geplantes Ende</span>
                          <span className="popup-time-value">{new Date(endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>

                        {/* Power Profile Chart with Y-Axis */}
                        <div style={{ marginTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                            <span>Lastprofil {totalProgramMins.toFixed(0)} min</span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', height: '60px' }}>
                            {/* Y-Axis Scale */}
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '0.6rem', color: '#94a3b8', padding: '2px 0' }}>
                              <span>{maxW}W</span>
                              <span>0W</span>
                            </div>
                            {/* Chart Area */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: '2px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              {deviceSlots.map((slot: any, sIdx: number) => {
                                const hPct = (slot.powerConsumptionW / maxW) * 100;
                                return (
                                  <div key={`tt-slot-${sIdx}`} style={{ flex: 1, height: `${hPct}%`, background: '#4ade80', borderRadius: '1px' }} title={`${slot.powerConsumptionW}W`}></div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Synchronized Legend at the bottom */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingLeft: 0 }}>
        {devices.filter(d => d.status !== 'INACTIVE' && d.status !== 'OFF').map(device => {
          let colorActive = 'rgba(34, 197, 94, 0.8)';
          if (device.type === 'Dryer') colorActive = 'rgba(56, 189, 248, 0.8)';
          if (device.type === 'Dishwasher') colorActive = 'rgba(249, 115, 22, 0.8)';
          
          return (
            <div key={`legend-${device.id}`} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              background: colorActive, 
              padding: '0.4rem 1rem', 
              borderRadius: '0.5rem', 
              color: 'white', 
              fontSize: '0.85rem', 
              fontWeight: 600,
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Cpu size={14} />
              {device.name}
            </div>
          );
        })}
      </div>
    </div>
  );
};
