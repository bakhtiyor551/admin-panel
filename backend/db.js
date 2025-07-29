import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // замените на вашего пользователя
  password: '', // замените на ваш пароль
  database: 'admin_panel', // замените на вашу БД
  port: 3306 // если MySQL на стандартном порту
});