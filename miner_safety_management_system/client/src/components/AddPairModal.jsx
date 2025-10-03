import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import './css/AddPairModal.css';

export default function AddPairModal({ onClose, onAdd }) {
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchAssignments(); }, []);

  function fetchAssignments() {
    setLoading(true);
    fetch('http://localhost:3001/api/assignments').then(r => r.json()).then(d => setAssignments(d || [])).catch(() => setAssignments([])).finally(() => setLoading(false));
  }

  function add() {
    if (!selected) return;
    const [emp_id, device_id] = selected.split('|');
    onAdd({ emp_id, device_id });
    onClose();
  }

  return ReactDOM.createPortal(
    <div className="apm-backdrop">
      <div className="apm-modal">
        <div className="apm-header"><h3>Select device assignment</h3><button onClick={onClose}>×</button></div>
        <div className="apm-body">
          {loading ? <div>Loading...</div> : (
            <table className="apm-table">
              <thead><tr><th>Device</th><th>Miner</th><th>Select</th></tr></thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={`${a.emp_id}-${a.device_id}`}>
                    <td>{a.device_name} (id:{a.device_id})</td>
                    <td>{a.first_name} {a.surname}</td>
                    <td><input type="radio" name="sel" value={`${a.emp_id}|${a.device_id}`} onChange={e => setSelected(e.target.value)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="apm-footer"><button onClick={add} disabled={!selected}>Add Pair</button></div>
      </div>
    </div>, document.body
  );
}
