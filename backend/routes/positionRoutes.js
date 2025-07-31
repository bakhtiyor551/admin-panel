import { Router } from 'express';
import { pool } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { positionValidators } from '../middleware/validators.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Получить все позиции
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  
  res.set('Cache-Control', 'no-store');
  
  const [positions] = await pool.query(
    'SELECT * FROM positions ORDER BY timestamp DESC LIMIT ? OFFSET ?',
    [parseInt(limit), parseInt(offset)]
  );
  
  res.json(positions);
}));

// Получить последние позиции для всех транспортных средств
router.get('/latest', asyncHandler(async (req, res) => {
  const [positions] = await pool.query(`
    SELECT 
      p.*,
      v.vehicle_id,
      v.brand,
      v.model,
      CONCAT(v.brand, ' ', v.model) as vehicle_name
    FROM positions p
    INNER JOIN (
      SELECT vehicle_id, MAX(id) as max_id
      FROM positions
      GROUP BY vehicle_id
    ) last ON p.vehicle_id = last.vehicle_id AND p.id = last.max_id
    LEFT JOIN vehicles v ON p.vehicle_id = v.id
  `);
  
  res.json(positions);
}));

// Получить позиции по vehicle_id
router.get('/vehicle/:vehicle_id', positionValidators.getByVehicle, asyncHandler(async (req, res) => {
  const { vehicle_id } = req.params;
  const { limit = 100 } = req.query;
  
  // Сначала находим внутренний ID транспорта
  const [vehicles] = await pool.query(
    'SELECT id FROM vehicles WHERE vehicle_id = ?',
    [vehicle_id]
  );
  
  if (vehicles.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  const vehicleDbId = vehicles[0].id;
  
  // Получаем позиции
  const [positions] = await pool.query(
    'SELECT * FROM positions WHERE vehicle_id = ? ORDER BY timestamp DESC LIMIT ?',
    [vehicleDbId, parseInt(limit)]
  );
  
  res.json(positions);
}));

// Получить последнюю позицию для конкретного транспорта
router.get('/vehicle/:vehicle_id/latest', positionValidators.getByVehicle, asyncHandler(async (req, res) => {
  const { vehicle_id } = req.params;
  
  // Сначала находим внутренний ID транспорта
  const [vehicles] = await pool.query(
    'SELECT id FROM vehicles WHERE vehicle_id = ?',
    [vehicle_id]
  );
  
  if (vehicles.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  const vehicleDbId = vehicles[0].id;
  
  const [positions] = await pool.query(
    'SELECT * FROM positions WHERE vehicle_id = ? ORDER BY timestamp DESC LIMIT 1',
    [vehicleDbId]
  );
  
  if (positions.length === 0) {
    throw new ApiError(404, 'Нет данных о позиции для этого транспорта');
  }
  
  res.json(positions[0]);
}));

// Создать новую позицию (требует авторизации)
router.post('/', authenticateToken, positionValidators.create, asyncHandler(async (req, res) => {
  const { vehicle_id, lat, lng } = req.body;
  
  // Находим внутренний ID транспорта
  const [vehicles] = await pool.query(
    'SELECT id FROM vehicles WHERE vehicle_id = ?',
    [vehicle_id]
  );
  
  if (vehicles.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  const vehicleDbId = vehicles[0].id;
  
  // Сохраняем позицию
  const [result] = await pool.query(
    'INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)',
    [vehicleDbId, lat, lng]
  );
  
  logger.info(`Новая позиция для транспорта ${vehicle_id}: ${lat}, ${lng}`);
  
  // Отправляем через Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.emit('positionUpdate', {
      vehicleId: vehicle_id,
      lat,
      lng,
      timestamp: new Date()
    });
  }
  
  res.status(201).json({
    success: true,
    position: {
      id: result.insertId,
      vehicle_id: vehicleDbId,
      lat,
      lng,
      timestamp: new Date()
    }
  });
}));

// Создать позицию от мобильного приложения (без авторизации)
router.post('/mobile-app', positionValidators.create, asyncHandler(async (req, res) => {
  const { vehicle_id, lat, lng } = req.body;
  
  // Находим внутренний ID транспорта
  const [vehicles] = await pool.query(
    'SELECT id FROM vehicles WHERE vehicle_id = ?',
    [vehicle_id]
  );
  
  if (vehicles.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  const vehicleDbId = vehicles[0].id;
  
  // Сохраняем позицию
  const [result] = await pool.query(
    'INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)',
    [vehicleDbId, lat, lng]
  );
  
  logger.info(`Позиция от мобильного приложения для транспорта ${vehicle_id}: ${lat}, ${lng}`);
  
  // Отправляем через Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.emit('positionUpdate', {
      vehicleId: vehicle_id,
      lat,
      lng,
      timestamp: new Date()
    });
  }
  
  res.json({
    success: true,
    message: 'Позиция сохранена',
    position: {
      id: result.insertId,
      vehicle_id: vehicleDbId,
      lat,
      lng,
      timestamp: new Date()
    }
  });
}));

// Удалить старые позиции (очистка)
router.delete('/cleanup', authenticateToken, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const [result] = await pool.query(
    'DELETE FROM positions WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [parseInt(days)]
  );
  
  logger.info(`Удалено ${result.affectedRows} старых позиций`);
  
  res.json({
    success: true,
    deleted: result.affectedRows,
    message: `Удалено ${result.affectedRows} позиций старше ${days} дней`
  });
}));

export default router;