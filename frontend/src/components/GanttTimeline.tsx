import React from 'react';

interface GanttTimelineProps {
  devices: any[];
  prices: any[];
  powerSequences: Record<string, any>;
  powerTimeSlots: Record<string, any>;
}

export const GanttTimeline: React.FC<GanttTimelineProps> = ({
  devices,
  prices,
  powerSequences,
  powerTimeSlots
}) => {
  return (
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

        const flexLeft = Math.max(0, Math.min(100, ((earliestTime - firstPriceTime) / totalSpan) * 100));
        const flexWidth = Math.max(0, Math.min(100 - flexLeft, ((latestTime - earliestTime) / totalSpan) * 100));

        const activeLeft = Math.max(0, Math.min(100, ((startTime - firstPriceTime) / totalSpan) * 100));
        const activeWidth = Math.max(0, Math.min(100 - activeLeft, ((endTime - startTime) / totalSpan) * 100));

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
              {isScheduledOrRunning && seq?.earliestStartTime && (
                <>
                  <div className="tooltip-trigger" style={{ position: 'absolute', left: `${flexLeft}%`, width: `${flexWidth}%`, height: '100%', background: colorBase, borderRadius: '0.125rem', border: `1px solid ${colorBorder}`, cursor: 'pointer' }}>
                    <div className="gantt-tooltip">
                      <strong>{device.name}</strong><br/>
                      Freigabe: {new Date(earliestTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {new Date(latestTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>

                  <div className="tooltip-trigger" style={{ position: 'absolute', left: `${activeLeft}%`, width: `${activeWidth}%`, height: '100%', background: colorActive, borderRadius: '0.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', border: `1px solid ${colorActive}`, cursor: 'pointer', overflow: 'hidden' }}>
                    <div className="gantt-tooltip">
                      <strong>{device.name} (Laufzeit)</strong><br/>
                      Start: {new Date(startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}<br/>
                      Ende: {new Date(endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>

                    <div style={{ display: 'flex', height: '100%', width: '100%', alignItems: 'flex-end' }}>
                      {deviceSlots.map((slot: any, sIdx: number) => {
                        const slotPct = (slot.durationMinutes / totalMins) * 100;
                        const powerPct = (slot.powerConsumptionW / maxW) * 100;
                        
                        return (
                          <div 
                            key={`slot-${device.id}-${sIdx}`} 
                            style={{ 
                              width: `${slotPct}%`, 
                              height: `${powerPct}%`, 
                              background: 'rgba(255, 255, 255, 0.4)', 
                              borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
                              position: 'relative'
                            }} 
                            title={`${slot.powerConsumptionW}W (${slot.durationMinutes} min)`}
                          >
                            <div className="gantt-tooltip">
                              <strong>Slot {sIdx + 1}</strong><br/>
                              Verbrauch: {slot.powerConsumptionW}W<br/>
                              Dauer: {slot.durationMinutes} min
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
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
  );
};
