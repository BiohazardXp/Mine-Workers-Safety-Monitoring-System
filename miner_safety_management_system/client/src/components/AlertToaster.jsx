import React, { useEffect, useRef, useState } from 'react';
import './css/AlertToaster.css';

/*
  Listens to the existing WebSocket (or creates one if none) for messages of shape:
  { type: 'alert', event: 'start'|'exposure_elapsed'|'cleared', device, parameter, severity, ... }
*/

const MAX_ALERTS = 8;
const AUTO_DISMISS_MS = 12000; // base timeout for start/cleared
const EXPOSURE_TIMEOUT_MS = 20000; // longer visibility for exposure_elapsed

function genId(evt) {
  // Compose a reasonably unique id
  return [evt.event, evt.device, evt.parameter, evt.startedAt || evt.clearedAt || Date.now(), Math.random().toString(36).slice(2,7)].join('-');
}

export default function AlertToaster() {
  const [alerts, setAlerts] = useState([]);
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);

  function playBeep(durationMs=3000) {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs/1000);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + durationMs/1000);
    } catch {}
  }

  useEffect(() => {
    // Try to reuse a global singleton to avoid multiple sockets
    if (window.__MSMS_ALERT_SOCKET && window.__MSMS_ALERT_SOCKET.readyState === WebSocket.OPEN) {
      wsRef.current = window.__MSMS_ALERT_SOCKET;
    } else {
      const url = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.hostname + ':3001';
      const ws = new WebSocket(url);
      window.__MSMS_ALERT_SOCKET = ws;
      wsRef.current = ws;
    }

    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.type === 'alert') {
          // Basic dedupe: if very recent identical event (same event+device+parameter+severity) ignore
          setAlerts(prev => {
            const key = data.event + data.device + data.parameter + data.severity;
            const now = Date.now();
            const recent = prev.find(a => a.__key === key && now - a.__ts < 1500);
            if (recent) return prev; // skip duplicate spam
            const id = genId(data);
            const duration = data.event === 'exposure_elapsed' ? EXPOSURE_TIMEOUT_MS : AUTO_DISMISS_MS;
            const alertObj = { id, __key: key, __ts: now, data, dismissAt: now + duration };
            const next = [alertObj, ...prev].slice(0, MAX_ALERTS);

            // Beep logic: temperature parameter over 39 triggers 3s alarm (once per new alert start only)
            const pLower = String(data.parameter || '').toLowerCase();
            if (data.event === 'start' && pLower.includes('temp') && Number(data.value) > 39) {
              playBeep(3000);
            }
            return next;
          });
        }
      } catch {}
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, []);

  // Auto dismiss timer
  useEffect(() => {
    if (!alerts.length) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setAlerts(prev => prev.filter(a => a.dismissAt > now));
    }, 1000);
    return () => clearInterval(interval);
  }, [alerts]);

  const remove = (id) => setAlerts(prev => prev.filter(a => a.id !== id));

  if (!alerts.length) return null;

  return (
    <div className="alert-toaster" role="region" aria-label="Active alerts">
      {alerts.map(a => {
        const { data } = a;
        const cls = `alert-toast severity-${data.severity || 'info'} event-${data.event}`;
        let title = `${data.parameter} ${data.severity}`;
        if (data.event === 'exposure_elapsed') title += ' exposure reached';
        if (data.event === 'cleared') title = `${data.parameter} cleared`;
        const msg = data.message || `${data.parameter} ${data.severity} (${data.event})`;
        return (
          <div key={a.id} className={cls}>
            <div className="alert-toast-header">
              <span className="alert-toast-title">{title}</span>
              <button onClick={() => remove(a.id)} aria-label="Dismiss" className="alert-toast-close">×</button>
            </div>
            <div className="alert-toast-body">
              <div className="alert-toast-line">Device: <strong>{data.device}</strong></div>
              <div className="alert-toast-line">Parameter: <strong>{data.parameter}</strong></div>
              {data.value != null && <div className="alert-toast-line">Value: <strong>{Number(data.value).toFixed(2)}</strong></div>}
              {data.threshold != null && <div className="alert-toast-line">Threshold: <strong>{data.threshold}</strong></div>}
              <div className="alert-toast-line msg">{msg}</div>
            </div>
            <div className="alert-progress" />
          </div>
        );
      })}
    </div>
  );
}
