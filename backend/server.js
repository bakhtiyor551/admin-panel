import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { pool } from './db.js';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Инициализация таблицы маршрутов
async function initRoutesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS routes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      points JSON NOT NULL
    )
  `);
}
initRoutesTable();

// Получить все vehicles
app.get('/api/vehicles', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM vehicles');
  res.json(rows);
});

// Получить все позиции
app.get('/api/positions', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const [rows] = await pool.query('SELECT * FROM positions');
  res.json(rows);
});

// Добавить транспорт
app.post('/api/vehicles', async (req, res) => {
  const { name, status } = req.body;
  const [result] = await pool.query('INSERT INTO vehicles (name, status) VALUES (?, ?)', [name, status]);
  res.json({ id: result.insertId, name, status });
});

// Обновить позицию транспорта
app.post('/api/positions', async (req, res) => {
  const { vehicle_id, lat, lng } = req.body;
  await pool.query('INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)', [vehicle_id, lat, lng]);
  res.json({ success: true });
});

// Получить историю маршрутов с маркой машины
app.get('/api/history', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT h.id, h.date, h.from_lat, h.from_lng, h.to_lat, h.to_lng, h.route, v.name AS vehicle_name
    FROM history h
    LEFT JOIN vehicles v ON h.vehicle_id = v.id
    ORDER BY h.date DESC
  `);
  res.json(rows);
});

// Добавить запись в историю маршрута
app.post('/api/history', async (req, res) => {
  const { vehicleId, start, finish, route } = req.body;
  await pool.query(
    'INSERT INTO history (vehicle_id, from_lat, from_lng, to_lat, to_lng, route) VALUES (?, ?, ?, ?, ?, ?)',
    [
      vehicleId,
      start.lat,
      start.lng,
      finish.lat,
      finish.lng,
      JSON.stringify(route)
    ]
  );
  res.json({ success: true });
});

// Обновить маршрут в истории
app.put('/api/history/:id', async (req, res) => {
  const { start, finish, route } = req.body;
  const { id } = req.params;
  await pool.query(
    'UPDATE history SET from_lat=?, from_lng=?, to_lat=?, to_lng=?, route=? WHERE id=?',
    [start.lat, start.lng, finish.lat, finish.lng, JSON.stringify(route), id]
  );
  res.json({ success: true });
});

// Endpoint для добавления маршрута
app.post('/api/admin-route', async (req, res) => {
  const { name, points } = req.body;
  if (!name || !points) {
    return res.status(400).json({ error: 'name и points обязательны' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO routes (name, points) VALUES (?, ?)',
      [name, JSON.stringify(points)]
    );
    res.status(201).json({ id: result.insertId, name, points });
  } catch (err) {
    console.error('Ошибка при добавлении маршрута:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

// Socket.io: отправка координат из базы
setInterval(async () => {
  const [positions] = await pool.query('SELECT * FROM positions');
  positions.forEach(pos => {
    io.emit('positionUpdate', {
      carId: pos.vehicle_id,
      lat: pos.lat,
      lng: pos.lng
    });
  });
}, 5000);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
});

httpServer.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
}); 