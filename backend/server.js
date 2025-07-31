import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import mysql from 'mysql2/promise';

const app = express();
const PORT = process.env.PORT || 3003;

// Настройка CORS
app.use(cors());
app.use(express.json());

// Настройка подключения к MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'baha_usr',
  password: process.env.DB_PASSWORD || 'rLn8UWkaOy1lCzxw',
  database: process.env.DB_NAME || 'baha',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Проверка подключения к базе данных
const checkDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ База данных подключена успешно');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к базе данных:', error);
    return false;
  }
};

// Получить все vehicles
app.get('/api/vehicles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения vehicles:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить все позиции
app.get('/api/positions', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const [rows] = await pool.query('SELECT * FROM positions');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения позиций:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить последнюю позицию для каждого транспорта
app.get('/api/positions/latest', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.* FROM positions p 
      INNER JOIN (
        SELECT vehicle_id, MAX(id) as max_id 
        FROM positions 
        GROUP BY vehicle_id
      ) last ON p.vehicle_id = last.vehicle_id AND p.id = last.max_id
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения последних позиций:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить последнюю позицию по конкретному vehicle_id
app.get('/api/positions/:vehicle_id', async (req, res) => {
  try {
    const { vehicle_id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM positions WHERE vehicle_id = ? ORDER BY id DESC LIMIT 1',
      [vehicle_id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Нет данных для этого транспорта' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Ошибка получения позиции:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Добавить транспорт
app.post('/api/vehicles', async (req, res) => {
  try {
    const { name, status } = req.body;
    const [result] = await pool.query(
      'INSERT INTO vehicles (name, status) VALUES (?, ?)',
      [name, status]
    );
    res.json({ success: true, data: { id: result.insertId, name, status } });
  } catch (error) {
    console.error('Ошибка добавления транспорта:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновить позицию транспорта
app.post('/api/positions', async (req, res) => {
  try {
    const { vehicle_id, lat, lng } = req.body;
    await pool.query(
      'INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)',
      [vehicle_id, lat, lng]
    );
    res.json({ success: true, message: 'Позиция обновлена' });
  } catch (error) {
    console.error('Ошибка обновления позиции:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить историю маршрутов с маркой машины
app.get('/api/history', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT h.id, h.date, h.from_lat, h.from_lng, h.to_lat, h.to_lng, h.route, v.name AS vehicle_name 
      FROM history h 
      LEFT JOIN vehicles v ON h.vehicle_id = v.id 
      ORDER BY h.date DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения истории:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить историю маршрутов из таблицы route_history
app.get('/api/route_history', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        rh.id,
        rh.vehicle_id,
        v.name AS vehicle_name,
        rh.created_at,
        rh.completed_at,
        rh.start_lat,
        rh.start_lng,
        rh.end_lat,
        rh.end_lng,
        rh.status,
        rh.distance,
        rh.route_data
      FROM route_history rh
      LEFT JOIN vehicles v ON rh.vehicle_id = v.id
      ORDER BY rh.created_at DESC
    `);
    
    console.log(`Загружено ${rows.length} записей из route_history`);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения route_history:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Добавить запись в историю маршрута
app.post('/api/history', async (req, res) => {
  try {
    const { vehicleId, start, finish, route } = req.body;
    
    if (!vehicleId || !start || typeof start.lat !== 'number' || typeof start.lng !== 'number' || 
        !finish || typeof finish.lat !== 'number' || typeof finish.lng !== 'number') {
      return res.status(400).json({ success: false, error: 'vehicleId, start, finish и их координаты обязательны' });
    }
    
    await pool.query(
      'INSERT INTO history (vehicle_id, from_lat, from_lng, to_lat, to_lng, route) VALUES (?, ?, ?, ?, ?, ?)',
      [vehicleId, start.lat, start.lng, finish.lat, finish.lng, JSON.stringify(route)]
    );
    res.json({ success: true, message: 'Маршрут добавлен' });
  } catch (error) {
    console.error('Ошибка добавления истории:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Обновить маршрут в истории
app.put('/api/history/:id', async (req, res) => {
  try {
    const { start, finish, route } = req.body;
    const { id } = req.params;
    await pool.query(
      'UPDATE history SET from_lat=?, from_lng=?, to_lat=?, to_lng=?, route=? WHERE id=?',
      [start.lat, start.lng, finish.lat, finish.lng, JSON.stringify(route), id]
    );
    res.json({ success: true, message: 'Маршрут обновлен' });
  } catch (error) {
    console.error('Ошибка обновления истории:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить маршрут по id
app.get('/api/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM history WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Маршрут не найден' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Ошибка получения маршрута:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить все маршруты для транспорта
app.get('/api/history/vehicle/:vehicle_id', async (req, res) => {
  try {
    const { vehicle_id } = req.params;
    const [rows] = await pool.query('SELECT * FROM history WHERE vehicle_id = ?', [vehicle_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения маршрутов транспорта:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Аутентификация
app.post('/api/auth/login', async (req, res) => {
  try {
    const { login, password } = req.body;
    
    // Простая проверка (замените на реальную аутентификацию)
    if (login === 'admin' && password === 'password') {
      // В реальном приложении здесь должен быть JWT токен
      const token = 'fake-jwt-token-' + Date.now();
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, error: 'Неверные учетные данные' });
    }
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Сохранение данных транспорта и водителя
app.post('/api/vehicles/with-driver', async (req, res) => {
  try {
    const { vehicleId, vehicleBrand, driverName, phoneNumber } = req.body;
    
    console.log('Получены данные транспорта и водителя:', { vehicleId, vehicleBrand, driverName, phoneNumber });
    
    // Создаем таблицы если они не существуют
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT,
        vehicle_id INT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers(id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      )
    `);
    
    // Добавляем водителя
    const [driverResult] = await pool.query(
      'INSERT INTO drivers (name, phone_number) VALUES (?, ?)',
      [driverName, phoneNumber]
    );
    
    const driverId = driverResult.insertId;
    
    // Связываем водителя с транспортом
    await pool.query(
      'INSERT INTO driver_vehicle_assignments (driver_id, vehicle_id) VALUES (?, ?)',
      [driverId, vehicleId]
    );
    
    // Обновляем название транспорта
    await pool.query(
      'UPDATE vehicles SET name = ? WHERE id = ?',
      [vehicleBrand, vehicleId]
    );
    
    res.json({ 
      success: true, 
      message: 'Данные сохранены',
      driverId,
      vehicleId
    });
  } catch (error) {
    console.error('Ошибка сохранения данных транспорта и водителя:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить всех водителей
app.get('/api/drivers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM drivers');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения водителей:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Получить все назначения
app.get('/api/assignments', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        dva.id,
        d.name AS driver_name,
        d.phone_number,
        v.name AS vehicle_name,
        v.id AS vehicle_id,
        dva.assigned_at
      FROM driver_vehicle_assignments dva
      LEFT JOIN drivers d ON dva.driver_id = d.id
      LEFT JOIN vehicles v ON dva.vehicle_id = v.id
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Ошибка получения назначений:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Endpoint для мобильного приложения (без авторизации)
app.post('/api/positions/mobile-app', async (req, res) => {
  try {
    const { vehicle_id, lat, lng } = req.body;
    
    if (!vehicle_id || lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, error: 'vehicle_id, lat и lng обязательны' });
    }
    
    console.log(`Получена позиция от мобильного приложения: vehicle_id=${vehicle_id}, lat=${lat}, lng=${lng}`);
    
    await pool.query(
      'INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)',
      [vehicle_id, lat, lng]
    );
    
    res.json({ success: true, message: 'Позиция сохранена' });
  } catch (error) {
    console.error('Ошибка сохранения позиции от мобильного приложения:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Endpoint для проверки здоровья сервера
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Endpoint для получения информации о сервере
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    data: {
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      database: process.env.DB_NAME || 'baha',
      timestamp: new Date().toISOString()
    }
  });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

// Socket.io: отправка координат из базы
setInterval(async () => {
  try {
    const [positions] = await pool.query('SELECT * FROM positions');
    positions.forEach(pos => {
      io.emit('positionUpdate', {
        carId: pos.vehicle_id,
        lat: pos.lat,
        lng: pos.lng
      });
    });
  } catch (error) {
    console.error('Ошибка отправки позиций через Socket.io:', error);
  }
}, 5000);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);
});

// Запуск сервера
const startServer = async () => {
  try {
    // Проверка подключения к базе данных
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      console.error('Не удалось подключиться к базе данных');
      process.exit(1);
    }
    
    // Запуск HTTP сервера
    httpServer.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
      console.log(`📊 Режим: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ База данных: ${process.env.DB_NAME || 'baha'}`);
      console.log(`🔌 Socket.IO: активен`);
    });
  } catch (error) {
    console.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

startServer(); 