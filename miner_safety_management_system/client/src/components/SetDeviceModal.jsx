import React, { useEffect, useState, useContext } from 'react';
import ReactDOM from 'react-dom';
import './css/SetDeviceModal.css';
import { DeviceContext } from './RetrieveData';

function SetDeviceModal({ onClose }) {
  const ctx = useContext(DeviceContext) || {};
  const realtimeDevicesRaw = ctx.devices;
  // normalize realtime devices into an array of strings
  const realtimeDeviceNames = (() => {
    const d = realtimeDevicesRaw;
    if (Array.isArray(d)) return d;
    if (!d || typeof d !== 'object') return [];
    const names = new Set();
    const walk = (o) => {
      if (!o) return;
      if (typeof o === 'string') { names.add(o); return; }
      if (typeof o === 'object') {
        if (o.device_name) names.add(o.device_name);
        if (o.deviceName) names.add(o.deviceName);
        if (o.name) names.add(o.name);
        Object.values(o).forEach(v => walk(v));
      }
    };
    walk(d);
    return Array.from(names);
  })();
  const [assignments, setAssignments] = useState([]); // {device_id, device_name, emp_id, first_name, surname}
  const [unassignedMiners, setUnassignedMiners] = useState([]); // {emp_id, first_name, surname}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetchAll();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fetchAll() {
    setLoading(true);
    Promise.all([
      fetch('http://localhost:3001/api/assignments').then(r => r.json()),
      fetch('http://localhost:3001/api/unassigned-miners').then(r => r.json()),
    ]).then(([a, u]) => {
      setAssignments(a || []);
      setUnassignedMiners(u || []);
    }).catch(err => console.error('Failed to load assignments/miners', err))
      .finally(() => setLoading(false));
  }

  async function handleAssign(deviceIdOrName, empId) {
    setError('');
    setWorking(true);
    try {
      let device_id = deviceIdOrName;
      // if the selected value is a name (non-numeric), create the device first
      if (isNaN(Number(device_id))) {
        const resp = await fetch('http://localhost:3001/api/devices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_name: device_id }) });
        if (!resp.ok) { const text = await resp.text(); setError(text || 'Failed to create device'); setWorking(false); return; }
        const json = await resp.json();
        device_id = json.device_id;
      }
      const resp2 = await fetch('http://localhost:3001/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_id: device_id, emp_id: empId }) });
      if (!resp2.ok) {
        const json = await resp2.json().catch(() => null);
        setError((json && json.error) || `Assign failed (${resp2.status})`);
        setWorking(false);
        return;
      }
      await fetchAll();
    } catch (err) {
      console.error('handleAssign error', err);
      setError('Network error');
    } finally {
      setWorking(false);
    }
  }

  async function handleUnassign(empId, deviceId) {
    setError('');
    setWorking(true);
    try {
      const resp = await fetch(`http://localhost:3001/api/assignments?emp_id=${empId}&device_id=${deviceId}`, { method: 'DELETE' });
      if (!resp.ok) { const json = await resp.json().catch(() => null); setError((json && json.error) || `Unassign failed (${resp.status})`); setWorking(false); return; }
      await fetchAll();
    } catch (err) {
      console.error('handleUnassign error', err);
      setError('Network error');
    } finally { setWorking(false); }
  }

  // Render UI
  const content = (
    <div className="sdm-backdrop">
      <div className="sdm-modal" role="dialog" aria-modal="true">
        <div className="sdm-header">
          <h3>Set Device to Miner</h3>
          <button className="sdm-close" onClick={onClose}>×</button>
        </div>
        <div className="sdm-body">
          {loading ? <div>Loading...</div> : (
            <>
              {error && <div className="sdm-error">{error}</div>}
              <section className="sdm-section">
                <h4>Assigned Devices</h4>
                <table className="sdm-table">
                  <thead>
                    <tr><th>Device Name</th><th>Employee</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 && (
                      <tr><td colSpan={3}>No assignments found</td></tr>
                    )}
                    {assignments.map(asg => (
                      <tr key={`${asg.emp_id}-${asg.device_id}`}>
                        <td>{asg.device_name}</td>
                        <td>{asg.first_name} {asg.surname}</td>
                        <td>
                          <button className="btn btn-sm btn-warning" disabled={working} onClick={() => handleUnassign(asg.emp_id, asg.device_id)}>Unassign</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="sdm-section">
                <h4>Unassigned Miners</h4>
                {unassignedMiners.length === 0 ? <div>No available miners</div> : (
                  <table className="sdm-table">
                    <thead>
                      <tr><th>Employee</th><th>Assign Device</th></tr>
                    </thead>
                    <tbody>
                      {unassignedMiners.map(emp => (
                        <tr key={emp.emp_id}>
                          <td>{emp.first_name} {emp.surname}</td>
                          <td>
                            {/* show a select of available devices (from devicedb / realtime) */}
                            <DeviceAssignSelect
                              empId={emp.emp_id}
                              onAssign={(deviceId) => handleAssign(deviceId, emp.emp_id)}
                              disabled={working}
                              assignments={assignments}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

            </>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

function DeviceAssignSelect({ empId, onAssign, disabled, assignments = [] }) {
  const ctx = useContext(DeviceContext) || {};
  const realtimeDevicesRaw = ctx.devices;
  // normalize realtime devices into names array (same logic as parent)
  const realtimeDeviceNames = (() => {
    const d = realtimeDevicesRaw;
    if (Array.isArray(d)) return d;
    if (!d || typeof d !== 'object') return [];
    const names = new Set();
    const walk = (o) => {
      if (!o) return;
      if (typeof o === 'string') { names.add(o); return; }
      if (typeof o === 'object') {
        if (o.device_name) names.add(o.device_name);
        if (o.deviceName) names.add(o.deviceName);
        if (o.name) names.add(o.name);
        Object.values(o).forEach(v => walk(v));
      }
    };
    walk(d);
    return Array.from(names);
  })();
  const [savedDevices, setSavedDevices] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/devices').then(r => r.json()).then(d => setSavedDevices(d || [])).catch(() => setSavedDevices([]));
  }, []);

  // build options as {device_id, device_name} combining savedDevices and realtime device names (realtime won't have ids)
  const assignedNames = new Set((assignments || []).map(a => a.device_name).filter(Boolean));
  const assignedIds = new Set((assignments || []).map(a => String(a.device_id)).filter(Boolean));

  const realtimeOnly = (realtimeDeviceNames || []).filter(n => !(savedDevices || []).some(d => d.device_name === n) && !assignedNames.has(n)).map(n => ({ device_id: null, device_name: n }));
  const allDevices = [...(savedDevices || []).map(d => ({ device_id: d.device_id, device_name: d.device_name })), ...realtimeOnly]
    .filter(d => !assignedIds.has(String(d.device_id)) && !(assignedNames.has(d.device_name)));

  return (
    <div className="sdm-assign-select">
      <select value={selected} onChange={e => setSelected(e.target.value)} disabled={disabled}>
        <option value="">-- select device --</option>
        {allDevices.map(d => <option key={`${d.device_id || 'rt'}-${d.device_name}`} value={d.device_id || d.device_name}>{d.device_name}{d.device_id ? ` (id:${d.device_id})` : ' (realtime)'}</option>)}
      </select>
      <button className="btn btn-sm btn-primary" disabled={!selected || disabled} onClick={() => { onAssign(selected); setSelected(''); }}>Assign</button>
    </div>
  );
}

export default SetDeviceModal;
