const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3002;

// Создаем базу данных SQLite
const db = new sqlite3.Database('./database.sqlite');

app.use(cors());
app.use(express.json());

// Инициализация базы данных
db.serialize(() => {
  // Создаем таблицы
  db.run(`CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    lat REAL,
    lng REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER,
    from_lat REAL,
    from_lng REAL,
    to_lat REAL,
    to_lng REAL,
    route TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
  )`);

  // Добавляем тестовые данные
  db.get("SELECT COUNT(*) as count FROM vehicles", (err, row) => {
    if (row.count === 0) {
      db.run("INSERT INTO vehicles (name, status) VALUES ('Тестовый автомобиль 1', 'active')");
      db.run("INSERT INTO vehicles (name, status) VALUES ('Тестовый автомобиль 2', 'active')");
    }
  });
});

// API endpoints
app.get('/api/vehicles', (req, res) => {
  db.all("SELECT * FROM vehicles", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

app.get('/api/positions', (req, res) => {
  res.set('Cache-Control', 'no-store');
  db.all("SELECT * FROM positions", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

app.get('/api/history', (req, res) => {
  db.all(`
    SELECT h.*, v.name as vehicle_name 
    FROM history h 
    LEFT JOIN vehicles v ON h.vehicle_id = v.id 
    ORDER BY h.date DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

app.post('/api/vehicles', (req, res) => {
  const { name, status = 'active' } = req.body;
  db.run("INSERT INTO vehicles (name, status) VALUES (?, ?)", [name, status], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, data: { id: this.lastID, name, status } });
  });
});

app.post('/api/positions', (req, res) => {
  const { vehicle_id, lat, lng } = req.body;
  db.run("INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)", [vehicle_id, lat, lng], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true });
  });
});

app.post('/api/history', (req, res) => {
  const { vehicleId, start, finish, route } = req.body;
  db.run(`
    INSERT INTO history (vehicle_id, from_lat, from_lng, to_lat, to_lng, route)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [vehicleId, start.lat, start.lng, finish.lat, finish.lng, JSON.stringify(route)], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, id: this.lastID });
  });
});

app.put('/api/history/:id', (req, res) => {
  const { id } = req.params;
  const { start, finish, route } = req.body;
  db.run(
    'UPDATE history SET from_lat = ?, from_lng = ?, to_lat = ?, to_lng = ?, route = ? WHERE id = ?',
    [start.lat, start.lng, finish.lat, finish.lng, JSON.stringify(route), id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ success: true });
    }
  );
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'SQLite'
  });
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
  db.all("SELECT * FROM positions", (err, positions) => {
    if (!err) {
      socket.emit('positions', positions);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// Запускаем сервер
httpServer.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log('📊 Database: SQLite');
});