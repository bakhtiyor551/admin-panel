import { Router } from 'express';
import { pool } from '../db.js';
import { authenticateToken, authorize } from '../middleware/auth.js';
import { vehicleValidators } from '../middleware/validators.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Получить все транспортные средства
router.get('/', asyncHandler(async (req, res) => {
  const [vehicles] = await pool.query(`
    SELECT 
      v.*,
      d.name as driver_name,
      d.phone_number as driver_phone,
      dva.assigned_at
    FROM vehicles v
    LEFT JOIN driver_vehicle_assignments dva ON v.id = dva.vehicle_id
    LEFT JOIN drivers d ON dva.driver_id = d.id
    ORDER BY v.id DESC
  `);
  
  res.json(vehicles);
}));

// Получить транспорт по ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const [vehicles] = await pool.query(
    'SELECT * FROM vehicles WHERE id = ?',
    [id]
  );
  
  if (vehicles.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  res.json(vehicles[0]);
}));

// Создать новый транспорт
router.post('/', authenticateToken, authorize('admin'), vehicleValidators.create, asyncHandler(async (req, res) => {
  const { vehicle_id, brand, model, license_plate, status = 'active' } = req.body;
  
  // Проверяем уникальность vehicle_id
  const [existing] = await pool.query(
    'SELECT id FROM vehicles WHERE vehicle_id = ?',
    [vehicle_id]
  );
  
  if (existing.length > 0) {
    throw new ApiError(409, 'Транспорт с таким ID уже существует');
  }
  
  const [result] = await pool.query(
    'INSERT INTO vehicles (vehicle_id, brand, model, license_plate, status) VALUES (?, ?, ?, ?, ?)',
    [vehicle_id, brand, model, license_plate, status]
  );
  
  logger.info(`Новый транспорт добавлен: ${brand} ${model} (${vehicle_id})`);
  
  res.status(201).json({
    success: true,
    vehicle: {
      id: result.insertId,
      vehicle_id,
      brand,
      model,
      license_plate,
      status
    }
  });
}));

// Обновить транспорт
router.put('/:id', authenticateToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { brand, model, license_plate, status } = req.body;
  
  // Проверяем существование
  const [existing] = await pool.query(
    'SELECT id FROM vehicles WHERE id = ?',
    [id]
  );
  
  if (existing.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  // Формируем динамический запрос
  const updates = [];
  const values = [];
  
  if (brand !== undefined) {
    updates.push('brand = ?');
    values.push(brand);
  }
  if (model !== undefined) {
    updates.push('model = ?');
    values.push(model);
  }
  if (license_plate !== undefined) {
    updates.push('license_plate = ?');
    values.push(license_plate);
  }
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }
  
  if (updates.length === 0) {
    throw new ApiError(400, 'Нет данных для обновления');
  }
  
  values.push(id);
  
  await pool.query(
    `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  logger.info(`Транспорт обновлен: ID ${id}`);
  
  res.json({
    success: true,
    message: 'Транспорт успешно обновлен'
  });
}));

// Удалить транспорт
router.delete('/:id', authenticateToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const [result] = await pool.query(
    'DELETE FROM vehicles WHERE id = ?',
    [id]
  );
  
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  logger.info(`Транспорт удален: ID ${id}`);
  
  res.json({
    success: true,
    message: 'Транспорт успешно удален'
  });
}));

// Назначить водителя на транспорт
router.post('/:id/assign-driver', authenticateToken, authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { driver_id } = req.body;
  
  if (!driver_id) {
    throw new ApiError(400, 'driver_id обязателен');
  }
  
  // Проверяем существование транспорта и водителя
  const [vehicles] = await pool.query('SELECT id FROM vehicles WHERE id = ?', [id]);
  const [drivers] = await pool.query('SELECT id FROM drivers WHERE id = ?', [driver_id]);
  
  if (vehicles.length === 0) {
    throw new ApiError(404, 'Транспорт не найден');
  }
  
  if (drivers.length === 0) {
    throw new ApiError(404, 'Водитель не найден');
  }
  
  // Удаляем старое назначение
  await pool.query(
    'DELETE FROM driver_vehicle_assignments WHERE vehicle_id = ?',
    [id]
  );
  
  // Создаем новое назначение
  await pool.query(
    'INSERT INTO driver_vehicle_assignments (driver_id, vehicle_id) VALUES (?, ?)',
    [driver_id, id]
  );
  
  logger.info(`Водитель ${driver_id} назначен на транспорт ${id}`);
  
  res.json({
    success: true,
    message: 'Водитель успешно назначен'
  });
}));

export default router;