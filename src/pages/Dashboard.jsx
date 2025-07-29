// src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Компонент для выбора финиша по клику
function RouteSelector({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    }
  });
  return null;
}

export default function Dashboard() {
  // Состояние для финишной точки
  const [finish, setFinish] = useState(null);
  // Состояние для маршрута
  const [routeCoords, setRouteCoords] = useState([]);
  // Состояние: маршрут построен, но не отправлен
  const [routeReady, setRouteReady] = useState(false);

  // Транспортные средства из базы
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [newVehicleName, setNewVehicleName] = useState('');
  const [newVehicleStatus, setNewVehicleStatus] = useState('active');
  // Координаты транспорта (заглушка, можно заменить на реальные из базы)
  const [positions, setPositions] = useState({});

  // Загрузка транспорта
  useEffect(() => {
    fetch('http://localhost:3002/api/vehicles')
      .then(res => res.json())
      .then(data => {
        setVehicles(data);
        if (data.length > 0) setSelectedVehicle(data[0].id.toString());
      });
  }, []);

  // Загрузка позиций транспорта (автообновление)
  useEffect(() => {
    const fetchPositions = () => {
      fetch('http://localhost:3002/api/positions')
        .then(res => res.json())
        .then(data => {
          const posObj = {};
          data.forEach(p => {
            posObj[p.vehicle_id] = [p.lat, p.lng];
          });
          setPositions(posObj);
        });
    };
    fetchPositions();
    const interval = setInterval(fetchPositions, 3000); // обновлять каждые 3 секунды
    return () => clearInterval(interval);
  }, []);

  // Форма добавления транспорта
  const handleAddVehicle = async () => {
    if (!newVehicleName) return;
    const res = await fetch('http://localhost:3002/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newVehicleName, status: newVehicleStatus })
    });
    const data = await res.json();
    setVehicles([...vehicles, data]);
    setNewVehicleName('');
  };

  const start = positions[selectedVehicle]
    ? { lat: positions[selectedVehicle][0], lng: positions[selectedVehicle][1] }
    : null;

  // Функция для отправки маршрута на backend
  async function saveRouteToBackend(start, finish, routeCoords) {
    await fetch('http://localhost:3002/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: selectedVehicle,
        start,
        finish,
        route: routeCoords
      })
    });
    setRouteReady(false); // Сбросить состояние после отправки
    setFinish(null);
    setRouteCoords([]);
  }

  // Функция для запроса маршрута у OSRM
  async function fetchRoute(start, finish) {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${finish.lng},${finish.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      setRouteCoords(coords);
      setRouteReady(true); // Маршрут готов, но не отправлен
    } else {
      setRouteCoords([]);
      setRouteReady(false);
    }
  }

  // Обработчик выбора финиша
  const handleFinishSelect = (latlng) => {
    setFinish(latlng);
    if (start && latlng) {
      fetchRoute(start, latlng);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100%', position: 'relative' }}>
      {/* Временный вывод состояния для отладки */}
      <div style={{position: 'absolute', top: 0, left: 0, background: '#fff', zIndex: 2000, padding: 8, borderRadius: 8, boxShadow: '0 2px 8px #0001'}}>
        routeReady: {routeReady ? 'true' : 'false'}<br/>
        routeCoords: {routeCoords.length}
      </div>

      {/* Форма добавления транспорта */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1001, background: '#fff', padding: 16, borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Название транспорта"
            value={newVehicleName}
            onChange={e => setNewVehicleName(e.target.value)}
            style={{ padding: 8, fontSize: 16, width: 180, marginRight: 8 }}
          />
          <select value={newVehicleStatus} onChange={e => setNewVehicleStatus(e.target.value)} style={{ padding: 8, fontSize: 16 }}>
            <option value="active">Активен</option>
            <option value="inactive">Неактивен</option>
          </select>
        </div>
        <button
          onClick={handleAddVehicle}
          style={{ padding: '8px 16px', fontSize: 16, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          Добавить транспорт
        </button>
      </div>

      {/* Выпадающий список для выбора транспорта */}
      <div style={{ position: 'absolute', top: 80, left: 20, zIndex: 1001, background: '#fff', padding: 12, borderRadius: 8, boxShadow: '0 2px 8px #0001' }}>
        <label style={{ marginRight: 8, fontWeight: 600 }}>Транспорт:</label>
        <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)} style={{ padding: 8, fontSize: 16 }}>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>

      <MapContainer center={[38.56, 68.77]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">Carto</a> &copy; OpenStreetMap contributors'
        />

        {/* Клик для установки финиша */}
        <RouteSelector onSelect={handleFinishSelect} />

        {/* Маркер старта */}
        {start && (
          <Marker position={start}>
            <Popup>Старт</Popup>
          </Marker>
        )}

        {/* Маркер финиша */}
        {finish && (
          <Marker position={finish}>
            <Popup>Финиш</Popup>
          </Marker>
        )}

        {/* Реальный маршрут */}
        {routeCoords.length > 0 && (
          <Polyline positions={routeCoords} color="green" weight={6} />
        )}

        {/* Все транспортные средства */}
        {vehicles.map((v) => {
          const pos = positions[v.id];
          return pos ? (
            <Marker key={v.id} position={{ lat: pos[0], lng: pos[1] }}>
              <Popup>{v.name}</Popup>
            </Marker>
          ) : null;
        })}
      </MapContainer>
      {/* Кнопка для подтверждения маршрута */}
      {routeReady && (
        <div style={{ position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <button
            onClick={() => saveRouteToBackend(start, finish, routeCoords)}
            style={{ padding: '12px 24px', fontSize: 18, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', boxShadow: '0 2px 8px #10b98144' }}
          >
            Маршрут устроил
          </button>
        </div>
      )}
    </div>
  );
}
