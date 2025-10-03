import React, { useEffect, useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { DeviceContext } from './RetrieveData';
import './css/AddDeviceModal.css';

// Reusable AddDeviceModal component
export default function AddDeviceModal({ onClose }) {
  const { devices: availableDevices } = useContext(DeviceContext);
  const [savedDevices, setSavedDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    console.log('AddDeviceModal mounted');
    fetchSavedDevices();
    // trap escape key to close
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); console.log('AddDeviceModal unmounted'); };
  }, []);

  function fetchSavedDevices() {
    setLoading(true);
    fetch('http://localhost:3001/api/devices')
      .then(res => res.json())
      .then(data => setSavedDevices(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load devices', err))
      .finally(() => setLoading(false));
  }

  function addDevice(name) {
    if (!name) return setMessage({ type: 'error', text: 'Device name required' });
    if (savedDevices.find(d => d.device_name === name)) return setMessage({ type: 'error', text: 'Device already saved' });
    setLoading(true);
    fetch('http://localhost:3001/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_name: name })
    })
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to add');
        }
        return res.json();
      })
      .then(() => {
        setMessage({ type: 'success', text: 'Device added' });
        fetchSavedDevices();
      })
      .catch(err => setMessage({ type: 'error', text: String(err) }))
      .finally(() => setLoading(false));
  }

  function deleteDevice(id) {
    if (!confirm('Delete this device?')) return;
    setLoading(true);
    fetch(`http://localhost:3001/api/devices/${id}`, { method: 'DELETE' })
      .then(async res => {
        if (!res.ok) throw new Error('Failed to delete');
        return res.json();
      })
      .then(() => {
        setMessage({ type: 'success', text: 'Device deleted' });
        fetchSavedDevices();
      })
      .catch(err => setMessage({ type: 'error', text: String(err) }))
      .finally(() => setLoading(false));
  }

  const savedNames = new Set(savedDevices.map(d => d.device_name));

  const modalContent = (
    <div className="modal-backdrop-debug">
      <div className="modal-debug" role="dialog" aria-modal="true">
        <h3>Add / Manage Devices</h3>

        {message && (
          <div className={`mb-2 ${message.type === 'error' ? 'text-danger' : 'text-success'}`}>{message.text}</div>
        )}

        <div className="d-flex gap-3">
          <div className="flex-1">
            <h4>Saved Devices</h4>
            <table className="table">
              <thead>
                <tr><th>ID</th><th>Name</th><th>Action</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="text-muted">Loading...</td></tr>
                ) : savedDevices.length === 0 ? (
                  <tr><td colSpan={3} className="text-muted">No saved devices</td></tr>
                ) : (
                  savedDevices.map(d => (
                    <tr key={d.device_id}>
                      <td>{d.device_id}</td>
                      <td>{d.device_name}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => deleteDevice(d.device_id)}>Delete</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* removed custom-add input as requested */}
          </div>

          <div className="flex-1">
            <h4>Available Devices (Realtime)</h4>
            <ul>
              {availableDevices && Object.keys(availableDevices).length > 0 ? (
                Object.keys(availableDevices)
                  .filter(k => !savedNames.has(k))
                  .map(k => (
                    <li key={k} className="d-flex justify-content-between align-items-center gap-2">
                      <span>{k}</span>
                      <div>
                        <button className="btn btn-sm btn-primary" onClick={() => addDevice(k)}>Add</button>
                      </div>
                    </li>
                  ))
              ) : (
                <li>No available realtime devices</li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-3 text-end">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
