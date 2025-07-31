import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { pool } from './db.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Настройка CORS
app.use(cors());
app.use(express.json());

// Отладочная информация
console.log('Настройки подключения к БД:');
console.log('DB_HOST:', process.env.DB_HOST || 'localhost');
console.log('DB_PORT:', process.env.DB_PORT || 3306);
console.log('DB_USER:', process.env.DB_USER || 'baha_usr');
console.log('DB_NAME:', process.env.DB_NAME || 'baha');

// Проверка подключения к базе данных
const checkDatabaseConnection = async () => {
  try {
    await pool.getConnection();
    console.log('База данных подключена успешно.');
  } catch (error) {
    console.error('Ошибка подключения к базе данных:', error);
    process.exit(1);
  }
};

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

// Получить последнюю позицию для каждого транспорта
app.get('/api/positions/latest', async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*
    FROM positions p
    INNER JOIN (
      SELECT vehicle_id, MAX(id) as max_id
      FROM positions
      GROUP BY vehicle_id
    ) last
    ON p.vehicle_id = last.vehicle_id AND p.id = last.max_id
  `);
  res.json(rows);
});

// Получить последнюю позицию по конкретному vehicle_id
app.get('/api/positions/:vehicle_id', async (req, res) => {
  const { vehicle_id } = req.params;
  const [rows] = await pool.query(
    'SELECT * FROM positions WHERE vehicle_id = ? ORDER BY id DESC LIMIT 1',
    [vehicle_id]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: 'Нет данных для этого транспорта' });
  }
  res.json(rows[0]);
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