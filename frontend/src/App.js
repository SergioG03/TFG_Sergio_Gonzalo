import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { useEthers } from './hooks/useEthers'; // Import the custom hook

import Header from './components/Header';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Proyectos from './pages/Proyectos';
import Certificaciones from './pages/Certificaciones';
import Licitaciones from './pages/Licitaciones';
import './App.css';


function Layout({ account, isConnected, networkOk, error, connectWallet, disconnectWallet }) {
  return (
    <div className="app">
      <Header
        account={account}
        isConnected={isConnected}
        networkOk={networkOk}
        error={error}
        connectWallet={connectWallet}
        disconnectWallet={disconnectWallet}
      />
      <Navigation />
      <main className="app-content">
        {/* Outlet renderiza el componente de la ruta hija coincidente */}
        <Outlet />
      </main>
      <footer className="app-footer">
        <p>© 2024 Plataforma Blockchain Construcción TFG - Sergio Gonzalo</p>
      </footer>
    </div>
  );
}


function App() {
  const {
    provider,
    signer,
    account, // Obtenemos la cuenta conectada del hook
    isConnected,
    networkOk,
    error: walletError,
    connectWallet,
    disconnectWallet
   } = useEthers();

  return (
    <Router>
      <Routes>
        {/* Ruta Raíz que usa el Layout como elemento principal */}
        <Route
          path="/"
          element={
            <Layout
              account={account}
              isConnected={isConnected}
              networkOk={networkOk}
              error={walletError}
              connectWallet={connectWallet}
              disconnectWallet={disconnectWallet}
            />
          }
        >
          {/* Rutas Hijas que se renderizarán dentro del <Outlet /> del Layout */}
          {/* Ruta por defecto (Dashboard) */}
          <Route index element={<Dashboard />} />

          {/* Ruta para Proyectos, pasamos las props necesarias */}
          <Route
            path="proyectos"
            element={
              <Proyectos
                signer={signer}
                provider={provider}
                account={account} // <- Pasamos la cuenta
              />
            }
          />

          {/* Ruta para Certificaciones, pasamos las props necesarias */}
          <Route
            path="certificaciones"
            element={
              <Certificaciones
                signer={signer}
                provider={provider}
                account={account} // <- Pasamos la cuenta
              />
            }
          />

          {/* Ruta para Licitaciones, pasamos las props necesarias */}
          <Route
            path="licitaciones"
            element={
              <Licitaciones
                signer={signer}
                provider={provider}
                account={account} // <- Pasamos la cuenta (asumiendo que la necesita)
              />
            }
          />

          {/* Ruta comodín para páginas no encontradas */}
          <Route path="*" element={<h2>Página no encontrada</h2>} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;