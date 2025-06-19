import React from 'react';

function WalletConnect({
  account,
  isConnected,
  networkOk,
  error,
  connectWallet,
  disconnectWallet
}) {
  const formatAddress = (addr) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="wallet-status">
      {error && <div style={{ color: 'red', marginRight: '1rem' }}>Error: {error}</div>}
      {isConnected && (
        <>
          <span className={`network-info ${networkOk ? 'network-ok' : 'network-wrong'}`}>
            {networkOk ? 'Besu Local (OK)' : 'Wrong Network'}
          </span>
          <span className="account-info" title={account}>
            {formatAddress(account)}
          </span>
          {}
          {}
        </>
      )}
      {!isConnected && (
        <button onClick={connectWallet} className="connect-button">
          Connect Wallet
        </button>
      )}
    </div>
  );
}

export default WalletConnect;
