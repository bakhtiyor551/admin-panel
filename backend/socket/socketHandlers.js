import { pool } from '../db.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

export function setupSocketHandlers(io) {
  // Интервал для отправки позиций
  let positionInterval;
  
  io.on('connection', (socket) => {
    logger.info(`Socket подключен: ${socket.id}`);
    
    // Отправка текущих позиций при подключении
    sendCurrentPositions(socket);
    
    // Подписка на обновления конкретного транспорта
    socket.on('subscribe:vehicle', async (vehicleId) => {
      socket.join(`vehicle:${vehicleId}`);
      logger.info(`Socket ${socket.id} подписался на транспорт ${vehicleId}`);
      
      // Отправляем последнюю позицию
      await sendVehiclePosition(socket, vehicleId);
    });
    
    // Отписка от транспорта
    socket.on('unsubscribe:vehicle', (vehicleId) => {
      socket.leave(`vehicle:${vehicleId}`);
      logger.info(`Socket ${socket.id} отписался от транспорта ${vehicleId}`);
    });
    
    // Обновление позиции от клиента
    socket.on('position:update', async (data) => {
      const { vehicleId, lat, lng } = data;
      
      try {
        // Находим внутренний ID транспорта
        const [vehicles] = await pool.query(
          'SELECT id FROM vehicles WHERE vehicle_id = ?',
          [vehicleId]
        );
        
        if (vehicles.length > 0) {
          const vehicleDbId = vehicles[0].id;
          
          // Сохраняем позицию
          await pool.query(
            'INSERT INTO positions (vehicle_id, lat, lng) VALUES (?, ?, ?)',
            [vehicleDbId, lat, lng]
          );
          
          // Отправляем обновление всем подписчикам
          io.to(`vehicle:${vehicleId}`).emit('position:updated', {
            vehicleId,
            lat,
            lng,
            timestamp: new Date()
          });
          
          logger.info(`Позиция обновлена для транспорта ${vehicleId}`);
        }
      } catch (error) {
        logger.error('Ошибка обновления позиции:', error);
        socket.emit('error', { message: 'Ошибка обновления позиции' });
      }
    });
    
    // Отключение
    socket.on('disconnect', () => {
      logger.info(`Socket отключен: ${socket.id}`);
    });
  });
  
  // Периодическая отправка позиций всем клиентам
  if (config.socket.updateInterval > 0) {
    positionInterval = setInterval(async () => {
      await broadcastPositions(io);
    }, config.socket.updateInterval);
  }
  
  // Очистка при закрытии
  io.on('close', () => {
    if (positionInterval) {
      clearInterval(positionInterval);
    }
  });
}

// Отправка текущих позиций новому клиенту
async function sendCurrentPositions(socket) {
  try {
    const [positions] = await pool.query(`
      SELECT 
        p.*,
        v.vehicle_id,
        CONCAT(v.brand, ' ', v.model) as vehicle_name
      FROM positions p
      INNER JOIN (
        SELECT vehicle_id, MAX(id) as max_id
        FROM positions
        GROUP BY vehicle_id
      ) last ON p.vehicle_id = last.vehicle_id AND p.id = last.max_id
      LEFT JOIN vehicles v ON p.vehicle_id = v.id
    `);
    
    socket.emit('positions:current', positions);
  } catch (error) {
    logger.error('Ошибка отправки текущих позиций:', error);
  }
}

// Отправка позиции конкретного транспорта
async function sendVehiclePosition(socket, vehicleId) {
  try {
    const [vehicles] = await pool.query(
      'SELECT id FROM vehicles WHERE vehicle_id = ?',
      [vehicleId]
    );
    
    if (vehicles.length === 0) return;
    
    const vehicleDbId = vehicles[0].id;
    
    const [positions] = await pool.query(
      'SELECT * FROM positions WHERE vehicle_id = ? ORDER BY timestamp DESC LIMIT 1',
      [vehicleDbId]
    );
    
    if (positions.length > 0) {
      socket.emit('position:vehicle', {
        vehicleId,
        ...positions[0]
      });
    }
  } catch (error) {
    logger.error('Ошибка отправки позиции транспорта:', error);
  }
}

// Широковещательная отправка позиций
async function broadcastPositions(io) {
  try {
    const [positions] = await pool.query(`
      SELECT 
        p.*,
        v.vehicle_id,
        CONCAT(v.brand, ' ', v.model) as vehicle_name
      FROM positions p
      INNER JOIN (
        SELECT vehicle_id, MAX(id) as max_id
        FROM positions
        WHERE timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        GROUP BY vehicle_id
      ) last ON p.vehicle_id = last.vehicle_id AND p.id = last.max_id
      LEFT JOIN vehicles v ON p.vehicle_id = v.id
    `);
    
    positions.forEach(position => {
      io.emit('positionUpdate', {
        vehicleId: position.vehicle_id,
        lat: position.lat,
        lng: position.lng,
        timestamp: position.timestamp,
        vehicleName: position.vehicle_name
      });
    });
  } catch (error) {
    logger.error('Ошибка широковещательной отправки позиций:', error);
  }
}