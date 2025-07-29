import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import RoutesPage from './pages/Routes';
import History from './pages/History';
import ControlPanel from './components/ControlPanel';
import axios from 'axios';
import { io } from 'socket.io-client';

const navStyle = {
  display: 'flex',
  gap: 28,
  alignItems: 'center',
  marginLeft: 40,
};
const linkStyle = {
  color: '#fff',
  fontWeight: 600,
  fontSize: 18,
  textDecoration: 'none',
  padding: '8px 18px',
  borderRadius: 8,
  transition: 'background 0.2s',
};
const activeLinkStyle = {
  background: 'rgba(16,185,129,0.18)',
  color: '#10b981',
};

const App = () => {
  // Логика панели управления и карты
  const [vehicles, setVehicles] = useState([]);
  const [positions, setPositions] = useState({});
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [finish, setFinish] = useState(null);

  useEffect(() => {
    axios.get('http://localhost:3002/api/vehicles').then(res => {
      setVehicles(res.data);
    });
    const socket = io('http://localhost:3002');
    socket.on('positionUpdate', data => {
      setPositions(prev => ({ ...prev, [data.carId]: [data.lat, data.lng] }));
    });
    return () => socket.disconnect();
  }, []);

  const start = selectedVehicle && positions[selectedVehicle]
    ? { lat: positions[selectedVehicle][0], lng: positions[selectedVehicle][1] }
    : null;

  useEffect(() => { setFinish(null); }, [selectedVehicle]);
  const handleReset = () => setFinish(null);

  // Для передачи в Dashboard
  const dashboardProps = {
    vehicles,
    positions,
    selectedVehicle,
    finish,
    setFinish
  };

  return (
    <Router>
      {/* Header */}
      <header style={{
        width: '100%',
        height: 68,
        background: 'linear-gradient(90deg, #10b981 0%, #22d3ee 100%)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 40px',
        boxShadow: '0 2px 16px #10b98122',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 2000
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontWeight: 800, fontSize: 26, boxShadow: '0 2px 8px #10b98133'
          }}>
            <span style={{fontFamily: 'monospace'}}>A</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 26, color: '#fff', letterSpacing: 1, textShadow: '0 2px 8px #10b98155' }}>
            Admin Panel
          </span>
        </div>
        <nav style={navStyle}>
          <NavLink to="/" end style={({ isActive }) => isActive ? { ...linkStyle, ...activeLinkStyle } : linkStyle}>Dashboard</NavLink>
          <NavLink to="/vehicles" style={({ isActive }) => isActive ? { ...linkStyle, ...activeLinkStyle } : linkStyle}>Транспорт</NavLink>
          <NavLink to="/routes" style={({ isActive }) => isActive ? { ...linkStyle, ...activeLinkStyle } : linkStyle}>Маршруты</NavLink>
          <NavLink to="/history" style={({ isActive }) => isActive ? { ...linkStyle, ...activeLinkStyle } : linkStyle}>История</NavLink>
        </nav>
      </header>
      {/* Контент: основной контент + панель управления */}
      <div style={{ display: 'flex', flexDirection: 'row', width: '100vw', minHeight: '100vh', background: '#f4f6fa', paddingTop: 68 }}>
        {/* Левая часть — основной контент */}
        <div style={{ width: '50%', minWidth: 320, height: 'calc(100vh - 68px)', overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard {...dashboardProps} />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </div>
        {/* Правая часть — панель управления (всегда видна) */}
 
      </div>
    </Router>
  );
};

export default App;