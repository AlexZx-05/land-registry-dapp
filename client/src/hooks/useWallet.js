import { useCallback, useEffect, useState } from "react";

function getEthereumProvider() {
  const eth = window.ethereum;
  if (!eth) return null;

  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((provider) => provider.isMetaMask) || eth.providers[0];
  }

  return eth;
}

export function useWallet() {
  const [account, setAccount] = useState("");
  const [walletError, setWalletError] = useState("");

  const connectWallet = useCallback(async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      setWalletError("No injected wallet detected. Install MetaMask and reload this page.");
      return;
    }
    try {
      setWalletError("");
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0] || "");
    } catch (error) {
      if (error?.code === 4001) {
        setWalletError("Wallet connection request was rejected.");
      } else {
        setWalletError(error?.message || "Unable to connect wallet.");
      }
    }
  }, []);

  useEffect(() => {
    const provider = getEthereumProvider();
    if (!provider) return;

    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => setAccount(accounts[0] || ""))
      .catch(() => {});

    if (typeof provider.on === "function") {
      const onAccountsChanged = (accounts) => setAccount(accounts?.[0] || "");
      provider.on("accountsChanged", onAccountsChanged);
      return () => {
        if (typeof provider.removeListener === "function") {
          provider.removeListener("accountsChanged", onAccountsChanged);
        }
      };
    }
  }, []);

  return { account, connectWallet, walletError };
}
