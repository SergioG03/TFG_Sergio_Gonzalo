import React from 'react';
import { Link } from 'react-router-dom';

function Dashboard() {
  return (
    <div>
      <h2>Dashboard Principal</h2>
      <p>Bienvenido a la plataforma blockchain para la gestión de construcción.</p>
      <div className="dashboard">
        <div className="dashboard-card">
          <h3>Proyectos</h3>
          <p>Gestiona y supervisa el ciclo de vida de tus proyectos de construcción.</p>
          <Link to="/proyectos">Ir a Proyectos</Link>
        </div>
        <div className="dashboard-card">
          <h3>Certificaciones</h3>
          <p>Administra licencias, permisos y certificaciones de obra de forma segura.</p>
          <Link to="/certificaciones">Ir a Certificaciones</Link>
        </div>
        <div className="dashboard-card">
          <h3>Licitaciones</h3>
          <p>Participa y gestiona licitaciones y presupuestos de forma transparente.</p>
          <Link to="/licitaciones">Ir a Licitaciones</Link>
        </div>
         <div className="dashboard-card">
          <h3>Monitorización</h3>
          <p>Visualiza métricas de la red Blockchain</p>
          {}
          <a href="http://192.168.49.2:30030" target="_blank" rel="noopener noreferrer">Abrir Grafana</a>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
