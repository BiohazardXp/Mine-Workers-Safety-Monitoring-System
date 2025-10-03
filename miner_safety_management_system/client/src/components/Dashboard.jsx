import AdminDashboard from './AdminDashboard';
import SupervisorDashboard from './SupervisorDashboard';

const Dashboard = ({ position }) => {
  const pos = position || sessionStorage.getItem('msms_position') || '';
  if (pos === 'admin') {
    return <AdminDashboard />;
  }
  if (pos === 'supervisor') {
    return <SupervisorDashboard />;
  }
  return (
    <div className="container mt-5">
      <h2>User Dashboard</h2>
      <p>You have limited access.</p>
    </div>
  );
};

export default Dashboard;
