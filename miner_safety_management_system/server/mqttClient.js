

const mqtt = require('mqtt');
const WebSocket = require('ws');
const { wss, devices } = require('./wsServer');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const SENSOR_LOG_FILE = path.join(__dirname, 'sensor-log.txt');

// Track last log time per device
const lastLogTimes = {};

const MQTT_URL = process.env.MQTT_URL || 'mqtt://192.168.8.100:1883';
const MQTT_TOPIC = 'health/+';

const client = mqtt.connect(MQTT_URL, {
  reconnectPeriod: 1000,
  keepalive: 60,
});

// ---------------- Threshold / Alert Management -----------------
// Cache thresholds in structured form: { parameter: { caution:{value,exposureMs}, warning:{...}, critical:{...} } }
let thresholdCache = {};
function loadThresholds() {
  db.query('SELECT parameter, caution_threshold, caution_exposure, warning_threshold, warning_exposure, critical_threshold, critical_exposure FROM thresholds', (err, rows) => {
    if (err) { console.error('Threshold load error:', err.message); return; }
    const map = {};
    rows.forEach(r => {
      map[r.parameter] = {
        caution: (r.caution_threshold != null) ? { value: Number(r.caution_threshold), exposureMs: r.caution_exposure ? Number(r.caution_exposure) * 1000 : null } : null,
        warning: (r.warning_threshold != null) ? { value: Number(r.warning_threshold), exposureMs: r.warning_exposure ? Number(r.warning_exposure) * 1000 : null } : null,
        critical: (r.critical_threshold != null) ? { value: Number(r.critical_threshold), exposureMs: r.critical_exposure ? Number(r.critical_exposure) * 1000 : null } : null,
      };
    });
    thresholdCache = map;
    if (process.env.ALERT_DEBUG) {
      console.log('[ALERT_DEBUG] Threshold cache loaded:', JSON.stringify(thresholdCache, null, 2));
    }
  });
}
loadThresholds();
// Periodic refresh every 60s
setInterval(loadThresholds, 60000).unref();

// Active alerts: { [device]: { [parameter]: { severity, startTime, thresholdValue, exposureMs, timer, exposureFired, lastValue } } }
const activeAlerts = {};

function computeSeverity(parameter, value) {
  const th = thresholdCache[parameter];
  if (!th) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (th.critical && num >= th.critical.value) return { level: 'critical', info: th.critical };
  if (th.warning && num >= th.warning.value) return { level: 'warning', info: th.warning };
  if (th.caution && num >= th.caution.value) return { level: 'caution', info: th.caution };
  return null;
}

function broadcastAlert(evt) {
  const payload = JSON.stringify({ type: 'alert', ...evt });
  wss.clients.forEach(ws => { if (ws.readyState === WebSocket.OPEN) { try { ws.send(payload); } catch(_) {} } });
  // Also append to actions.log style file for history (reuse actions.log formatting roughly)
  try {
    const logLine = `${new Date().toISOString()} | ${evt.event === 'start' ? 'alert_started' : (evt.event === 'exposure_elapsed' ? 'alert_exposure_elapsed' : 'alert_cleared')} | ${JSON.stringify(evt)}\n`;
    fs.appendFile(path.join(__dirname, 'actions.log'), logLine, ()=>{});
  } catch(e){}
}

function ensureDeviceAlertBucket(device) {
  if (!activeAlerts[device]) activeAlerts[device] = {};
  return activeAlerts[device];
}

function clearAlert(device, parameter, reason='value_below_threshold') {
  const bucket = activeAlerts[device];
  if (!bucket || !bucket[parameter]) return;
  const current = bucket[parameter];
  if (current.timer) { clearTimeout(current.timer); }
  delete bucket[parameter];
  broadcastAlert({ event: 'cleared', device, parameter, severity: current.severity, reason, clearedAt: new Date().toISOString() });
  if (Object.keys(bucket).length === 0) delete activeAlerts[device];
}

function startAlert(device, parameter, severityObj, value) {
  const { level, info } = severityObj;
  const bucket = ensureDeviceAlertBucket(device);
  const nowIso = new Date().toISOString();
  const alertState = {
    severity: level,
    startTime: nowIso,
    thresholdValue: info ? info.value : null,
    exposureMs: info ? info.exposureMs : null,
    timer: null,
    exposureFired: false,
    lastValue: value
  };
  bucket[parameter] = alertState;
  // Custom high vital temperature message override
  let customMsg = `${parameter} ${level} threshold exceeded (value=${value})`;
  // Parameter name heuristics for body temperature
  const pLower = String(parameter).toLowerCase();
  if (pLower.includes('temp') && Number(value) > 39) {
    // Username not available at this layer; client can enrich if needed.
    customMsg = `Temperature too high (>${39}°C). Immediate attention required.`;
  }
  broadcastAlert({ event: 'start', device, parameter, severity: level, value: Number(value), threshold: alertState.thresholdValue, exposureMs: alertState.exposureMs, startedAt: nowIso, message: customMsg });
  if (alertState.exposureMs && alertState.exposureMs > 0) {
    alertState.timer = setTimeout(() => {
      // Re-check active
      const cur = activeAlerts[device] && activeAlerts[device][parameter];
      if (!cur || cur !== alertState) return;
      // Only fire if still same severity (value hasn't dropped below severity threshold level)
      cur.exposureFired = true;
      broadcastAlert({ event: 'exposure_elapsed', device, parameter, severity: cur.severity, startedAt: cur.startTime, elapsedMs: cur.exposureMs, threshold: cur.thresholdValue, message: `${parameter} ${cur.severity} exposure duration reached` });
    }, alertState.exposureMs);
  }
}

