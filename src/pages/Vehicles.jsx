import { useEffect, useState } from 'react';
import axios from 'axios';

const Vehicles = () => {
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:3002/api/vehicles').then(res => setVehicles(res.data));
  }, []);

  return (
    <div>
      <h1>Управление транспортом</h1>
      <ul>
        {vehicles.map(v => (
          <li key={v.id}>{v.name} — {v.status}</li>
        ))}
      </ul>
    </div>
  );
};
export default Vehicles;