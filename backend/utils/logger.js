import winston from 'winston';
import { config } from '../config/config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Создаем папку для логов если её нет
const logsDir = join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Формат для логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Формат для консоли
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  })
);

// Создаем логгер
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports: [
    // Логи в файл
    new winston.transports.File({
      filename: join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// В режиме разработки также выводим в консоль
if (config.server.isDev) {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Обработка необработанных исключений
logger.exceptions.handle(
  new winston.transports.File({ filename: join(logsDir, 'exceptions.log') })
);

// Обработка необработанных промисов
logger.rejections.handle(
  new winston.transports.File({ filename: join(logsDir, 'rejections.log') })
);