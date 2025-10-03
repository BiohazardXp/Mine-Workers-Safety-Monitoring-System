import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function dayBuckets(items) {
  // group by YYYY-MM-DD
  const groups = {};
  items.forEach(it => {
    const d = it.time ? new Date(it.time) : (it.timestamp ? new Date(it.timestamp) : null);
    const key = d ? d.toISOString().slice(0,10) : 'unknown';
    groups[key] = groups[key] || [];
    groups[key].push(it);
  });
  // return sorted keys (newest first)
  const keys = Object.keys(groups).sort((a,b) => b.localeCompare(a));
  return { groups, keys };
}

export default function ViewLogs() {
  const navigate = useNavigate();
  const [type, setType] = useState('actions'); // actions or sensor
  const [actions, setActions] = useState([]);
  const [sensor, setSensor] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        fetch('http://localhost:3001/api/logs/actions').then(r => r.json()),
        fetch('http://localhost:3001/api/logs/sensor').then(r => r.json()),
      ]);
      setActions(aRes || []);
      setSensor(sRes || []);
      // choose first day by default
      const { keys: aKeys } = dayBuckets(aRes || []);
      setSelectedDay(aKeys.length ? aKeys[0] : null);
    } catch (e) {
      console.error('Failed to load logs', e);
    }
    setLoading(false);
  };

  const data = type === 'actions' ? actions : sensor;
  const { groups, keys } = dayBuckets(data || []);
  const listForDay = selectedDay ? (groups[selectedDay] || []) : (data || []);

  return (
    <div className="container mt-4">
      <button className="btn btn-secondary mb-3" onClick={() => navigate('/')}>Back to Dashboard</button>
      <h3>View Logs</h3>
      <div className="d-flex align-items-center gap-3 mb-3">
        <div className="btn-group" role="group">
          <button className={`btn ${type==='actions'?'btn-primary':'btn-outline-primary'}`} onClick={() => setType('actions')}>Actions</button>
          <button className={`btn ${type==='sensor'?'btn-primary':'btn-outline-primary'}`} onClick={() => setType('sensor')}>Sensor</button>
        </div>
        <div className="ms-3">Days: {keys.length}</div>
      </div>

      <div className="row">
        <div className="col-3">
          <div className="logs-days border p-2">
            {keys.map(k => (
              <div key={k} className={`p-1 ${k===selectedDay ? 'bg-light' : ''} cursor-pointer`} onClick={() => setSelectedDay(k)}>
                {k} <span className="text-muted">({(groups[k]||[]).length})</span>
              </div>
            ))}
          </div>
        </div>
        <div className="col-9">
          <div className="logs-table">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Actor</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {listForDay.map((row, idx) => (
                  <tr key={idx}>
                    <td className="w-180">{row.time || row.timestamp || 'n/a'}</td>
                    <td className="w-120">{type==='actions' ? row.action : 'sensor'}</td>
                    <td className="w-180">{row.actor ? `${row.actor.username || ''} (${row.actor.emp_id || ''})` : ''}</td>
                    <td><pre className="m-0 pre-wrap">{JSON.stringify(row.details || row, null, 2)}</pre></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
