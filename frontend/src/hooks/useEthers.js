import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const CORRECT_NETWORK_ID = '1337';

export function useEthers() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [networkOk, setNetworkOk] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const connectWallet = useCallback(async () => {
    setError(null);
    if (window.ethereum) {
      try {
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        await browserProvider.send("eth_requestAccounts", []); 
        const network = await browserProvider.getNetwork();
        const currentSigner = await browserProvider.getSigner();
        const currentAccount = await currentSigner.getAddress();

        setProvider(browserProvider);
        setSigner(currentSigner);
        setAccount(currentAccount);
        setIsConnected(true);
        setNetworkOk(network.chainId.toString() === CORRECT_NETWORK_ID);

        console.log("Wallet connected:", currentAccount);
        console.log("Network:", network);

      } catch (err) {
        console.error("Error connecting wallet:", err);
        setError(err.message || 'Failed to connect wallet.');
        setIsConnected(false);
      }
    } else {
      setError('MetaMask not detected. Please install MetaMask.');
    }
  }, []);

  const disconnectWallet = useCallback(() => {
      setProvider(null);
      setSigner(null);
      setAccount(null);
      setIsConnected(false);
      setNetworkOk(false);
      setError(null);
      console.log("Wallet disconnected");
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log("Accounts changed:", accounts);
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (accounts[0] !== account) {
            connectWallet();
        }
      };

      const handleChainChanged = (chainIdHex) => {
          const chainId = parseInt(chainIdHex, 16).toString();
          console.log("Network changed:", chainId);
          setNetworkOk(chainId === CORRECT_NETWORK_ID);

      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
            window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [account, connectWallet, disconnectWallet]); // Add dependencies

  return { provider, signer, account, isConnected, networkOk, error, connectWallet, disconnectWallet };
}
