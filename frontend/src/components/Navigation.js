import React from 'react';
import { NavLink } from 'react-router-dom';

function Navigation() {
  return (
    <nav className="app-nav">
      <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>Dashboard</NavLink>
      <NavLink to="/proyectos" className={({ isActive }) => isActive ? 'active' : ''}>Proyectos</NavLink>
      <NavLink to="/certificaciones" className={({ isActive }) => isActive ? 'active' : ''}>Certificaciones</NavLink>
      <NavLink to="/licitaciones" className={({ isActive }) => isActive ? 'active' : ''}>Licitaciones</NavLink>
    </nav>
  );
}

export default Navigation;
