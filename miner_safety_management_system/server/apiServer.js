


// ...existing code...

// (Move this endpoint after all require statements and app initialization)

const express = require('express');
const cors = require('cors');
const app = express();
const db = require('./db');
const fs = require('fs');
const path = require('path');
// Access active alerts from mqttClient (require after it sets export)
let activeAlertsRef = null;
try { activeAlertsRef = require('./mqttClient').activeAlerts; } catch(e) { activeAlertsRef = {}; }

// Ensure CORS and JSON body parsing are set before any routes
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Serve parsed sensor log data for a device
app.get('/api/sensor-log/:deviceName', (req, res) => {
  const deviceName = req.params.deviceName;
  const logPath = path.join(__dirname, 'sensor-log.txt');
  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Failed to read sensor log' });
    const lines = data.split('\n').filter(Boolean);
    const result = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.deviceName === deviceName) {
          // Attach timestamp if present, else use file order
          result.push({ ...entry, _logTime: entry.time || null });
        }
      } catch {}
    }
    res.json(result);
  });
});



const LOG_FILE = path.join(__dirname, 'actions.log');

function logAction(action, details = {}, actor = null) {
  const time = new Date().toISOString();
  const actorPart = actor ? `actor=${JSON.stringify(actor)} | ` : '';
  const entry = `${time} | ${action} | ${actorPart}${JSON.stringify(details)}\n`;
  fs.appendFile(LOG_FILE, entry, (err) => {
    if (err) console.error('Failed to write log:', err);
  });
}

// Produce a short human-readable summary for common actions
function generateSummary(action, details = {}, actor = null) {
  try {
    const d = details || {};
    const a = actor || {};
    switch (action) {
      case 'device_added':
        return d.device_name ? `Added device '${d.device_name}' (id ${d.device_id || 'unknown'}).` : `Added device id ${d.device_id || 'unknown'}.`;
      case 'device_deleted':
        return `Deleted device id ${d.device_id || 'unknown'}.`;
      case 'device_assigned':
        return `Assigned device ${d.device_id || 'unknown'} to employee ${d.emp_id || 'unknown'}.`;
      case 'device_unassigned':
        return `Unassigned device ${d.device_id || 'unknown'} from employee ${d.emp_id || 'unknown'}.`;
      case 'employee_added':
        return `Added employee ${d.first_name || ''} ${d.surname || ''}`.trim() + (d.emp_id ? ` (id ${d.emp_id}).` : '.');
      case 'employee_updated':
        return `Updated employee ${d.first_name || ''} ${d.surname || ''}`.trim() + (d.emp_id ? ` (id ${d.emp_id}).` : '.');
      case 'employee_deleted':
        return `Deleted employee id ${d.emp_id || 'unknown'}.`;
      case 'login_created':
        return d.username ? `Created login for '${d.username}' (${d.position || 'role unknown'}).` : `Created login id ${d.id || 'unknown'}.`;
      case 'login_deleted':
        return `Deleted login id ${d.id || 'unknown'}.`;
      case 'threshold_updated':
      case 'threshold_set':
        return d.parameter ? `Updated thresholds for ${d.parameter}.` : 'Updated thresholds.';
      default:
        // Try to generate a concise fallback from details
        const keys = Object.keys(d || {});
        if (keys.length === 0) return `${action.replace(/[_-]/g, ' ')}.`;
        const summaryParts = keys.slice(0, 4).map(k => `${k}=${JSON.stringify(d[k])}`);
        return `${action.replace(/[_-]/g, ' ')}: ${summaryParts.join(', ')}.`;
    }
  } catch (e) {
    return action;
  }
}

// middleware to extract actor info from headers (optional)
app.use((req, res, next) => {
  const actorId = req.headers['x-actor-id'] || req.headers['x_emp_id'] || null;
  const actorUsername = req.headers['x-actor-username'] || req.headers['x_username'] || null;
  req.actor = actorId || actorUsername ? { emp_id: actorId || null, username: actorUsername || null } : null;
  next();
});

