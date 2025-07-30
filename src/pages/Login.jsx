import React, { useState } from 'react';

export default function Login({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3002/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ login, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Сохраняем токен и информацию о пользователе
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Вызываем callback для обновления состояния в родительском компоненте
        onLogin(data.user);
      } else {
        setError(data.error || 'Ошибка авторизации');
      }
    } catch (error) {
      setError('Ошибка сети. Проверьте подключение к серверу.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <div className="card" style={{
        maxWidth: '400px',
        width: '100%',
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'white',
        borderRadius: '15px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{ 
          marginBottom: '30px', 
          color: '#333',
          fontSize: '2rem',
          fontWeight: 'bold'
        }}>
          🚗 Система отслеживания
        </h1>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" htmlFor="login" style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#333',
              textAlign: 'left'
            }}>
              👤 Логин
            </label>
            <input
              type="text"
              id="login"
              className="form-input"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              placeholder="Введите логин"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '30px' }}>
            <label className="form-label" htmlFor="password" style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: '600',
              color: '#333',
              textAlign: 'left'
            }}>
              🔒 Пароль
            </label>
            <input
              type="password"
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Введите пароль"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div className="error-message" style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#dc2626',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '0.9rem'
            }}>
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '1.1rem',
              opacity: loading ? 0.7 : 1,
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600'
            }}
          >
            {loading ? '⏳ Вход...' : '🚀 Войти'}
          </button>
        </form>

        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#1d4ed8', fontSize: '1rem' }}>
            📋 Тестовые данные:
          </h3>
          <div style={{ fontSize: '0.9rem', color: '#666', lineHeight: '1.5' }}>
            <div><strong>Админ:</strong> admin / admin123</div>
            <div><strong>Водитель:</strong> driver / driver123</div>
          </div>
        </div>
      </div>
    </div>
  );
}