import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/config.js';
import { pool, checkDatabaseConnection } from './db.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { initializeDatabase } from './utils/dbInit.js';
import { setupSocketHandlers } from './socket/socketHandlers.js';

// Импорт роутов
import authRoutes from './routes/authRoutes.js';
import vehicleRoutes from './routes/vehicleRoutes.js';
import positionRoutes from './routes/positionRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import driverRoutes from './routes/driverRoutes.js';

const app = express();

// Middleware для безопасности
app.use(helmet());
app.use(compression());

// CORS настройки
app.use(cors({
  origin: config.server.isDev ? '*' : process.env.FRONTEND_URL,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: 'Слишком много запросов с этого IP, попробуйте позже'
});

app.use('/api/', limiter);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логирование запросов
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Проверка здоровья сервера
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// API роуты
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/drivers', driverRoutes);

// Обработка несуществующих маршрутов
app.use(notFound);

// Центральная обработка ошибок
app.use(errorHandler);

// Создание HTTP сервера
const httpServer = createServer(app);

// Настройка Socket.IO
const io = new Server(httpServer, {
  cors: config.socket.cors,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Сохраняем io в app для доступа из роутов
app.set('io', io);

// Настройка обработчиков Socket.IO
setupSocketHandlers(io);

// Запуск сервера
async function startServer() {
  try {
    // Проверка подключения к БД
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error('Не удалось подключиться к базе данных');
    }
    
    // Инициализация базы данных
    await initializeDatabase();
    
    // Запуск HTTP сервера
    httpServer.listen(config.server.port, () => {
      logger.info(`🚀 Сервер запущен на порту ${config.server.port}`);
      logger.info(`📊 Окружение: ${config.server.env}`);
      logger.info(`🔌 Socket.IO готов к подключениям`);
      
      if (config.server.isDev) {
        logger.info(`📝 API документация: http://localhost:${config.server.port}/api-docs`);
      }
    });
    
  } catch (error) {
    logger.error('Ошибка запуска сервера:', error);
    process.exit(1);
  }
}

// Обработка завершения процесса
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  logger.info('Получен сигнал завершения, начинаем graceful shutdown...');
  
  // Закрываем HTTP сервер
  httpServer.close(() => {
    logger.info('HTTP сервер закрыт');
  });
  
  // Закрываем подключения Socket.IO
  io.close(() => {
    logger.info('Socket.IO закрыт');
  });
  
  // Закрываем пул соединений с БД
  try {
    await pool.end();
    logger.info('Пул соединений с БД закрыт');
  } catch (error) {
    logger.error('Ошибка при закрытии пула БД:', error);
  }
  
  process.exit(0);
}

// Запускаем сервер
startServer(); 