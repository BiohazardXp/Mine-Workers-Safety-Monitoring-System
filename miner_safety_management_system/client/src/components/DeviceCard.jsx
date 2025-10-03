
import React, { useContext, useEffect, useState } from 'react';
import { DeviceContext } from './RetrieveData';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTemperatureHigh, faHeartPulse, faBiohazard, faCloudRain, faWind, faGasPump, faSmog, faCloud, faCompress, faWater } from '@fortawesome/free-solid-svg-icons';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import ReactDOM from 'react-dom';

const DeviceCard = ({ deviceId, deviceName: initialDeviceName, minerName: initialMinerName, onRemove }) => {
  const { devices } = useContext(DeviceContext);

  // Helper to safely format numeric readings
  const fmt = (v, digits = 2) => {
    if (v === undefined || v === null) return 'N/A';
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return n.toFixed(digits);
  };
  // Keep state hooks first to avoid temporal-dead-zone access from resolver
  const [deviceName, setDeviceName] = useState(initialDeviceName);
  const [minerName, setMinerName] = useState(initialMinerName);
  const [thresholds, setThresholds] = useState(null);
  const [alarmActive, setAlarmActive] = useState(false);
  const highTempTriggeredRef = React.useRef(false);

  // webaudio oscillator reference
  const audioRef = React.useRef(null);

  // Resolve the device entry from the WebSocket `devices` object.
  // WebSocket keys may be device names (e.g. "device2") while the DB uses numeric device_id.
  // Try multiple strategies so DeviceCard shows data whether passed a deviceName or a deviceId.
  const resolveDeviceFromContext = () => {
    if (!devices) return null;
    // Prefer lookup by deviceName (if known)
    if (deviceName && devices[deviceName]) return devices[deviceName];
    // Then try direct lookup by deviceId key (some setups key by id)
    if (devices[String(deviceId)]) return devices[String(deviceId)];

    // Otherwise, try to find a matching entry by inspecting the values for possible id/name fields
    const entries = Object.entries(devices);
    for (const [key, val] of entries) {
      if (!val) continue;
      // match common shapes that might include device id or name
      if (val.device_id && String(val.device_id) === String(deviceId)) return val;
      if (val.device_name && deviceName && val.device_name === deviceName) return val;
      if (key === String(deviceId) || key === deviceName) return val;
    }
    return null;
  };

  const device = resolveDeviceFromContext();

  useEffect(() => {
    let mounted = true;
    if ((!deviceName || !minerName) && deviceId) {
      fetch(`http://localhost:3001/api/device-info/${deviceId}`).then(r => r.json()).then(d => {
        if (!mounted) return;
        if (d && d.device_name) setDeviceName(d.device_name);
        if (d && d.first_name) setMinerName(`${d.first_name} ${d.surname}`);
      }).catch(() => {});
    }
    // fetch thresholds once
    fetch('http://localhost:3001/api/thresholds').then(r => r.json()).then(d => { if (mounted) setThresholds(d); }).catch(() => {});
    return () => { mounted = false; };
  }, [deviceId]);
  // helper to get threshold for a parameter
  const getThresholdFor = (parameter) => {
    if (!thresholds) return null;
    return thresholds.find(t => t.parameter === parameter) || null;
  };

  // play alarm tone
  const startAlarm = () => {
    if (audioRef.current) return; // already playing
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      audioRef.current = { ctx, o, g };
    } catch (e) { console.warn('Audio start failed', e); }
  };

  const stopAlarm = () => {
    if (!audioRef.current) return;
    try {
      const { o, ctx } = audioRef.current;
      o.stop();
      ctx.close();
    } catch (e) { }
    audioRef.current = null;
  };

  // compute severity helper: returns 'ok'|'caution'|'warning'|'critical'
  const severityFor = (parameter, value) => {
    const th = getThresholdFor(parameter);
    if (!th) return 'ok';
    const num = Number(value);
    if (Number.isNaN(num)) return 'ok';
    if (th.critical_threshold !== null && th.critical_threshold !== undefined && num >= Number(th.critical_threshold)) return 'critical';
    if (th.warning_threshold !== null && th.warning_threshold !== undefined && num >= Number(th.warning_threshold)) return 'warning';
    if (th.caution_threshold !== null && th.caution_threshold !== undefined && num >= Number(th.caution_threshold)) return 'caution';
    return 'ok';
  };

  // check for any criticals to activate alarm
  useEffect(() => {
    if (!device || !thresholds) return;
    let anyCritical = false;
    // check vitals
    if (device.vitals) {
      if (severityFor('bodyTemp', device.vitals.bodyTemp) === 'critical') anyCritical = true;
      if (severityFor('heartRate', device.vitals.heartRate) === 'critical') anyCritical = true;
    }
    if (device.environment) {
      const params = ['carbonMonoxide','ammonia','hydrogenSulfide','sulphurDioxide','nitrogenDioxide','methane','temperature','pressure','humidity'];
      for (const p of params) {
        if (severityFor(p, device.environment[p]) === 'critical') { anyCritical = true; break; }
      }
    }
    if (anyCritical) {
    //setAlarmActive(true);
    //startAlarm();
    } else {
      setAlarmActive(false);
      stopAlarm();
    }
  }, [device, thresholds]);

  // Simple front-end only high body temperature alert ( > 39°C )
  useEffect(() => {
    if (!device || !device.vitals) return;
    const temp = Number(device.vitals.bodyTemp);
    if (Number.isFinite(temp) && temp > 39) {
      if (!highTempTriggeredRef.current) {
        highTempTriggeredRef.current = true;
        const name = minerName || (deviceName || 'Miner');
        // Beep for 3 seconds
        startAlarm();
        setTimeout(() => { stopAlarm(); }, 3000);
        // Simple browser alert
        try { alert(`${name} is in trouble, temperature too high (${temp.toFixed(2)} °C)`); } catch(_) {}
        // Reset flag after a cooldown (30s) so future sustained issues can alert again
        setTimeout(() => { highTempTriggeredRef.current = false; }, 30000);
      }
    }
  }, [device?.vitals?.bodyTemp, minerName, deviceName]);

  // acknowledge handler
  const acknowledgeAlarm = () => {
    setAlarmActive(false);
    stopAlarm();
  };

  if (!device) {
    // Debug panel: show available realtime keys so we can map them
    const availableKeys = devices ? Object.keys(devices) : [];
    console.debug('DeviceCard lookup failed for deviceId=', deviceId, 'deviceName=', deviceName, 'availableKeys=', availableKeys);
    return (
      <div className="admin-device-card">
        <div className="flex-row-center-between">
          <div className="font-bold-16">{deviceName || deviceId}</div>
          {onRemove && <button onClick={() => onRemove(deviceId)} className="btn-remove">Remove</button>}
        </div>
        <div>No realtime data available</div>
        {availableKeys.length > 0 && (
          <div className="mt-8 fs-12 text-gray-666">
            <div className="fw-600">Available realtime keys:</div>
            <ul className="m-0 pl-16">
              {availableKeys.map(k => <li key={k}>{k}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // render acknowledge modal when alarmActive
  const alarmModal = alarmActive ? ReactDOM.createPortal(
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Critical alarm</h3>
        <p>One or more readings exceeded critical thresholds.</p>
        <div className="text-right">
          <button className="btn btn-primary" onClick={acknowledgeAlarm}>Acknowledge</button>
        </div>
      </div>
    </div>, document.body
  ) : null;
  return (
    <div className="devicecard-wrapper">
      {alarmModal}
      <div className="admin-device-card p-6 bg-white rounded-lg shadow mb-6">
        <div className="flex-row-center-between">
          <div className="font-bold text-lg mb-4">{deviceName || deviceId} {minerName ? ` - ${minerName}` : ''}</div>
          {onRemove && <button onClick={() => onRemove(deviceId)} className="btn-remove">Remove</button>}
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Vitals Section: 1 column */}
          {device.vitals && (
            <div className="flex-1">
              <div className="font-semibold text-blue-700 mb-2">Vitals</div>
              <div className="flex flex-col gap-4 bg-blue-50 rounded p-4">
                  {(() => {
                    const s1 = severityFor('bodyTemp', device.vitals.bodyTemp);
                    const s2 = severityFor('heartRate', device.vitals.heartRate);
                    return (
                      <>
                        <div className={`flex items-center gap-4 text-base flex-wrap ${ (s1 !== 'ok' || s2 !== 'ok') ? 'font-semibold' : '' }`}>
                          <span className={`flex items-center gap-1 ${s1 !== 'ok' ? 'sev-' + s1 : ''}`}> <FontAwesomeIcon icon={faTemperatureHigh} /> {fmt(device.vitals.bodyTemp)}°C {s1 !== 'ok' && <FontAwesomeIcon icon={faTriangleExclamation} />}</span>
                          <span className={`flex items-center gap-1 ${s2 !== 'ok' ? 'sev-' + s2 : ''}`}> <FontAwesomeIcon icon={faHeartPulse} /> {fmt(device.vitals.heartRate)} bpm {s2 !== 'ok' && <FontAwesomeIcon icon={faTriangleExclamation} />}</span>
                        </div>
                      </>
                    );
                  })()}
              </div>
            </div>
          )}
          {/* Environment Section: 3 columns */}
          {device.environment && (
            <div className="flex-2">
              <div className="font-semibold text-green-700 mb-2">Environment</div>
              <div className="grid grid-cols-3 gap-4 bg-green-50 rounded p-4">
                {(() => {
                  const env = device.environment || {};
                  const items = [
                    { key: 'carbonMonoxide', icon: faBiohazard, label: 'CO', unit: 'ppm' },
                    { key: 'ammonia', icon: faCloudRain, label: 'Ammonia', unit: 'ppm' },
                    { key: 'hydrogenSulfide', icon: faGasPump, label: 'H₂S', unit: 'ppm' },
                    { key: 'sulphurDioxide', icon: faSmog, label: 'SO₂', unit: 'ppm' },
                    { key: 'nitrogenDioxide', icon: faCloud, label: 'NO₂', unit: 'ppm' },
                    { key: 'methane', icon: faWind, label: 'Methane', unit: 'ppm' },
                    { key: 'temperature', icon: faTemperatureHigh, label: 'Temp', unit: '°C' },
                    { key: 'pressure', icon: faCompress, label: 'Pressure', unit: 'hPa' },
                    { key: 'humidity', icon: faWater, label: 'Humidity', unit: '%' },
                  ];
                  return items.map(it => {
                    const sev = severityFor(it.key, env[it.key]);
                    return (
                      <div key={it.key} className={`flex items-center gap-2 text-base ${sev !== 'ok' ? 'sev-' + sev : ''} min-w-0`}>
                        <FontAwesomeIcon icon={it.icon} /> {it.label}: {fmt(env[it.key])} {it.unit} {sev !== 'ok' && <FontAwesomeIcon icon={faTriangleExclamation} />}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceCard;
