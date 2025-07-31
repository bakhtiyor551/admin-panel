import { Router } from 'express';
import { pool } from '../db.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { body } from 'express-validator';
import { validate } from '../middleware/validators.js';

const router = Router();

// Валидаторы для водителей
const driverValidators = {
  create: [
    body('name').notEmpty().withMessage('Имя обязательно'),
    body('phone_number').optional().isMobilePhone('any').withMessage('Некорректный номер телефона'),
    validate
  ],
  update: [
    body('name').optional().notEmpty().withMessage('Имя не может быть пустым'),
    body('phone_number').optional().isMobilePhone('any').withMessage('Некорректный номер телефона'),
    body('status').optional().isIn(['active', 'inactive']).withMessage('Некорректный статус'),
    validate
  ]
};

// Получить всех водителей
router.get('/', asyncHandler(async (req, res) => {
  const { status = 'active' } = req.query;
  
  let query = 'SELECT * FROM drivers';
  const params = [];
  
  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }
  
  query += ' ORDER BY created_at DESC';
  
  const [drivers] = await pool.query(query, params);
  
  res.json(drivers);
}));

// Получить водителя по ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const [drivers] = await pool.query(
    'SELECT * FROM drivers WHERE id = ?',
    [id]
  );
  
  if (drivers.length === 0) {
    throw new ApiError(404, 'Водитель не найден');
  }
  
  // Получаем назначенный транспорт
  const [assignments] = await pool.query(`
    SELECT 
      v.id,
      v.vehicle_id,
      v.brand,
      v.model,
      v.license_plate,
      dva.assigned_at
    FROM driver_vehicle_assignments dva
    JOIN vehicles v ON dva.vehicle_id = v.id
    WHERE dva.driver_id = ?
  `, [id]);
  
  const driver = {
    ...drivers[0],
    assigned_vehicle: assignments[0] || null
  };
  
  res.json(driver);
}));

// Создать водителя
router.post('/', authenticateToken, authorize('admin'), driverValidators.create, asyncHandler(async (req, res) => {
  const { name, phone_number, status = 'active' } = req.body;
  
  const [result] = await pool.query(
    'INSERT INTO drivers (name, phone_number, status) VALUES (?, ?, ?)',
    [name, phone_number || null, status]
  );
  
  logger.info(`Новый водитель добавлен: ${name} (ID: ${result.insertId})`);
  
  res.status(201).json({
    success: true,
    driver: {
      id: result.insertId,
      name,
      phone_number,
      status,
      created_at: new Date()
    }
  });
}));

// Обновить водителя
router.put('/:id', authenticateToken, authorize('admin'), driverValidators.update, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Проверяем существование
  const [existing] = await pool.query(
    'SELECT id FROM drivers WHERE id = ?',
    [id]
  );
  
  if (existing.length === 0) {
    throw new ApiError(404, 'Водитель не найден');
  }
  
  // Формируем динамический запрос
  const allowedFields = ['name', 'phone_number', 'status'];
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
  
  values.push(id);
  
  await pool.query(
    `UPDATE drivers SET ${updateFields.join(', ')} WHERE id = ?`,
    values
  );
  
  logger.info(`Водитель обновлен: ID ${id}`);
  
  res.json({
    success: true,
    message: 'Водитель успешно обновлен'
  });
}));

// Удалить водителя
router.delete('/:id', authenticateToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const [result] = await pool.query(
    'DELETE FROM drivers WHERE id = ?',
    [id]
  );
  
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Водитель не найден');
  }
  
  logger.info(`Водитель удален: ID ${id}`);
  
  res.json({
    success: true,
    message: 'Водитель успешно удален'
  });
}));

// Получить историю маршрутов водителя
router.get('/:id/routes', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;
  
  // Проверяем существование водителя
  const [drivers] = await pool.query(
    'SELECT id FROM drivers WHERE id = ?',
    [id]
  );
  
  if (drivers.length === 0) {
    throw new ApiError(404, 'Водитель не найден');
  }
  
  const [routes] = await pool.query(`
    SELECT 
      rh.*,
      v.vehicle_id,
      v.brand,
      v.model,
      CONCAT(v.brand, ' ', v.model) as vehicle_name
    FROM route_history rh
    JOIN vehicles v ON rh.vehicle_id = v.id
    WHERE rh.driver_id = ?
    ORDER BY rh.start_time DESC
    LIMIT ? OFFSET ?
  `, [id, parseInt(limit), parseInt(offset)]);
  
  res.json(routes);
}));

// Получить статистику водителя
router.get('/:id/stats', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Проверяем существование водителя
  const [drivers] = await pool.query(
    'SELECT id, name FROM drivers WHERE id = ?',
    [id]
  );
  
  if (drivers.length === 0) {
    throw new ApiError(404, 'Водитель не найден');
  }
  
  const [stats] = await pool.query(`
    SELECT 
      COUNT(*) as total_routes,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_routes,
      SUM(distance_km) as total_distance,
      AVG(distance_km) as avg_distance,
      SUM(duration_days) as total_days
    FROM route_history
    WHERE driver_id = ?
  `, [id]);
  
  res.json({
    driver: drivers[0],
    stats: stats[0]
  });
}));

export default router;