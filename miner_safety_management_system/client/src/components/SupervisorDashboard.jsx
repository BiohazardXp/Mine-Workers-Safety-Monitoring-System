import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser, faPlus, faCogs, faSignOutAlt, faChartBar, faSlidersH } from '@fortawesome/free-solid-svg-icons';
import './css/AdminDashboard.css';
import DeviceCard from './DeviceCard';
import GraphCard from './GraphCard';
import AddDeviceModal from './AddDeviceModal';
import SetDeviceModal from './SetDeviceModal';
import SetThresholdModal from './SetThresholdModal';
import AddPairModal from './AddPairModal';

const dummyUser = {
  username: 'supervisor',
  position: 'Supervisor',
  email: 'supervisor@example.com',
  lastLogin: '2025-09-16 09:00',
};

const deviceCards = [];

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [cards, setCards] = useState(() => {
    try {
      const stored = localStorage.getItem('msms_cards');
      return stored ? JSON.parse(stored) : deviceCards;
    } catch {
      return deviceCards;
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showSetDevice, setShowSetDevice] = useState(false);
  const [showSetThreshold, setShowSetThreshold] = useState(false);
  const [showAddPair, setShowAddPair] = useState(false);

  useEffect(() => {
    localStorage.setItem('msms_cards', JSON.stringify(cards));
  }, [cards]);

  useEffect(() => {
    const onOpen = () => setShowSetDevice(true);
    window.addEventListener('openSetDeviceModal', onOpen);
    return () => window.removeEventListener('openSetDeviceModal', onOpen);
  }, []);

  return (
    <div className={`admin-dashboard`}>
      <button className="mobile-menu-toggle d-md-none d-lg-none" onClick={() => setSidebarOpen(o => !o)}>
        {sidebarOpen ? 'Close Menu' : 'Menu'}
      </button>
      {!sidebarOpen ? null : <div className={`sidebar-backdrop ${sidebarOpen ? '' : 'hidden'}`} onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? '' : ' closed'}`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="admin-sidebar-toggle"
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          {sidebarOpen ? '<' : '>'}
        </button>
        <div className="admin-user-info">
          <FontAwesomeIcon icon={faUser} size="2x" />
          <div>
            <div className="admin-user-details">{sessionStorage.getItem('msms_username') || dummyUser.username}</div>
            <div className="admin-user-position">{dummyUser.position}</div>
          </div>
        </div>
        <div className="admin-divider" />

        <div className="admin-device-section">
          <div className="admin-section-title">Device Management</div>
          <button className="btn btn-dark text-start" onClick={() => setShowAddDevice(true)}><FontAwesomeIcon icon={faPlus} /> Add Device</button>
          <button className="btn btn-dark text-start" onClick={() => { setShowSetDevice(true); }}><FontAwesomeIcon icon={faCogs} /> Set Device to Miner</button>
          <button className="btn btn-dark text-start" onClick={() => setShowSetThreshold(true)}><FontAwesomeIcon icon={faSlidersH} /> Set Threshold</button>
        </div>

        <div className="admin-divider" />
        <div className="admin-links-section">
          {/* Supervisor: no Manage Users or View Logs */}
          <Link to="/stats" className="btn btn-dark text-start"><FontAwesomeIcon icon={faChartBar} /> Statistical Graph</Link>
        </div>
  <div className="flex-grow" />
        <button
          className="btn btn-danger text-start"
          onClick={() => {
            try {
              sessionStorage.removeItem('msms_position');
              sessionStorage.removeItem('msms_username');
              localStorage.removeItem('msms_cards');
            } catch {}
            try { setCards([]); } catch {}
            navigate('/login', { replace: true });
          }}
        >
          <FontAwesomeIcon icon={faSignOutAlt} /> Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className={`admin-main${sidebarOpen ? '' : ' closed'}`}>
        <div className="admin-user-top">
          <div className="admin-top-title">{sessionStorage.getItem('msms_username') || 'Supervisor'}</div>
          <div>Email: {dummyUser.email}</div>
          <div>Last Login: {dummyUser.lastLogin}</div>
        </div>
        
        <div className="mb-24">
          <button className="btn btn-primary btn-lg admin-add-card-btn" onClick={() => setShowAddPair(true)}>
            <FontAwesomeIcon icon={faPlus} />
          </button>
          <span className="admin-add-card-label">Add real-time sensor card</span>
        </div>

        <div className="admin-device-cards">
          {cards.map(card => (
            <div className="card-pair" key={card.id}>
              <div className="card-half">
                <DeviceCard deviceId={card.deviceId} deviceName={card.deviceName} minerName={card.minerName} onRemove={() => setCards(prev => prev.filter(c => c.id !== card.id))} />
              </div>
              <div className="card-half">
                <GraphCard name={card.deviceName || card.deviceId} cardId={card.id} mountTime={card.mountTime || card.createdAt || null} />
              </div>
            </div>
          ))}
        </div>
      </main>

      {showAddDevice && (<AddDeviceModal onClose={() => setShowAddDevice(false)} />)}
      {showSetDevice && (<SetDeviceModal onClose={() => setShowSetDevice(false)} />)}
      {showSetThreshold && (<SetThresholdModal onClose={() => setShowSetThreshold(false)} />)}
      {showAddPair && (
        <AddPairModal onClose={() => setShowAddPair(false)} onAdd={async (pair) => {
          try {
            const res = await fetch('http://localhost:3001/api/assignments');
            const assignments = await res.json();
            const found = assignments.find(a => String(a.emp_id) === String(pair.emp_id) && String(a.device_id) === String(pair.device_id));
            let deviceName = null, minerName = null;
            if (found) {
              deviceName = found.device_name;
              minerName = `${found.first_name} ${found.surname}`;
            }
            const id = `${pair.emp_id}-${pair.device_id}`;
            setCards(prev => [...prev, { id, deviceId: pair.device_id, deviceName, minerName, empId: pair.emp_id, mountTime: Date.now() }]);
          } catch {
            const id = `${pair.emp_id}-${pair.device_id}`;
            setCards(prev => [...prev, { id, deviceId: pair.device_id, deviceName: null, minerName: null, empId: pair.emp_id, mountTime: Date.now() }]);
          }
        }} />
      )}
    </div>
  );
}