function updateAlert(device, parameter, value) {
  const bucket = activeAlerts[device];
  if (!bucket || !bucket[parameter]) return;
  bucket[parameter].lastValue = value;
}

function handleSeverity(device, parameter, value) {
  const sev = computeSeverity(parameter, value);
  const bucket = activeAlerts[device];
  const existing = bucket && bucket[parameter];
  if (!sev) {
    // below all thresholds -> clear if existed
    if (existing) clearAlert(device, parameter, 'value_recovered');
    if (process.env.ALERT_DEBUG && thresholdCache[parameter]) {
      const t = thresholdCache[parameter];
      console.log(`[ALERT_DEBUG] value below thresholds device=${device} parameter=${parameter} value=${value} thresholds=${JSON.stringify(t)}`);
    }
    if (process.env.ALERT_DEBUG && !thresholdCache[parameter]) {
      console.log(`[ALERT_DEBUG] no thresholds defined for parameter=${parameter} (value=${value})`);
    }
    return;
  }
  if (!existing) {
    startAlert(device, parameter, sev, value);
    return;
  }
  // existing alert present
  const order = { caution:1, warning:2, critical:3 };
  if (order[sev.level] > order[existing.severity]) {
    // escalate: clear old then start new
    clearAlert(device, parameter, 'escalated');
    startAlert(device, parameter, sev, value);
  } else if (order[sev.level] < order[existing.severity]) {
    // actually decreased severity -> treat as recovery of higher severity; start new lower severity alert (optional). Simpler: clear and start new if still above lower.
    clearAlert(device, parameter, 'severity_decrease');
    startAlert(device, parameter, sev, value);
  } else {
    // same severity just update last value
    updateAlert(device, parameter, value);
  }
}

// Expose activeAlerts for apiServer endpoint (lazy require will pick up via require cache)
module.exports.activeAlerts = activeAlerts;

client.on('connect', () => {
  console.log('MQTT connected');
  client.subscribe(MQTT_TOPIC, (err) => {
    if (err) console.error('Subscription error:', err);
  });
});

client.on('message', (topic, payload) => {
  try {
    const data = JSON.parse(payload.toString());
    // Only log every 10 seconds per device
    console.log(JSON.stringify(data));
    const deviceName = data.deviceName || data.device_name || null;
    const now = Date.now();
    if (deviceName) {
      if (!lastLogTimes[deviceName] || now - lastLogTimes[deviceName] >= 10000) {
        lastLogTimes[deviceName] = now;
        const logEntry = {
          type: 'sensor',
          time: new Date().toISOString(),
          ...data
        };
        fs.appendFile(SENSOR_LOG_FILE, JSON.stringify(logEntry) + '\n', (err) => {
          if (err) console.error('Failed to write sensor log:', err);
        });
      }
    }

    if (typeof data !== 'object' || !Object.keys(data).length) {
      throw new Error('Invalid payload: No device keys found');
    }

    // Update in-memory devices snapshot (basic merge)
    if (deviceName) {
      devices[deviceName] = { ...(devices[deviceName] || {}), ...data.sensorData };
    }

    // Unified threshold evaluation (with fallback if sensorData wrapper missing)
    if (deviceName) {
      const collected = {};
      if (data.sensorData) {
        if (data.sensorData.vitals && typeof data.sensorData.vitals === 'object') {
          Object.entries(data.sensorData.vitals).forEach(([p,v]) => { collected[p] = v; });
        }
        if (data.sensorData.environment && typeof data.sensorData.environment === 'object') {
          Object.entries(data.sensorData.environment).forEach(([p,v]) => { collected[p] = v; });
        }
      } else {
        // Fallback: treat top-level numeric fields (excluding known meta keys) as parameters
        Object.entries(data).forEach(([p,v]) => {
          if (['deviceName','device_name','type','time','timestamp'].includes(p)) return;
          if (typeof v === 'number') collected[p] = v;
        });
      }
      // Evaluate severities
      Object.entries(collected).forEach(([param, val]) => handleSeverity(deviceName, param, val));
      if (process.env.ALERT_DEBUG) {
        console.log(`[ALERT_DEBUG] Evaluated parameters for device=${deviceName}: ${Object.keys(collected).join(', ')}`);
      }
    }

    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // Always send a string, not an object
          ws.send(JSON.stringify(data));
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
        }
      }
    });
  } catch (e) {
    console.error('Error processing message:', e.message);
  }
});

client.on('error', (error) => console.error('MQTT error:', error));
client.on('reconnect', () => console.log('Attempting MQTT reconnect...'));
client.on('close', () => console.log('MQTT connection closed'));
client.on('offline', () => console.log('MQTT client is offline'));
client.on('end', () => console.log('MQTT client disconnected'));

module.exports = client;