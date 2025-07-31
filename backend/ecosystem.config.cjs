module.exports = {
  apps: [{
    name: 'gps-tracker-backend',
    script: 'server.js',
    instances: 1, // Изменено на 1 для начала
    exec_mode: 'fork', // Изменено на fork для простоты
    env: {
      NODE_ENV: 'development',
      PORT: 3003
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3003, // Изменен порт
      DB_HOST: '194.163.179.97',
      DB_PORT: 3306,
      DB_USER: 'baha_usr',
      DB_PASSWORD: 'rLn8UWkaOy1lCzxw',
      DB_NAME: 'baha',
      DB_CONNECTION_LIMIT: 10,
      JWT_SECRET: 'your-super-secret-jwt-key-change-this-in-production',
      JWT_EXPIRES_IN: '7d',
      SOCKET_UPDATE_INTERVAL: 5000,
      RATE_LIMIT_WINDOW_MS: 900000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      LOG_LEVEL: 'info',
      LOG_FILE: 'logs/app.log'
    },
    // Настройки логирования
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Автоматический перезапуск
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Настройки для продакшена
    min_uptime: '10s',
    max_restarts: 10,
    
    // Переменные окружения для мониторинга
    pmx: true,
    
    // Настройки для graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Настройки для кластера
    instance_var: 'INSTANCE_ID',
    
    // Настройки для логов
    merge_logs: true,
    
    // Настройки для мониторинга
    monitoring: true
  }]
};