// Sample API endpoint (kept for backward compatibility)
app.get('/api/data', (req, res) => {
  db.query('SELECT * FROM your_table LIMIT 10', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Devices: CRUD for devicedb (device_id, device_name)
app.get('/api/devices', (req, res) => {
  db.query('SELECT device_id, device_name FROM devicedb ORDER BY device_id', (err, results) => {
    if (err) { console.error('GET /api/devices error:', err); return res.status(500).json({ error: err.message }); }
    res.json(results);
  });
});

app.post('/api/devices', (req, res) => {
  const { device_name } = req.body;
  if (!device_name) return res.status(400).json({ error: 'device_name is required' });
  db.query('INSERT INTO devicedb (device_name) VALUES (?)', [device_name], (err, result) => {
    if (err) { console.error('POST /api/devices error:', err); return res.status(500).json({ error: err.message }); }
    const insertedId = result.insertId;
    logAction('device_added', { device_id: insertedId, device_name }, req.actor);
    res.json({ device_id: insertedId, device_name });
  });
});

app.delete('/api/devices/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM devicedb WHERE device_id = ?', [id], (err, result) => {
    if (err) { console.error('DELETE /api/devices/:id error:', err); return res.status(500).json({ error: err.message }); }
    logAction('device_deleted', { device_id: id }, req.actor);
    res.json({ success: true });
  });
});

// Assignments: join device_assignment, devicedb, employees
app.get('/api/assignments', (req, res) => {
  // Return current assignments with device_id and device_name
  const q = `SELECT da.emp_id, da.device_id, d.device_name, e.first_name, e.surname
    FROM device_assignment da
    LEFT JOIN devicedb d ON da.device_id = d.device_id
    LEFT JOIN employees e ON da.emp_id = e.emp_id
    ORDER BY da.emp_id`;
  db.query(q, (err, results) => {
    if (err) { console.error('GET /api/assignments error:', err); return res.status(500).json({ error: err.message }); }
    res.json(results);
  });
});

// Device info by id: device_name and currently assigned miner (if any)
app.get('/api/device-info/:device_id', (req, res) => {
  const device_id = req.params.device_id;
  const q = `SELECT d.device_id, d.device_name, da.emp_id, e.first_name, e.surname
    FROM devicedb d
    LEFT JOIN device_assignment da ON d.device_id = da.device_id
    LEFT JOIN employees e ON da.emp_id = e.emp_id
    WHERE d.device_id = ? LIMIT 1`;
  db.query(q, [device_id], (err, results) => {
    if (err) { console.error('GET /api/device-info error:', err); return res.status(500).json({ error: err.message }); }
    if (!results || results.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json(results[0]);
  });
});

// Get miners without assignments
app.get('/api/unassigned-miners', (req, res) => {
  const q = `SELECT e.emp_id, e.first_name, e.surname
    FROM employees e
    WHERE e.position = 'miner' AND e.emp_id NOT IN (SELECT emp_id FROM device_assignment)`;
  db.query(q, (err, results) => {
    if (err) { console.error('GET /api/unassigned-miners error:', err); return res.status(500).json({ error: err.message }); }
    res.json(results);
  });
});

// Thresholds endpoints
app.get('/api/thresholds', (req, res) => {
  db.query('SELECT parameter, unit, caution_threshold, caution_exposure, warning_threshold, warning_exposure, critical_threshold, critical_exposure FROM thresholds', (err, results) => {
    if (err) { console.error('GET /api/thresholds error:', err); return res.status(500).json({ error: err.message }); }
    res.json(results);
  });
});

// Active alerts endpoint
app.get('/api/active-alerts', (req, res) => {
  const out = [];
  const src = activeAlertsRef || {};
  Object.entries(src).forEach(([device, params]) => {
    Object.entries(params).forEach(([parameter, st]) => {
      out.push({
        device,
        parameter,
        severity: st.severity,
        startTime: st.startTime,
        thresholdValue: st.thresholdValue,
        exposureMs: st.exposureMs,
        exposureFired: st.exposureFired,
        lastValue: st.lastValue
      });
    });
  });
  res.json(out);
});

app.put('/api/thresholds/:parameter', (req, res) => {
  const parameter = req.params.parameter;
  const { caution_threshold, caution_exposure, warning_threshold, warning_exposure, critical_threshold, critical_exposure } = req.body;
  // Validate required fields
  if (caution_threshold === undefined || warning_threshold === undefined || critical_threshold === undefined) return res.status(400).json({ error: 'caution_threshold, warning_threshold and critical_threshold required' });
  const q = `UPDATE thresholds SET caution_threshold = ?, caution_exposure = ?, warning_threshold = ?, warning_exposure = ?, critical_threshold = ?, critical_exposure = ? WHERE parameter = ?`;
  const params = [caution_threshold, caution_exposure || null, warning_threshold, warning_exposure || null, critical_threshold, critical_exposure || null, parameter];
  db.query(q, params, (err, result) => {
    if (err) { console.error('PUT /api/thresholds/:parameter error:', err); return res.status(500).json({ error: err.message }); }
    logAction('threshold_updated', { parameter, caution_threshold, caution_exposure, warning_threshold, warning_exposure, critical_threshold, critical_exposure });
    res.json({ success: true });
  });
});

// Create assignment (use device_id)
app.post('/api/assignments', (req, res) => {
  const { emp_id, device_id } = req.body;
  if (!emp_id || !device_id) return res.status(400).json({ error: 'emp_id and device_id are required' });
  // Prevent assigning the same device to multiple users
  db.query('SELECT 1 FROM device_assignment WHERE device_id = ? LIMIT 1', [device_id], (err, rows) => {
    if (err) { console.error('POST /api/assignments pre-check error:', err); return res.status(500).json({ error: err.message }); }
    if (rows && rows.length > 0) {
      return res.status(409).json({ error: 'device_already_assigned' });
    }
      db.query('INSERT INTO device_assignment (emp_id, device_id) VALUES (?, ?)', [emp_id, device_id], (err2, result) => {
        if (err2) { console.error('POST /api/assignments error:', err2); return res.status(500).json({ error: err2.message }); }
        logAction('device_assigned', { emp_id, device_id }, req.actor);
        res.json({ success: true });
      });
  });
});

// Delete/unassign by emp_id & device_id (query params)
app.delete('/api/assignments', (req, res) => {
  const emp_id = req.query.emp_id;
  const device_id = req.query.device_id;
  if (!emp_id || !device_id) return res.status(400).json({ error: 'emp_id and device_id are required (query params)' });
  db.query('DELETE FROM device_assignment WHERE emp_id = ? AND device_id = ?', [emp_id, device_id], (err, result) => {
    if (err) { console.error('DELETE /api/assignments error:', err); return res.status(500).json({ error: err.message }); }
    logAction('device_unassigned', { emp_id, device_id }, req.actor);
    res.json({ success: true });
  });
});

// Login endpoint
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query('SELECT position FROM login WHERE username = ? AND password = ?', [username, password], (err, results) => {
    if (err) { console.error('POST /api/login error:', err); return res.status(500).json({ error: 'Database error' }); }
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    // Return position for conditional rendering
    res.json({ success: true, position: results[0].position });
  });
});

