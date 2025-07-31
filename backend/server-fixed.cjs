const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');

const app = express();
const PORT = 3002;

// Создаем pool здесь
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'admin_panel',
  port: 3306
});

app.use(cors());
app.use(express.json());

// Получить все vehicles
app.get('/api/vehicles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Получить все позиции
app.get('/api/positions', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const [rows] = await pool.query('SELECT * FROM positions');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

// Получить последнюю позицию для каждого транспорта
app.get('/api/positions/latest', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*
      FROM positions p
      INNER JOIN (
        SELECT vehicle_id, MAX(timestamp) as max_timestamp
        FROM positions
        GROUP BY vehicle_id
      ) latest ON p.vehicle_id = latest.vehicle_id AND p.timestamp = latest.max_timestamp
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching latest positions:', error);
    res.status(500).json({ error: 'Failed to fetch latest positions' });
  }
});

// История маршрутов
app.get('/api/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT h.*, v.name as vehicle_name FROM history h LEFT JOIN vehicles v ON h.vehicle_id = v.id ORDER BY h.date DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Добавить vehicle
app.post('/api/vehicles', async (req, res) => {
  try {
    const { name, status = 'active' } = req.body;
    const [result] = await pool.query('INSERT INTO vehicles (name, status) VALUES (?, ?)', [name, status]);
    res.json({ id: result.insertId, name, status });
  } catch (error) {
    console.error('Error adding vehicle:', error);
    res.status(500).json({ error: 'Failed to add vehicle' });
  }
});

// Добавить позицию
app.post('/api/positions', async (req, res) => {
  try {
    const { vehicle_id, lat, lng } = req.body;
    await pool.query('INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)', [vehicle_id, lat, lng]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding position:', error);
    res.status(500).json({ error: 'Failed to add position' });
  }
});

// Добавить маршрут в историю
app.post('/api/history', async (req, res) => {
  try {
    const { vehicleId, start, finish, route } = req.body;
    const [rows] = await pool.query(`
      INSERT INTO history (vehicle_id, from_lat, from_lng, to_lat, to_lng, route, date)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [vehicleId, start.lat, start.lng, finish.lat, finish.lng, JSON.stringify(route)]);
    res.json({ success: true, id: rows.insertId });
  } catch (error) {
    console.error('Error adding history:', error);
    res.status(500).json({ error: 'Failed to add history' });
  }
});

// Обновить маршрут в истории
app.put('/api/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start, finish, route } = req.body;
    await pool.query(
      'UPDATE history SET from_lat = ?, from_lng = ?, to_lat = ?, to_lng = ?, route = ? WHERE id = ?',
      [start.lat, start.lng, finish.lat, finish.lng, JSON.stringify(route), id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating history:', error);
    res.status(500).json({ error: 'Failed to update history' });
  }
});

// Создаем HTTP сервер
const httpServer = createServer(app);

// Создаем Socket.IO сервер
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO события
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
  
  // Отправляем текущие позиции при подключении
  pool.query('SELECT * FROM positions').then(([positions]) => {
    socket.emit('positions', positions);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Запускаем сервер
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});