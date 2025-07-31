import mysql from 'mysql2/promise';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';

// Создаем пул соединений с базой данных
export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: config.database.waitForConnections,
  connectionLimit: config.database.connectionLimit,
  queueLimit: config.database.queueLimit,
  enableKeepAlive: config.database.enableKeepAlive,
  keepAliveInitialDelay: config.database.keepAliveInitialDelay
});

// Проверка подключения к базе данных
export async function checkDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    logger.info('✅ База данных подключена успешно');
    return true;
  } catch (error) {
    logger.error('❌ Ошибка подключения к базе данных:', error);
    return false;
  }
}

// Функция для выполнения транзакций
export async function executeTransaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}