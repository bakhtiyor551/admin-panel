import { useEffect, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const formatCoords = (lat, lng) => lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '';

// Компонент для выбора новой конечной точки
function EditRouteSelector({ onSelect }) {
  useMapEvents({
    click(e) {
      onSelect(e.latlng);
    }
  });
  return null;
}

const History = () => {
  const [history, setHistory] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editStart, setEditStart] = useState(null);
  const [editFinish, setEditFinish] = useState(null);
  const [editRoute, setEditRoute] = useState([]);
  const [editVehicle, setEditVehicle] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    axios.get('http://localhost:3002/api/history').then(res => setHistory(res.data));
  }, []);

  // Центр карты — если есть хотя бы один маршрут, берем его старт, иначе дефолт
  const defaultCenter = history.length > 0 ? [history[0].from_lat, history[0].from_lng] : [38.56, 68.77];

  // Начать редактирование маршрута
  const handleEdit = (item) => {
    setEditId(item.id);
    setEditStart({ lat: item.from_lat, lng: item.from_lng });
    setEditFinish({ lat: item.to_lat, lng: item.to_lng });
    let route = [];
    try {
      if (item.route) {
        const parsed = typeof item.route === 'string' ? JSON.parse(item.route) : item.route;
        if (Array.isArray(parsed)) route = parsed;
      }
    } catch {}
    setEditRoute(route);
    setEditVehicle(item.vehicle_name || '');
  };

  // Запрос маршрута у OSRM
  async function fetchRoute(start, finish) {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${finish.lng},${finish.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.routes && data.routes.length > 0) {
      const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      setEditRoute(coords);
    } else {
      setEditRoute([]);
    }
  }

  // При выборе новой конечной точки
  const handleEditFinishSelect = (latlng) => {
    setEditFinish(latlng);
    if (editStart && latlng) {
      fetchRoute(editStart, latlng);
    }
  };

  // Сохранить изменения маршрута
  const handleSaveEdit = async () => {
    setSaving(true);
    setEditError('');
    try {
      await axios.put(`http://localhost:3002/api/history/${editId}`, {
        start: editStart,
        finish: editFinish,
        route: editRoute
      });
      setEditId(null);
      setEditStart(null);
      setEditFinish(null);
      setEditRoute([]);
      setSaving(false);
      // Обновить историю
      axios.get('http://localhost:3002/api/history').then(res => setHistory(res.data));
    } catch (err) {
      setSaving(false);
      setEditError(err?.response?.status ? `Ошибка ${err.response.status}: ${err.response.statusText}` : (err.message || 'Неизвестная ошибка'));
    }
  };

  // Отмена редактирования
  const handleCancelEdit = () => {
    setEditId(null);
    setEditStart(null);
    setEditFinish(null);
    setEditRoute([]);
  };

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 24 }}>История маршрутов</h1>

      {/* Карта с маршрутами */}
      <div style={{ height: 400, marginBottom: 32 }}>
        {/* Если редактируем — показываем карту для редактирования маршрута */}
        {editId ? (
          <MapContainer center={editStart ? [editStart.lat, editStart.lng] : defaultCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">Carto</a> &copy; OpenStreetMap contributors'
            />
            <EditRouteSelector onSelect={handleEditFinishSelect} />
            {/* Маркер старта */}
            {editStart && (
              <Marker position={editStart}>
                <Popup>Старт<br/>{editVehicle}</Popup>
              </Marker>
            )}
            {/* Маркер финиша */}
            {editFinish && (
              <Marker position={editFinish}>
                <Popup>Финиш<br/>{editVehicle}</Popup>
              </Marker>
            )}
            {/* Новый маршрут */}
            {editRoute.length > 0 && (
              <Polyline positions={editRoute} color="blue" weight={6} />
            )}
          </MapContainer>
        ) : (
          <MapContainer center={defaultCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">Carto</a> &copy; OpenStreetMap contributors'
            />
            {/* Цвета для маршрутов */}
            {(() => {
              const colors = ['green', 'blue', 'red', 'orange', 'purple', 'brown', 'magenta', 'teal', 'navy', 'gold'];
              return history.map((item, idx) => {
                // Парсим маршрут, если есть
                let route = [];
                try {
                  if (item.route) {
                    const parsed = typeof item.route === 'string' ? JSON.parse(item.route) : item.route;
                    if (Array.isArray(parsed)) route = parsed;
                  }
                } catch {}
                const color = colors[idx % colors.length];
                return (
                  <>
                    {/* Линия маршрута */}
                    {route.length > 0 && (
                      <Polyline positions={route} color={color} weight={5} key={`route-${item.id}`} />
                    )}
                    {/* Маркеры старта и финиша */}
                    <Marker position={[item.from_lat, item.from_lng]} key={`start-${item.id}`}>
                      <Popup>Старт<br/>{item.vehicle_name || '—'}</Popup>
                    </Marker>
                    <Marker position={[item.to_lat, item.to_lng]} key={`finish-${item.id}`}>
                      <Popup>Финиш<br/>{item.vehicle_name || '—'}</Popup>
                    </Marker>
                  </>
                );
              });
            })()}
          </MapContainer>
        )}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px #10b98122', overflow: 'hidden' }}>
        <thead style={{ background: '#10b981', color: '#fff' }}>
          <tr>
            <th style={{ padding: 12, fontWeight: 600 }}>Дата</th>
            <th style={{ padding: 12, fontWeight: 600 }}>Маршрут</th>
            <th style={{ padding: 12, fontWeight: 600 }}>Марка машины</th>
            <th style={{ padding: 12, fontWeight: 600 }}>Действия</th>
          </tr>
        </thead>
        <tbody>
          {history.map(item => (
            <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: 10 }}>{new Date(item.date).toLocaleString()}</td>
              <td style={{ padding: 10 }}>
                {formatCoords(item.from_lat, item.from_lng)} → {formatCoords(item.to_lat, item.to_lng)}
              </td>
              <td style={{ padding: 10 }}>{item.vehicle_name || '—'}</td>
              <td style={{ padding: 10 }}>
                <button
                  onClick={() => handleEdit(item)}
                  style={{ padding: '6px 16px', fontSize: 15, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  disabled={!!editId}
                >
                  Редактировать
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Кнопки управления редактированием */}
      {editId && (
        <div style={{ marginTop: 24, display: 'flex', gap: 16 }}>
          <button
            onClick={handleSaveEdit}
            style={{ padding: '12px 24px', fontSize: 18, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', boxShadow: '0 2px 8px #2563eb44' }}
            disabled={saving || !editRoute.length}
          >
            {saving ? 'Сохраняю...' : 'Сохранить изменения'}
          </button>
          <button
            onClick={handleCancelEdit}
            style={{ padding: '12px 24px', fontSize: 18, background: '#e11d48', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', boxShadow: '0 2px 8px #e11d4844' }}
            disabled={saving}
          >
            Отмена
          </button>
        </div>
      )}
      {/* Вывод ошибки при сохранении */}
      {editError && (
        <div style={{ color: 'red', margin: '16px 0', fontWeight: 600, fontSize: 18 }}>
          {editError}
        </div>
      )}
    </div>
  );
};

export default History;