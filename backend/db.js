import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: 'localhost',
  user: 'baha_usr', // замените на вашего пользователя
  password: 'rLn8UWkaOy1lCzxw', // замените на ваш пароль
  database: 'baha', // замените на вашу БД
  port: 3002 // если MySQL на стандартном порту
});