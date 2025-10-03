import React, { useEffect, useMemo, useState } from 'react';
import './css/StatisticalGraph.css';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts';

// Helpers
const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseISO = (s) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
};

const minutesSinceMidnight = (date) => date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;

function extractEntryParams(entry) {
  const out = [];
  const sd = entry?.sensorData;
  if (!sd) return out;
  if (sd.vitals) out.push(...Object.keys(sd.vitals));
  if (sd.environment) out.push(...Object.keys(sd.environment));
  return out;
}

function getValue(entry, param) {
  const sd = entry?.sensorData;
  if (!sd) return null;
  if (sd.vitals && param in sd.vitals) return Number(sd.vitals[param]);
  if (sd.environment && param in sd.environment) return Number(sd.environment[param]);
  return null;
}

// Simple Pearson correlation
function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const denom = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (!denom) return null;
  return (n * sxy - sx * sy) / denom;
}

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

export default function StatisticalGraph() {
  const [assignments, setAssignments] = useState([]);
  const [thresholds, setThresholds] = useState({});
  const [selectedDate, setSelectedDate] = useState(() => fmtDate(new Date()));
  const [rawByDevice, setRawByDevice] = useState({}); // { deviceName: [entries] }
  const [parameters, setParameters] = useState([]);
  const [selectedParam, setSelectedParam] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportAllDates, setExportAllDates] = useState(false);

  // Fetch assignments and thresholds
  useEffect(() => {
    (async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          fetch('http://localhost:3001/api/assignments'),
          fetch('http://localhost:3001/api/thresholds')
        ]);
        const aData = await aRes.json();
        const tData = await tRes.json();
        const th = {};
        tData.forEach(x => { th[x.parameter] = x; });
        setAssignments(aData || []);
        setThresholds(th);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // Fetch logs for all devices listed in assignments
  useEffect(() => {
    (async () => {
      const devices = (assignments || [])
        .map(a => ({ deviceName: a.device_name, label: `${a.first_name} ${a.surname} (${a.device_name})` }))
        .filter(x => !!x.deviceName);
      if (!devices.length) return;
      try {
        const results = await Promise.all(devices.map(d =>
          fetch(`http://localhost:3001/api/sensor-log/${encodeURIComponent(d.deviceName)}`)
            .then(r => r.json())
            .catch(() => [])
        ));
        const map = {};
        devices.forEach((d, i) => { map[d.deviceName] = results[i] || []; });
        setRawByDevice(map);
      } catch (e) { /* ignore */ }
    })();
  }, [assignments]);

  // Filter by selected date and derive parameter list
  const filteredByDevice = useMemo(() => {
    const res = {};
    const params = new Set();
    const target = selectedDate;
    Object.entries(rawByDevice).forEach(([dev, arr]) => {
      const filtered = (arr || []).filter(e => {
        const dt = parseISO(e._logTime || e.time);
        return dt && fmtDate(dt) === target;
      });
      res[dev] = filtered;
      filtered.forEach(en => extractEntryParams(en).forEach(p => params.add(p)));
    });
    const list = Array.from(params);
    list.sort();
    return { data: res, params: list };
  }, [rawByDevice, selectedDate]);

  useEffect(() => {
    setParameters(filteredByDevice.params);
    if (!selectedParam && filteredByDevice.params.length) {
      setSelectedParam(filteredByDevice.params[0]);
    }
  }, [filteredByDevice, selectedParam]);

  // Build merged time-series for chart (per minute bins)
  const chart = useMemo(() => {
    const devices = assignments
      .map(a => ({ deviceName: a.device_name, label: `${a.first_name} ${a.surname} (${a.device_name})` }))
      .filter(x => !!x.deviceName);
    if (!devices.length || !selectedParam) return { data: [], lines: [] };

    // collect all minute bins
    const binsSet = new Set();
    devices.forEach(d => {
      (filteredByDevice.data[d.deviceName] || []).forEach(e => {
        const dt = parseISO(e._logTime || e.time);
        if (dt) binsSet.add(Math.floor(minutesSinceMidnight(dt))); // minute resolution
      });
    });
    const bins = Array.from(binsSet).sort((a, b) => a - b);

    // index per-device by minute -> value
    const perDeviceMap = {};
    devices.forEach(d => {
      const idx = new Map();
      (filteredByDevice.data[d.deviceName] || []).forEach(e => {
        const dt = parseISO(e._logTime || e.time);
        if (!dt) return;
        const m = Math.floor(minutesSinceMidnight(dt));
        const v = getValue(e, selectedParam);
        if (Number.isFinite(v)) idx.set(m, v);
      });
      perDeviceMap[d.label] = idx;
    });

    // build combined data rows
    const rows = bins.map(m => {
      const row = { minute: m };
      devices.forEach(d => {
        const label = `${d.first_name ? `${d.first_name} ${d.surname}` : ''}`; // not used
      });
      Object.entries(perDeviceMap).forEach(([label, idx]) => {
        const v = idx.get(m);
        if (Number.isFinite(v)) row[label] = v;
      });
      return row;
    });

    const lineDefs = Object.keys(perDeviceMap).map((label, i) => ({ key: label, color: COLORS[i % COLORS.length] }));

    return { data: rows, lines: lineDefs };
  }, [assignments, filteredByDevice, selectedParam]);

  const th = thresholds[selectedParam] || {};
  let yMin = 0;
  if (selectedParam === 'bodyTemp') yMin = 25;
  if (selectedParam === 'pressure') yMin = 900;
  const yMax = th.critical_threshold ? Number(th.critical_threshold) + 1 : undefined;

  // Summaries
  const summaries = useMemo(() => {
    // Averages per series and overall
    const averages = [];
    const allVals = [];
    chart.lines.forEach(l => {
      let sum = 0, count = 0;
      chart.data.forEach(r => {
        const v = r[l.key];
        if (Number.isFinite(v)) { sum += v; count += 1; allVals.push(v); }
      });
      averages.push({ key: l.key, avg: count ? sum / count : null, count });
    });

    // Exceedances per device (if thresholds exist)
    const exceed = [];
    if (th && (th.caution_threshold || th.warning_threshold || th.critical_threshold)) {
      chart.lines.forEach(l => {
        let c1 = 0, c2 = 0, c3 = 0;
        chart.data.forEach(r => {
          const v = r[l.key];
          if (!Number.isFinite(v)) return;
          if (th.caution_threshold && v >= Number(th.caution_threshold)) c1++;
          if (th.warning_threshold && v >= Number(th.warning_threshold)) c2++;
          if (th.critical_threshold && v >= Number(th.critical_threshold)) c3++;
        });
        exceed.push({ key: l.key, caution: c1, warning: c2, critical: c3 });
      });
    }

    // Gas vs Heart correlation (pick common gas param if present)
    let correlation = null;
    const gasCandidates = Object.keys(thresholds).filter(p => !['heartRate','bodyTemp','spo2','bp','pressure'].includes(p));
    const heartParam = 'heartRate';
    if (gasCandidates.length && filteredByDevice.params.includes(heartParam)) {
      // Build aligned pairs across all devices for the selected day
      // Choose the gas with the most data
      const gasCounts = {};
      gasCandidates.forEach(p => {
        gasCounts[p] = 0;
        Object.values(filteredByDevice.data).forEach(arr => {
          arr.forEach(e => { const v = getValue(e, p); if (Number.isFinite(v)) gasCounts[p]++; });
        });
      });
      const gasParam = gasCandidates.sort((a,b) => (gasCounts[b]||0) - (gasCounts[a]||0))[0];
      if (gasParam) {
        const pairsX = []; const pairsY = [];
        Object.values(filteredByDevice.data).forEach(arr => {
          arr.forEach(e => {
            const hx = getValue(e, gasParam);
            const hy = getValue(e, heartParam);
            if (Number.isFinite(hx) && Number.isFinite(hy)) { pairsX.push(hx); pairsY.push(hy); }
          });
        });
        const r = pearson(pairsX, pairsY);
        if (r != null) correlation = { gasParam, r };
      }
    }

    // Top gas exceeding thresholds (across env params)
    let topGas = null;
    const envParams = filteredByDevice.params.filter(p => !(p in ({})) && p !== 'heartRate' && p !== 'bodyTemp' && p !== 'spo2');
    if (envParams.length) {
      const counts = {};
      envParams.forEach(p => {
        const thp = thresholds[p];
        if (!thp || !thp.caution_threshold) return;
        counts[p] = 0;
        Object.values(filteredByDevice.data).forEach(arr => {
          arr.forEach(e => {
            const v = getValue(e, p);
            if (Number.isFinite(v) && v >= Number(thp.caution_threshold)) counts[p]++;
          });
        });
      });
      const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]);
      if (sorted.length) topGas = { param: sorted[0][0], count: sorted[0][1] };
    }

    return { averages, overallAvg: allVals.length ? allVals.reduce((a,b)=>a+b,0)/allVals.length : null, exceed, correlation, topGas };
  }, [chart, th, thresholds, filteredByDevice]);

  const changeDay = (delta) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setSelectedDate(fmtDate(d));
  };

  // ---- CSV Export Logic ----
  function flattenForExport() {
    // Columns: timestamp, date, time, device_id, device_name, employee_id, employee_name, category (vitals/environment), parameter, value
    const rows = [];
    const assignmentByDevice = {};
    assignments.forEach(a => { assignmentByDevice[a.device_name] = a; });
    Object.entries(rawByDevice).forEach(([deviceName, entries]) => {
      const a = assignmentByDevice[deviceName];
      const deviceId = a ? a.device_id : '';
      const empId = a ? a.emp_id : '';
      const empName = a ? `${a.first_name || ''} ${a.surname || ''}`.trim() : '';
      (entries||[]).forEach(e => {
        const dt = parseISO(e._logTime || e.time);
        if (!dt) return;
        const datePart = fmtDate(dt);
        if (!exportAllDates && datePart !== selectedDate) return; // filter if single day mode
        const tsISO = dt.toISOString();
        const timePart = tsISO.split('T')[1].replace('Z','');
        const vitals = e.sensorData?.vitals || {};
        const env = e.sensorData?.environment || {};
        Object.entries(vitals).forEach(([param,val]) => {
          rows.push({ timestamp: tsISO, date: datePart, time: timePart, device_id: deviceId, device_name: deviceName, employee_id: empId, employee_name: empName, category: 'vitals', parameter: param, value: Number(val) });
        });
        Object.entries(env).forEach(([param,val]) => {
          rows.push({ timestamp: tsISO, date: datePart, time: timePart, device_id: deviceId, device_name: deviceName, employee_id: empId, employee_name: empName, category: 'environment', parameter: param, value: Number(val) });
        });
      });
    });
    return rows;
  }

  function toCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
  }

  async function exportCSV() {
    try {
      setExporting(true);
      const rows = flattenForExport();
      if (!rows.length) { window.alert('No data for selected date to export.'); return; }
      const csv = toCSV(rows);
      const blob = new Blob([csv], { type: 'text/csv' });
  const defaultName = exportAllDates ? `msms_export_all_dates.csv` : `msms_export_${selectedDate}.csv`;
      // Try File System Access API first
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: defaultName, types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }] });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (e) {
          if (e.name === 'AbortError') return; // user canceled
        }
      }
      // Fallback: anchor download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = defaultName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="container stats-container">
      <h2 className="mb-3">Statistical Graph</h2>

      <div className="stats-controls">
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-outline-secondary" onClick={() => changeDay(-1)}>Prev</button>
          <input type="date" className="form-control stats-date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          <button className="btn btn-outline-secondary" onClick={() => changeDay(1)}>Next</button>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span>Parameter:</span>
          <select className="form-select w-220" value={selectedParam} onChange={e => setSelectedParam(e.target.value)}>
            {parameters.map(p => (<option key={p} value={p}>{p}</option>))}
          </select>
          <div className="form-check form-switch">
            <input className="form-check-input" type="checkbox" id="exportAllDatesSwitch" checked={exportAllDates} onChange={e => setExportAllDates(e.target.checked)} />
            <label className="form-check-label small" htmlFor="exportAllDatesSwitch">All dates</label>
          </div>
          <button className="btn btn-success" disabled={exporting} onClick={exportCSV}>{exporting ? 'Exporting...' : 'Export CSV'}</button>
        </div>
      </div>

      <div className="stats-chart">
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={chart.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="minute" tickFormatter={(m) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`} label={{ value: 'Time (HH:MM)', position: 'insideBottomRight', offset: -5 }} />
            <YAxis domain={[yMin, yMax]} label={{ value: selectedParam || 'Value', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(val) => Number(val).toFixed(2)} labelFormatter={(m) => `Time ${String(Math.floor(m/60)).padStart(2,'0')}:${String(Math.floor(m%60)).padStart(2,'0')}`} />
            <Legend />
            {chart.lines.map((l) => (
              <Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} dot={false} isAnimationActive={false} />
            ))}
            {th.caution_threshold && <ReferenceLine y={Number(th.caution_threshold)} label="Caution" stroke="#ffb300" strokeDasharray="3 3" />}
            {th.warning_threshold && <ReferenceLine y={Number(th.warning_threshold)} label="Warning" stroke="#ff9800" strokeDasharray="3 3" />}
            {th.critical_threshold && <ReferenceLine y={Number(th.critical_threshold)} label="Critical" stroke="#f44336" strokeDasharray="3 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <h5>Summaries</h5>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Averages</h6>
                <ul className="mb-2">
                  {summaries.averages.map(a => (
                    <li key={a.key}><strong>{a.key}:</strong> {a.avg != null ? a.avg.toFixed(2) : '—'} ({a.count} pts)</li>
                  ))}
                </ul>
                <div><strong>Overall average:</strong> {summaries.overallAvg != null ? summaries.overallAvg.toFixed(2) : '—'}</div>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Threshold exceedances</h6>
                {(!summaries.exceed || !summaries.exceed.length) ? (
                  <div>No threshold information for {selectedParam || 'parameter'}.</div>
                ) : (
                  <ul className="mb-0">
                    {summaries.exceed.map(e => (
                      <li key={e.key}><strong>{e.key}:</strong> Caution {e.caution}, Warning {e.warning}, Critical {e.critical}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Gas exposure vs Heart rate</h6>
                {summaries.correlation ? (
                  <div>
                    Correlation between <strong>{summaries.correlation.gasParam}</strong> and <strong>heartRate</strong>: <strong>{summaries.correlation.r.toFixed(3)}</strong>
                    <div className="text-muted small">(positive means they rise together; negative means opposite trend)</div>
                  </div>
                ) : (
                  <div>Not enough data to compute correlation.</div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card">
              <div className="card-body">
                <h6 className="card-title">Top gas exceeding thresholds</h6>
                {summaries.topGas ? (
                  <div><strong>{summaries.topGas.param}</strong> exceeded caution threshold {summaries.topGas.count} times.</div>
                ) : (
                  <div>No gas threshold exceedances found for this day.</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