// Employees CRUD
app.get('/api/employees', (req, res) => {
  db.query('SELECT emp_id, first_name, surname, position FROM employees ORDER BY emp_id', (err, results) => {
    if (err) { console.error('GET /api/employees error:', err); return res.status(500).json({ error: err.message }); }
    res.json(results);
  });
});

app.post('/api/employees', (req, res) => {
  const { first_name, surname, position } = req.body;
  if (!first_name || !surname || !position) return res.status(400).json({ error: 'first_name, surname and position required' });
  db.query('INSERT INTO employees (first_name, surname, position) VALUES (?, ?, ?)', [first_name, surname, position], (err, result) => {
    if (err) { console.error('POST /api/employees error:', err); return res.status(500).json({ error: err.message }); }
    const emp_id = result.insertId;
    logAction('employee_added', { emp_id, first_name, surname, position }, req.actor);
    res.json({ emp_id, first_name, surname, position });
  });
});

app.put('/api/employees/:id', (req, res) => {
  const id = req.params.id;
  const { first_name, surname, position } = req.body;
  db.query('UPDATE employees SET first_name = ?, surname = ?, position = ? WHERE emp_id = ?', [first_name, surname, position, id], (err, result) => {
    if (err) { console.error('PUT /api/employees/:id error:', err); return res.status(500).json({ error: err.message }); }
    logAction('employee_updated', { emp_id: id, first_name, surname, position }, req.actor);
    res.json({ success: true });
  });
});

