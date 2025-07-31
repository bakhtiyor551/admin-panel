import { body, param, query, validationResult } from 'express-validator';
import { ApiError } from './errorHandler.js';

// Middleware для проверки результатов валидации
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    throw new ApiError(400, errorMessages.join(', '));
  }
  next();
};

// Валидаторы для позиций
export const positionValidators = {
  create: [
    body('vehicle_id').notEmpty().withMessage('vehicle_id обязателен'),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Широта должна быть между -90 и 90'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Долгота должна быть между -180 и 180'),
    validate
  ],
  
  getByVehicle: [
    param('vehicle_id').notEmpty().withMessage('vehicle_id обязателен'),
    validate
  ]
};

// Валидаторы для транспорта
export const vehicleValidators = {
  create: [
    body('vehicle_id').notEmpty().withMessage('vehicle_id обязателен'),
    body('brand').notEmpty().withMessage('Марка обязательна'),
    body('model').notEmpty().withMessage('Модель обязательна'),
    body('license_plate').notEmpty().withMessage('Номерной знак обязателен'),
    validate
  ]
};

// Валидаторы для маршрутов
export const routeValidators = {
  create: [
    body('vehicle_id').notEmpty().withMessage('vehicle_id обязателен'),
    body('driver_id').isInt().withMessage('driver_id должен быть числом'),
    body('start_lat').isFloat({ min: -90, max: 90 }).withMessage('Начальная широта некорректна'),
    body('start_lng').isFloat({ min: -180, max: 180 }).withMessage('Начальная долгота некорректна'),
    body('end_lat').isFloat({ min: -90, max: 90 }).withMessage('Конечная широта некорректна'),
    body('end_lng').isFloat({ min: -180, max: 180 }).withMessage('Конечная долгота некорректна'),
    body('distance_km').optional().isFloat({ min: 0 }).withMessage('Расстояние должно быть положительным'),
    body('cargo_type').optional().isString().withMessage('Тип груза должен быть строкой'),
    body('cargo_description').optional().isString().withMessage('Описание груза должно быть строкой'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('Продолжительность должна быть минимум 1 день'),
    validate
  ],
  
  update: [
    param('id').isInt().withMessage('ID должен быть числом'),
    body('start_lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Начальная широта некорректна'),
    body('start_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Начальная долгота некорректна'),
    body('end_lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Конечная широта некорректна'),
    body('end_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Конечная долгота некорректна'),
    body('distance_km').optional().isFloat({ min: 0 }).withMessage('Расстояние должно быть положительным'),
    body('cargo_type').optional().isString().withMessage('Тип груза должен быть строкой'),
    body('cargo_description').optional().isString().withMessage('Описание груза должно быть строкой'),
    body('duration_days').optional().isInt({ min: 1 }).withMessage('Продолжительность должна быть минимум 1 день'),
    body('status').optional().isIn(['pending', 'in_progress', 'completed', 'cancelled']).withMessage('Некорректный статус'),
    validate
  ],
  
  delete: [
    param('id').isInt().withMessage('ID должен быть числом'),
    validate
  ]
};

// Валидаторы для аутентификации
export const authValidators = {
  login: [
    body('login').notEmpty().withMessage('Логин обязателен'),
    body('password').notEmpty().withMessage('Пароль обязателен'),
    validate
  ],
  
  register: [
    body('login').notEmpty().isLength({ min: 3 }).withMessage('Логин должен быть минимум 3 символа'),
    body('password').notEmpty().isLength({ min: 6 }).withMessage('Пароль должен быть минимум 6 символов'),
    body('role').optional().isIn(['admin', 'driver', 'user']).withMessage('Некорректная роль'),
    validate
  ]
};