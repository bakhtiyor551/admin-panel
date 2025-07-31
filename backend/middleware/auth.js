import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { ApiError } from './errorHandler.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new ApiError(401, 'Токен не предоставлен');
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Токен истек');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Недействительный токен');
    }
    throw new ApiError(401, 'Ошибка аутентификации');
  }
};

// Middleware для проверки ролей
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Не авторизован');
    }
    
    if (!roles.includes(req.user.role)) {
      throw new ApiError(403, 'Недостаточно прав доступа');
    }
    
    next();
  };
};

// Генерация JWT токена
export const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      login: user.login, 
      role: user.role 
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};