import React, { useContext, useEffect, useRef } from 'react';
import { DeviceContext } from './RetrieveData';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTemperatureHigh, faHeartPulse } from '@fortawesome/free-solid-svg-icons';

const Vitals = () => {
  const { devices, connectionStatus } = useContext(DeviceContext);
  const alertedRef = useRef(new Set()); // track devices already alerted for high temp
  const audioCtxRef = useRef(null);
  const threshold = 39; // °C

  // Simple 3 second danger beep using Web Audio API
  function playBeep() {
    try {
      const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 880; // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3);
    } catch (e) { /* ignore */ }
  }

  // Watch temperatures and trigger alert once per incident
  useEffect(() => {
    Object.entries(devices).forEach(([deviceId, device]) => {
      const temp = device?.vitals?.bodyTemp;
      if (typeof temp === 'number') {
        const alertedSet = alertedRef.current;
        if (temp > threshold) {
          if (!alertedSet.has(deviceId)) {
            alertedSet.add(deviceId);
            window.alert(`${deviceId} is in trouble, temperature too high (${temp.toFixed(2)} °C)`);
            playBeep();
          }
        } else if (alertedSet.has(deviceId) && temp <= threshold - 0.5) {
          // provide a little hysteresis before allowing new alert
            alertedSet.delete(deviceId);
        }
      }
    });
  }, [devices]);

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-2">Vitals</h2>
      {connectionStatus !== "Connected" ? (
        <p className="text-red-500">Connection Status: {connectionStatus}</p>
      ) : (
        Object.keys(devices).length === 0 ? (
          <p className="text-gray-500">No vitals data available</p>
        ) : (
          {(() => {
            const lines = [];
            for (const [deviceId, device] of Object.entries(devices)) {
              if (!device.vitals) continue;
              const temp = device.vitals.bodyTemp;
              const hr = device.vitals.heartRate;
              lines.push(`temperature: ${temp.toFixed(2)} °C${temp > threshold ? ' HIGH' : ''}`);
              lines.push(`heart beat: ${hr.toFixed(2)} bpm`);
            }
            return <pre className="text-sm font-mono leading-snug whitespace-pre-wrap">{lines.join('\n')}</pre>;
          })()}
        )
      )}
    </div>
  );
};

export default Vitals;