import React from 'react';
import WalletConnect from './WalletConnect';

function Header({ account, isConnected, networkOk, error, connectWallet, disconnectWallet }) {
  return (
    <header className="app-header">
      <h1>🏗️ Blockchain Construcción</h1>
      <WalletConnect
        account={account}
        isConnected={isConnected}
        networkOk={networkOk}
        error={error}
        connectWallet={connectWallet}
        disconnectWallet={disconnectWallet}
      />
    </header>
  );
}

export default Header;
