import React, { useState, Suspense } from 'react'
import './App.css'
import { BrowserRouter } from 'react-router-dom';
import Login from './components/Login'
import { Home } from './Home'
import { DeviceProvider } from './components/RetrieveData';
import AuthRoutes from './routes/AuthRoutes';
import AlertToaster from './components/AlertToaster';
const SetDeviceModal = React.lazy(() => import('./components/SetDeviceModal'));

function App() {
  const [username, setUsername] = useState("");

  return (
    <DeviceProvider>
      <BrowserRouter>
        <div>
          {/* Mount the app routes so Links like /manage-users are matched */}
          <AuthRoutes />
          {/* Global alert popup system */}
          <AlertToaster />

          <Suspense fallback={null}>
            {/* We'll listen for the custom event in the modal itself when mounted in AdminDashboard */}
          </Suspense>
        </div>
      </BrowserRouter>
    </DeviceProvider>
  );
}

export default App;
