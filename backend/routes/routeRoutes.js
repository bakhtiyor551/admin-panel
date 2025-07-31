import { Router } from 'express';
import { pool } from '../db.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { routeValidators } from '../middleware/validators.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Получить все маршруты
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { vehicle_id, driver_id, status, limit = 50, offset = 0 } = req.query;
  
  let query = `
    SELECT 
      rh.*,
      v.vehicle_id,
      v.brand,
      v.model,
      CONCAT(v.brand, ' ', v.model) as vehicle_name,
      d.name as driver_name,
      d.phone_number as driver_phone
    FROM route_history rh
    JOIN vehicles v ON rh.vehicle_id = v.id
    LEFT JOIN drivers d ON rh.driver_id = d.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (vehicle_id) {
    query += ' AND v.vehicle_id = ?';
    params.push(vehicle_id);
  }
  
  if (driver_id) {
    query += ' AND rh.driver_id = ?';
    params.push(driver_id);
  }
  
  if (status) {
    query += ' AND rh.status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY rh.start_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  const [routes] = await pool.query(query, params);
  
  res.json(routes);
}));

// Получить маршрут по ID
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const [routes] = await pool.query(`
    SELECT 
      rh.*,
      v.vehicle_id,
      v.brand,
      v.model,
      CONCAT(v.brand, ' ', v.model) as vehicle_name,
      d.name as driver_name,
      d.phone_number as driver_phone
    FROM route_history rh
    JOIN vehicles v ON rh.vehicle_id = v.id
    LEFT JOIN drivers d ON rh.driver_id = d.id
    WHERE rh.id = ?
  `, [id]);
  
  if (routes.length === 0) {
    throw new ApiError(404, 'Маршрут не найден');
  }
  
  res.json(routes[0]);
}));

// Создать новый маршрут
router.post('/', authenticateToken, routeValidators.create, asyncHandler(async (req, res) => {
  const { 
    vehicle_id, 
    driver_id, 
    start_lat, 
    start_lng, 
    end_lat, 
    end_lng, 
    distance_km, 
    cargo_type, 
    cargo_description, 
    duration_days 
  } = req.body;
  
  // Найти ID автомобиля по vehicle_id
  const [vehicles] = await pool.query(
    'SELECT id FROM vehicles WHERE vehicle_id = ?',
    [vehicle_id]
  );
  
  if (vehicles.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  const vehicleDbId = vehicles[0].id;
  
  // Проверить существование водителя
  const [drivers] = await pool.query(
    'SELECT id FROM drivers WHERE id = ?',
    [driver_id]
  );
  
  if (drivers.length === 0) {
    throw new ApiError(404, 'Водитель не найден');
  }
  
  // Создать маршрут
  const [result] = await pool.query(`
    INSERT INTO route_history (
      vehicle_id, driver_id, start_lat, start_lng, end_lat, end_lng, 
      distance_km, cargo_type, cargo_description, duration_days, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `, [
    vehicleDbId, driver_id, start_lat, start_lng, end_lat, end_lng,
    distance_km || 0, cargo_type || '', cargo_description || '', duration_days || 1
  ]);
  
  logger.info(`Новый маршрут создан: ID ${result.insertId} для транспорта ${vehicle_id}`);
  
  res.status(201).json({ 
    success: true, 
    route_id: result.insertId,
    message: 'Маршрут успешно создан' 
  });
}));

// Обновить маршрут
router.put('/:id', authenticateToken, routeValidators.update, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Проверяем существование маршрута
  const [existing] = await pool.query(
    'SELECT id FROM route_history WHERE id = ?',
    [id]
  );
  
  if (existing.length === 0) {
    throw new ApiError(404, 'Маршрут не найден');
  }
  
  // Формируем динамический запрос
  const allowedFields = [
    'start_lat', 'start_lng', 'end_lat', 'end_lng',
    'distance_km', 'cargo_type', 'cargo_description', 
    'duration_days', 'status'
  ];
  
  const updateFields = [];
  const values = [];
  
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateFields.push(`${field} = ?`);
      values.push(updates[field]);
    }
  }
  
  if (updateFields.length === 0) {
    throw new ApiError(400, 'Нет данных для обновления');
  }
  
  // Если статус меняется на completed, устанавливаем end_time
  if (updates.status === 'completed') {
    updateFields.push('end_time = NOW()');
  }
  
  values.push(id);
  
  await pool.query(
    `UPDATE route_history SET ${updateFields.join(', ')} WHERE id = ?`,
    values
  );
  
  logger.info(`Маршрут обновлен: ID ${id}`);
  
  res.json({
    success: true,
    message: 'Маршрут успешно обновлен'
  });
}));

// Удалить маршрут
router.delete('/:id', authenticateToken, authorize('admin'), routeValidators.delete, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const [result] = await pool.query(
    'DELETE FROM route_history WHERE id = ?',
    [id]
  );
  
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Маршрут не найден');
  }
  
  logger.info(`Маршрут удален: ID ${id}`);
  
  res.json({
    success: true,
    message: 'Маршрут успешно удален'
  });
}));

// Получить статистику по маршрутам
router.get('/stats/summary', authenticateToken, asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;
  
  let dateCondition = '';
  const params = [];
  
  if (start_date && end_date) {
    dateCondition = ' WHERE start_time BETWEEN ? AND ?';
    params.push(start_date, end_date);
  }
  
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_routes,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_routes,
      COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_routes,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_routes,
      SUM(distance_km) as total_distance,
      AVG(distance_km) as avg_distance,
      SUM(duration_days) as total_days,
      AVG(duration_days) as avg_days
    FROM route_history
    ${dateCondition}
  `, params);
  
  res.json(stats[0]);
}));

export default router;