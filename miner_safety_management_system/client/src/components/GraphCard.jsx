
import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts';

// Helper to flatten all sensor parameters from a log entry
function extractParameters(entry) {
  const params = [];
  if (entry.sensorData) {
    if (entry.sensorData.vitals) {
      params.push(...Object.keys(entry.sensorData.vitals));
    }
    if (entry.sensorData.environment) {
      params.push(...Object.keys(entry.sensorData.environment));
    }
  }
  return params;
}

export default function GraphCard({ name, cardId, mountTime: mountTimeProp }) {
  const [logData, setLogData] = useState([]);
  const [parameters, setParameters] = useState([]);
  const [selectedParam, setSelectedParam] = useState('');
  const [thresholds, setThresholds] = useState({});
  const [mountTime, setMountTime] = useState(null);
  // Initialize range from localStorage to prevent reset on refresh
  const [rangeMins, setRangeMins] = useState(() => {
    try {
      const key = `msms_graph_prefs:${cardId || name}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs && prefs.rangeMins != null) {
          const n = Number(prefs.rangeMins);
          return Number.isFinite(n) && n > 0 ? n : 3;
        }
      }
    } catch { /* ignore */ }
    return 3;
  }); // visible window in minutes

  // Local storage key for persisting per-card graph preferences
  const prefsKey = useMemo(() => `msms_graph_prefs:${cardId || name}`, [cardId, name]);

  // Load persisted preferences on mount/change of card
  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefsKey);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs && typeof prefs === 'object') {
          if (prefs.param) setSelectedParam(prefs.param);
          if (prefs.rangeMins != null) setRangeMins(Number(prefs.rangeMins) || 3);
        }
      }
    } catch { /* ignore */ }
  }, [prefsKey]);

  // Fetch sensor log data for this device
  useEffect(() => {
    fetch(`http://localhost:3001/api/sensor-log/${name}`)
      .then(res => res.json())
      .then(data => {
        setLogData(data || []);
        // Extract all unique parameters from the log
        const paramSet = new Set();
        (data || []).forEach(entry => extractParameters(entry).forEach(p => paramSet.add(p)));
  const paramsArr = Array.from(paramSet);
  setParameters(paramsArr);
  // Initialize selection only if none chosen; prefer persisted value loaded earlier
  setSelectedParam(prev => prev || (paramsArr[0] || ''));
        // Prefer provided mountTimeProp; else derive from earliest log entry timestamp (if any)
        if (Number.isFinite(mountTimeProp)) {
          setMountTime(mountTimeProp);
        } else {
          const ts = (data || [])
            .map(e => e._logTime ? Date.parse(e._logTime) : NaN)
            .filter(t => Number.isFinite(t))
            .sort((a, b) => a - b);
          setMountTime(ts.length ? ts[0] : null);
        }
      });
  }, [name]);

  useEffect(() => {
    fetch('http://localhost:3001/api/thresholds')
      .then(res => res.json())
      .then(data => {
        const thObj = {};
        data.forEach(t => {
          thObj[t.parameter] = t;
        });
        setThresholds(thObj);
      });
  }, []);

  // Poll for new log data every 10 seconds to update the graph in real-time
  useEffect(() => {
    if (!name) return;
    let isCancelled = false;

    const fetchLogs = () => {
      fetch(`http://localhost:3001/api/sensor-log/${name}`)
        .then(res => res.json())
        .then(data => {
          if (isCancelled) return;
          const safeData = Array.isArray(data) ? data : [];
          setLogData(safeData);
          // Recompute parameter list from latest data
          const paramSet = new Set();
          safeData.forEach(entry => extractParameters(entry).forEach(p => paramSet.add(p)));
          const paramsArr = Array.from(paramSet);
          setParameters(paramsArr);
          // Keep selectedParam if valid; otherwise pick first available
          setSelectedParam(prev => (!prev || !paramsArr.includes(prev)) ? (paramsArr[0] || prev) : prev);
          // Initialize mount time if not set and none provided
          setMountTime(prev => {
            if (Number.isFinite(prev) || Number.isFinite(mountTimeProp)) return prev;
            const ts = safeData
              .map(e => e._logTime ? Date.parse(e._logTime) : NaN)
              .filter(t => Number.isFinite(t))
              .sort((a, b) => a - b);
            return ts.length ? ts[0] : prev;
          });
        })
        .catch(() => { /* ignore transient errors */ });
    };

    fetchLogs(); // initial fetch immediately
    const id = setInterval(fetchLogs, 10000); // 10s polling
    return () => { isCancelled = true; clearInterval(id); };
  }, [name, mountTimeProp]);

  // Persist preferences whenever user changes selection or range
  useEffect(() => {
    try {
      localStorage.setItem(prefsKey, JSON.stringify({ param: selectedParam, rangeMins }));
    } catch { /* ignore */ }
  }, [prefsKey, selectedParam, rangeMins]);

  // Prepare chart data
  const chartData = (logData || [])
    .filter(entry => entry && entry.sensorData)
    .map((entry, idx) => {
      let value = null;
      if (entry.sensorData.vitals && selectedParam in entry.sensorData.vitals) {
        value = entry.sensorData.vitals[selectedParam];
      } else if (entry.sensorData.environment && selectedParam in entry.sensorData.environment) {
        value = entry.sensorData.environment[selectedParam];
      }
      const num = value == null ? null : Number(value);
      // Use earliest log time as t0; fallback to first entry with time; else monotonically increasing by minute
      const fallbackT0 = (logData[0]?._logTime ? Date.parse(logData[0]._logTime) : Date.now());
      const t0 = Number.isFinite(mountTime) ? mountTime : fallbackT0;
      const t = entry._logTime ? Date.parse(entry._logTime) : (t0 + idx * 60000);
      const mins = Math.max(0, Number(((t - t0) / 60000).toFixed(2))); // fractional minutes
      return { time: mins, value: num };
    })
    .filter(p => p.value != null && !Number.isNaN(p.value));

  // Y axis domain
  const th = thresholds[selectedParam] || {};
  let yMin = 0;
  if (selectedParam === 'bodyTemp') yMin = 35;
  if (selectedParam === 'pressure') yMin = 900;
  const yMax = th.critical_threshold ? Number(th.critical_threshold) + 1 : undefined;

  // X axis domain: show selected window up to the latest time
  const xMax = chartData.length ? Math.max(rangeMins, chartData[chartData.length - 1].time) : rangeMins;
  const xMin = Math.max(0, xMax - rangeMins);

  return (
    <div className="admin-device-card">
      <div className="admin-card-title">{name} Graph</div>
      <div className="admin-device-graph graph-300 w-100">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" type="number" domain={[xMin, xMax]} tickFormatter={v => `${v} min`} label={{ value: 'Time (min)', position: 'insideBottomRight', offset: -5 }} />
              <YAxis domain={[yMin, yMax]} label={{ value: selectedParam, angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" dot={false} name={selectedParam} />
              {th.caution_threshold && <ReferenceLine y={Number(th.caution_threshold)} label="Caution" stroke="#ffb300" strokeDasharray="3 3" />}
              {th.warning_threshold && <ReferenceLine y={Number(th.warning_threshold)} label="Warning" stroke="#ff9800" strokeDasharray="3 3" />}
              {th.critical_threshold && <ReferenceLine y={Number(th.critical_threshold)} label="Critical" stroke="#f44336" strokeDasharray="3 3" />}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="no-data">No data available for this parameter.</div>
        )}
      </div>
      <div className="admin-graph-controls gap-12">
        <div>
          <span>Parameter:</span>
          <select value={selectedParam} onChange={e => setSelectedParam(e.target.value)} className="ml-8">
            {parameters.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <span>Range:</span>
          <select value={rangeMins} onChange={e => setRangeMins(Number(e.target.value))} className="ml-8">
            <option value={3}>3 min</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min</option>
            <option value={30}>30 min</option>
            <option value={60}>1 hr</option>
            <option value={90}>1.5 hr</option>
            <option value={120}>2 hr</option>
            <option value={150}>2.5 hr</option>
            <option value={180}>3 hr</option>
            <option value={210}>3.5 hr</option>
            <option value={240}>4 hr</option>
            <option value={270}>4.5 hr</option>
            <option value={300}>5 hr</option>
            <option value={330}>5.5 hr</option>
            <option value={360}>6 hr</option>
            <option value={390}>6.5 hr</option>
            <option value={420}>7 hr</option>
            <option value={450}>7.5 hr</option>
            <option value={480}>8 hr</option>
          </select>
        </div>
      </div>
    </div>
  );
}
