# Engineering Lessons Learned: SunShift EMS

This document captures specific technical challenges and the standardized solutions implemented to ensure system reliability.

## 1. The "Daily Boundary" Shift (SQL)
**Challenge**: PostgreSQL `::date` casts use the DB's local timezone. A query at 23:00 local time (21:00 UTC) might fetch the "next day" or miss data points near midnight.
**Solution**: Use explicit ISO-8601 range queries.
**Standard**:
```typescript
const start = new Date(dateStr + 'T00:00:00');
const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
// Query: WHERE timestamp >= $1 AND timestamp < $2
```

## 2. Linear vs. Slot-Based Charts
**Challenge**: Using fixed array indices (e.g., 96 slots for 24h) causes misalignment if the data source (e.g., price API) doesn't start exactly at 00:00.
**Solution**: Use a `linear` X-axis in Chart.js and map data directly to `timestamp`.
**Standard**:
```javascript
const formattedData = rawData.map(pt => ({
  x: new Date(pt.timestamp).getTime(),
  y: pt.value
}));
```

## 3. Data Retention & Forensics
**Challenge**: Overwriting forecasts with new API calls destroyed the ability to compare "Planned vs. Actual" performance.
**Solution**: 
- Use `INSERT ... ON CONFLICT` for forecasts.
- Log every telemetry event to `live_telemetry_history`.
- Maintain a rolling **30-day** window for all datasets.

## 4. UI Fallbacks & Mode Clarity
**Challenge**: Displaying "Live" mode for a future date resulted in empty charts, misleading the user.
**Solution**: Implement automatic view switching. If `selectedDate` is not "Today", force `viewType` to `forecast`.

---
*Last Updated: 2026-05-04*
