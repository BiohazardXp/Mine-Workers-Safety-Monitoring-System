import React, { createContext, useState, useEffect } from "react";

// Fallback for browser environment (process is Node.js-specific)
if (typeof process === 'undefined') {
  window.process = { env: {} };
}

export const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
  const [devices, setDevices] = useState({});
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  useEffect(() => {
    // Access env with fallback
    const WS_URL = (process.env.REACT_APP_WS_URL || window.process?.env?.REACT_APP_WS_URL) || "ws://localhost:8002";
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnectionStatus("Connected");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Ignore empty objects/arrays
        if (
          !data ||
          (typeof data === 'object' && Object.keys(data).length === 0) ||
          (Array.isArray(data) && data.length === 0)
        ) {
          return;
        }
        if (
          typeof data === 'object' &&
          data !== null &&
          data.deviceName &&
          data.sensorData &&
          data.sensorData.vitals &&
          data.sensorData.environment
        ) {
          setDevices(prev => ({
            ...prev,
            [data.deviceName]: data.sensorData
          }));
        } else {
          console.warn("Invalid WebSocket data structure:", data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket data:", error);
        setConnectionStatus("Error receiving data");
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionStatus("Error connecting to server");
    };

    ws.onclose = () => setConnectionStatus("Disconnected");

    return () => ws.close();
  }, []);

  return (
    <DeviceContext.Provider value={{ devices, connectionStatus }}>
      {children}
    </DeviceContext.Provider>
  );
};