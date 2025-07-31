import { Router } from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../db.js';
import { generateToken } from '../middleware/auth.js';
import { authValidators } from '../middleware/validators.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Регистрация
router.post('/register', authValidators.register, asyncHandler(async (req, res) => {
  const { login, password, role = 'user' } = req.body;
  
  // Проверяем, существует ли пользователь
  const [existingUsers] = await pool.query(
    'SELECT id FROM users WHERE login = ?',
    [login]
  );
  
  if (existingUsers.length > 0) {
    throw new ApiError(409, 'Пользователь с таким логином уже существует');
  }
  
  // Хешируем пароль
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Создаем пользователя
  const [result] = await pool.query(
    'INSERT INTO users (login, password, role) VALUES (?, ?, ?)',
    [login, hashedPassword, role]
  );
  
  const user = {
    id: result.insertId,
    login,
    role
  };
  
  logger.info(`Новый пользователь зарегистрирован: ${login}`);
  
  res.status(201).json({
    success: true,
    token: generateToken(user),
    user
  });
}));

// Вход
router.post('/login', authValidators.login, asyncHandler(async (req, res) => {
  const { login, password } = req.body;
  
  // Поиск пользователя
  const [users] = await pool.query(
    'SELECT id, login, password, role FROM users WHERE login = ?',
    [login]
  );
  
  if (users.length === 0) {
    throw new ApiError(401, 'Неверный логин или пароль');
  }
  
  const user = users[0];
  
  // Проверка пароля
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    throw new ApiError(401, 'Неверный логин или пароль');
  }
  
  logger.info(`Пользователь вошел в систему: ${login}`);
  
  res.json({
    success: true,
    token: generateToken(user),
    user: {
      id: user.id,
      login: user.login,
      role: user.role
    }
  });
}));

export default router;