app.delete('/api/employees/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM employees WHERE emp_id = ?', [id], (err, result) => {
    if (err) { console.error('DELETE /api/employees/:id error:', err); return res.status(500).json({ error: err.message }); }
    logAction('employee_deleted', { emp_id: id }, req.actor);
    res.json({ success: true });
  });
});

// Login (user accounts) management
app.get('/api/logins', (req, res) => {
  db.query('SELECT id, username, position FROM login ORDER BY id', (err, results) => {
    if (err) { console.error('GET /api/logins error:', err); return res.status(500).json({ error: err.message }); }
    res.json(results);
  });
});

app.post('/api/logins', (req, res) => {
  const { id, username, position, password } = req.body; // id should match employee id
  if (!id || !username || !position || !password) return res.status(400).json({ error: 'id, username, position and password required' });
  if (!['supervisor','admin'].includes(position)) return res.status(400).json({ error: 'position must be supervisor or admin' });
  db.query('INSERT INTO login (id, username, position, password) VALUES (?, ?, ?, ?)', [id, username, position, password], (err, result) => {
    if (err) { console.error('POST /api/logins error:', err); return res.status(500).json({ error: err.message }); }
    logAction('login_created', { id, username, position }, req.actor);
    res.json({ success: true });
  });
});

app.delete('/api/logins/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM login WHERE id = ?', [id], (err, result) => {
    if (err) { console.error('DELETE /api/logins/:id error:', err); return res.status(500).json({ error: err.message }); }
    logAction('login_deleted', { id }, req.actor);
    res.json({ success: true });
  });
});

// Start Express server on port 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`REST API server running on http://localhost:${PORT}`);
});

// --- Log reading endpoints ---
// Parse actions.log entries (one per line): ISO | action | actor=... | {details}
app.get('/api/logs/actions', (req, res) => {
  const { start, end } = req.query; // optional ISO datetimes
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'failed_to_read_log' });
    const lines = data.split('\n').filter(Boolean);
  const parsed = lines.map(line => {
      // Example: 2025-09-17T12:00:00.000Z | device_assigned | actor={"emp_id":1,"username":"admin"} | {"emp_id":2,"device_id":3}
      const parts = line.split(' | ').map(p => p.trim());
      const time = parts[0];
      const action = parts[1];
      let actor = null;
      let details = {};
      if (parts.length === 4) {
        try { actor = JSON.parse(parts[2].replace(/^actor=/, '')); } catch (e) { actor = null; }
        try { details = JSON.parse(parts[3]); } catch (e) { details = {}; }
      } else if (parts.length === 3) {
        // old format without actor
        try { details = JSON.parse(parts[2]); } catch (e) { details = {}; }
      }
      const summary = generateSummary(action, details, actor);
      return { time, action, actor, details, summary, raw: line };
    });
    // filter by date range if provided
    let out = parsed;
    if (start) out = out.filter(p => new Date(p.time) >= new Date(start));
    if (end) out = out.filter(p => new Date(p.time) <= new Date(end));
    res.json(out.reverse()); // newest first
  });
});

// sensor-log.txt reader (optional file may have JSON per-line or exported dumps)
const SENSOR_LOG_FILE = path.join(__dirname, 'sensor-log.txt');
app.get('/api/logs/sensor', (req, res) => {
  const { start, end } = req.query;
  fs.readFile(SENSOR_LOG_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'failed_to_read_sensor_log' });
    const lines = data.split('\n').filter(Boolean);
    const parsed = lines.map(line => {
      // Accept lines like: "2025-09-17T12:00:00.000Z - { ...json... }" or plain JSON
      const parts = line.split(' - ');
      if (parts.length >= 2) {
        const ts = parts[0];
        const rest = parts.slice(1).join(' - ');
        try {
          const obj = JSON.parse(rest);
          obj.timestamp = ts;
          return obj;
        } catch (e) {
          return { timestamp: ts, raw: rest };
        }
      }
      try { return JSON.parse(line); } catch (e) { return { raw: line }; }
    });
    let out = parsed;
    if (start) out = out.filter(p => p.time && new Date(p.time) >= new Date(start));
    if (end) out = out.filter(p => p.time && new Date(p.time) <= new Date(end));
    res.json(out.reverse());
  });
});







// Start Express server on port 3001

