import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import './css/SetThresholdModal.css';

function SetThresholdModal({ onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRows();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function fetchRows() {
    setLoading(true);
    fetch('http://localhost:3001/api/thresholds').then(r => r.json()).then(d => setRows(d || [])).catch(err => { console.error(err); setError('Failed to load'); }).finally(() => setLoading(false));
  }

  function updateRow(id, patch) {
    setError('');
    fetch(`http://localhost:3001/api/thresholds/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      .then(r => r.json()).then(j => { if (j && j.error) setError(j.error); else fetchRows(); }).catch(err => { console.error(err); setError('Update failed'); });
  }

  const content = (
    <div className="stm-backdrop">
      <div className="stm-modal" role="dialog" aria-modal="true">
        <div className="stm-header">
          <h3>Set Thresholds</h3>
          <button className="stm-close" onClick={onClose}>×</button>
        </div>
        <div className="stm-body">
          {loading ? <div>Loading...</div> : (
            <>
              {error && <div className="stm-error">{error}</div>}
              <table className="stm-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Unit</th>
                    <th>Caution</th>
                    <th>Caution Exposure</th>
                    <th>Warning</th>
                    <th>Warning Exposure</th>
                    <th>Critical</th>
                    <th>Critical Exposure</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <ThresholdRow key={r.parameter} row={r} onSave={(patch) => updateRow(r.parameter, patch)} />
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}

function ThresholdRow({ row, onSave }) {
  const [caution, setCaution] = useState(row.caution_threshold);
  const [cautionExposure, setCautionExposure] = useState(row.caution_exposure || '');
  const [warning, setWarning] = useState(row.warning_threshold);
  const [warningExposure, setWarningExposure] = useState(row.warning_exposure || '');
  const [critical, setCritical] = useState(row.critical_threshold);
  const [criticalExposure, setCriticalExposure] = useState(row.critical_exposure || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave({
      caution_threshold: caution,
      caution_exposure: cautionExposure,
      warning_threshold: warning,
      warning_exposure: warningExposure,
      critical_threshold: critical,
      critical_exposure: criticalExposure,
    });
    setSaving(false);
  };

  return (
    <tr>
      <td>{row.parameter}</td>
      <td>{row.unit}</td>
      <td><input type="number" value={caution} onChange={e => setCaution(e.target.value)} /></td>
      <td><input type="text" value={cautionExposure} onChange={e => setCautionExposure(e.target.value)} placeholder="e.g. 10m" /></td>
      <td><input type="number" value={warning} onChange={e => setWarning(e.target.value)} /></td>
      <td><input type="text" value={warningExposure} onChange={e => setWarningExposure(e.target.value)} placeholder="e.g. 5m" /></td>
      <td><input type="number" value={critical} onChange={e => setCritical(e.target.value)} /></td>
      <td><input type="text" value={criticalExposure} onChange={e => setCriticalExposure(e.target.value)} placeholder="e.g. 1m" /></td>
      <td><button disabled={saving} onClick={save}>Save</button></td>
    </tr>
  );
}

export default SetThresholdModal;
