import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'baha_usr',
  password: process.env.DB_PASSWORD || 'rLn8UWkaOy1lCzxw',
  database: process.env.DB_NAME || 'baha',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});