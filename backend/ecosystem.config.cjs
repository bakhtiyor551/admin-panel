module.exports = {
  apps: [{
    name: 'gps-tracker-backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3003
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002,
      DB_HOST: 'localhost',
      DB_PORT: 3306,
      DB_USER: 'baha_usr',
      DB_PASSWORD: 'rLn8UWkaOy1lCzxw',
      DB_NAME: 'baha',
      DB_CONNECTION_LIMIT: 10
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    pmx: true,
    kill_timeout: 5000,
    listen_timeout: 3000,
    instance_var: 'INSTANCE_ID',
    merge_logs: true,
    monitoring: true
  }]
};