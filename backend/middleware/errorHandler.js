import { logger } from '../utils/logger.js';

// Класс для API ошибок
export class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Обработчик ошибок
export const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  
  // Логируем ошибку
  logger.error({
    error: err,
    request: req.url,
    method: req.method,
    ip: req.ip,
    statusCode: statusCode || 500
  });
  
  // Значения по умолчанию
  statusCode = statusCode || 500;
  message = message || 'Внутренняя ошибка сервера';
  
  // В продакшене не показываем детали ошибок
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
    message = 'Что-то пошло не так';
  }
  
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Обработчик для несуществующих маршрутов
export const notFound = (req, res, next) => {
  const message = `Маршрут не найден - ${req.originalUrl}`;
  next(new ApiError(404, message));
};

// Обертка для асинхронных функций
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};