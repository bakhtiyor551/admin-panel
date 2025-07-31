import { pool } from '../db.js';
import { logger } from './logger.js';
import bcrypt from 'bcrypt';

export async function initializeDatabase() {
  try {
    // Создание таблицы пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        login VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы водителей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы транспорта
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vehicle_id VARCHAR(50) UNIQUE NOT NULL,
        brand VARCHAR(100),
        model VARCHAR(100),
        license_plate VARCHAR(20),
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Создание таблицы позиций
    await pool.query(`
      CREATE TABLE IF NOT EXISTS positions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vehicle_id INT,
        lat DECIMAL(10, 8),
        lng DECIMAL(11, 8),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        INDEX idx_vehicle_timestamp (vehicle_id, timestamp)
      )
    `);
    
    // Создание таблицы назначений водителей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        driver_id INT,
        vehicle_id INT,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        UNIQUE KEY unique_vehicle_assignment (vehicle_id)
      )
    `);
    
    // Создание таблицы истории маршрутов
    await pool.query(`
      CREATE TABLE IF NOT EXISTS route_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vehicle_id INT,
        driver_id INT,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        end_time TIMESTAMP NULL,
        start_lat DECIMAL(10, 8),
        start_lng DECIMAL(11, 8),
        end_lat DECIMAL(10, 8),
        end_lng DECIMAL(11, 8),
        distance_km DECIMAL(10, 2),
        cargo_type VARCHAR(100),
        cargo_description TEXT,
        duration_days INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'pending',
        route_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
        INDEX idx_vehicle_date (vehicle_id, start_time)
      )
    `);
    
    // Создание таблицы истории (для обратной совместимости)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vehicle_id INT,
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        from_lat DECIMAL(10, 8),
        from_lng DECIMAL(11, 8),
        to_lat DECIMAL(10, 8),
        to_lng DECIMAL(11, 8),
        route JSON,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      )
    `);
    
    // Создание тестовых пользователей
    await createDefaultUsers();
    
    logger.info('✅ База данных успешно инициализирована');
  } catch (error) {
    logger.error('❌ Ошибка инициализации базы данных:', error);
    throw error;
  }
}

async function createDefaultUsers() {
  try {
    // Проверяем, есть ли уже пользователи
    const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
    
    if (users[0].count === 0) {
      // Хешируем пароли
      const adminPassword = await bcrypt.hash('admin123', 10);
      const driverPassword = await bcrypt.hash('driver123', 10);
      
      // Создаем пользователей
      await pool.query(`
        INSERT INTO users (login, password, role) VALUES 
        ('admin', ?, 'admin'),
        ('driver', ?, 'driver')
      `, [adminPassword, driverPassword]);
      
      logger.info('📝 Созданы тестовые пользователи:');
      logger.info('   - admin / admin123');
      logger.info('   - driver / driver123');
    }
  } catch (error) {
    // Игнорируем ошибку дубликата
    if (error.code !== 'ER_DUP_ENTRY') {
      throw error;
    }
  }
}