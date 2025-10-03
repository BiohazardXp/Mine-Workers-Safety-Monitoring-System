import { Routes, Route, Navigate } from 'react-router-dom';
import Login from '../components/Login';
import Dashboard from '../components/Dashboard';
import ManageUsers from '../components/ManageUsers';
import ViewLogs from '../components/ViewLogs';
import StatisticalGraph from '../components/StatisticalGraph';

function isLoggedIn() {
  try {
    return !!sessionStorage.getItem('msms_position');
  } catch (e) { return false; }
}

export default function AuthRoutes() {
  return (
    <Routes>
      {/* root: send already-logged-in users to dashboard, otherwise to login */}
      <Route path="/" element={isLoggedIn() ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/manage-users" element={<ManageUsers />} />
      <Route path="/logs" element={<ViewLogs />} />
      <Route path="/stats" element={<StatisticalGraph />} />
    </Routes>
  );
}
