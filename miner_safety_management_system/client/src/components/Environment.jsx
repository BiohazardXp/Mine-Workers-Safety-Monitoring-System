import React, { useContext } from 'react';
import { DeviceContext } from './RetrieveData';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTemperatureHigh, faCloudRain, faWind, faGasPump, faBiohazard, faWater, faCompress, faSmog, faCloud } from '@fortawesome/free-solid-svg-icons';

const Environment = () => {
  const { devices, connectionStatus } = useContext(DeviceContext);

  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-2">Environment</h2>
      {connectionStatus !== "Connected" ? (
        <p className="text-red-500">Connection Status: {connectionStatus}</p>
      ) : (
        Object.keys(devices).length === 0 ? (
          <p className="text-gray-500">No environment data available</p>
        ) : (
          <div>
            {Object.entries(devices).map(([deviceId, device]) => (
              device.environment ? (
                <div key={deviceId} className="mb-4 p-2 bg-white rounded shadow text-sm font-mono">
                  {(() => {
                    const envReadings = [
                      { label: 'co', value: device.environment.carbonMonoxide, unit: 'ppm' },
                      { label: 'ammonia', value: device.environment.ammonia, unit: 'ppm' },
                      { label: 'hydrogen sulfide', value: device.environment.hydrogenSulfide, unit: 'ppm' },
                      { label: 'sulphur dioxide', value: device.environment.sulphurDioxide, unit: 'ppm' },
                      { label: 'nitrogen dioxide', value: device.environment.nitrogenDioxide, unit: 'ppm' },
                      { label: 'methane', value: device.environment.methane, unit: 'ppm' },
                      { label: 'temperature', value: device.environment.temperature, unit: '°C' },
                      { label: 'pressure', value: device.environment.pressure, unit: 'hPa' },
                      { label: 'humidity', value: device.environment.humidity, unit: '%' },
                    ];
                    const lines = envReadings.map(r => `${r.label}: ${typeof r.value === 'number' ? r.value.toFixed(2) : '—'} ${r.unit}`);
                    return <pre className="whitespace-pre-wrap leading-snug">{lines.join('\n')}</pre>;
                  })()}
                </div>
              ) : null
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default Environment;