import React from 'react';

export default function ControlPanel({ vehicles, selectedVehicle, setSelectedVehicle, start, finish, handleReset }) {
  return (
    <div style={{
      width: '100%',
      minWidth: 320,
      height: 'calc(100vh - 68px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(255,255,255,0.97)',
      boxShadow: '-8px 0 32px -8px #10b98122',
      borderLeft: '2px solid #10b981',
      padding: '40px 24px',
      gap: 32,
    }}>
      {/* Логотип-заглушка */}
      <div style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10,
        marginBottom: 32
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', background: '#10b981',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 26, boxShadow: '0 2px 8px #10b98133'
        }}>
          <span style={{fontFamily: 'monospace'}}>A</span>
        </div>
        <span style={{ fontWeight: 700, fontSize: 26, color: '#10b981', letterSpacing: 1 }}>Admin Panel</span>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 500, fontSize: 17, width: '100%', maxWidth: 320 }}>
        Транспорт
        <select
          value={selectedVehicle}
          onChange={e => setSelectedVehicle(e.target.value)}
          style={{
            marginTop: 6,
            padding: '10px 14px',
            borderRadius: 10,
            border: '2px solid #10b981',
            fontSize: 17,
            background: '#f8fafc',
            minWidth: 140,
            color: '#065f46',
            fontWeight: 600
          }}
        >
          <option value="">Выберите транспорт</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 500, fontSize: 17, width: '100%', maxWidth: 320 }}>
        Старт
        <input
          type="text"
          value={start ? `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}` : ''}
          readOnly
          style={{
            marginTop: 6,
            padding: '10px 14px',
            borderRadius: 10,
            border: '2px solid #10b981',
            fontSize: 17,
            background: '#f8fafc',
            minWidth: 140,
            color: '#065f46',
            fontWeight: 600
          }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', fontWeight: 500, fontSize: 17, width: '100%', maxWidth: 320 }}>
        Финиш
        <input
          type="text"
          value={finish ? `${finish.lat.toFixed(5)}, ${finish.lng.toFixed(5)}` : ''}
          readOnly
          style={{
            marginTop: 6,
            padding: '10px 14px',
            borderRadius: 10,
            border: '2px solid #10b981',
            fontSize: 17,
            background: '#f8fafc',
            minWidth: 140,
            color: '#065f46',
            fontWeight: 600
          }}
        />
      </label>
      <button
        onClick={handleReset}
        style={{
          marginTop: 18,
          padding: '12px 28px',
          borderRadius: 10,
          border: 'none',
          background: '#ef4444',
          color: '#fff',
          fontWeight: 700,
          fontSize: 17,
          cursor: 'pointer',
          boxShadow: '0 2px 8px #ef444433',
          transition: 'background 0.2s',
          letterSpacing: 1
        }}
        disabled={!finish}
      >
        Сбросить маршрут
      </button>
    </div>
  );
} 