import { useCallback, useEffect, useState } from "react";

const HARDHAT_CHAIN_ID_HEX = "0x7a69";

function getEthereumProvider() {
  const eth = window.ethereum;
  if (!eth) return null;

  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((provider) => provider.isMetaMask) || eth.providers[0];
  }

  return eth;
}

async function ensureHardhatNetwork(provider) {
  const currentChainId = await provider.request({ method: "eth_chainId" });
  if (String(currentChainId).toLowerCase() === HARDHAT_CHAIN_ID_HEX) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HARDHAT_CHAIN_ID_HEX }]
    });
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: HARDHAT_CHAIN_ID_HEX,
          chainName: "Hardhat Local",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["http://127.0.0.1:8545"]
        }
      ]
    });
  }
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
      await ensureHardhatNetwork(provider);
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0] || "");
    } catch (error) {
      if (error?.code === 4001) {
        setWalletError("Wallet request was rejected. Approve connection/network switch in MetaMask.");
      } else if (error?.code === -32002) {
        setWalletError("A wallet request is already pending. Open MetaMask and complete it first.");
      } else {
        setWalletError(error?.message || "Unable to connect wallet. Ensure Hardhat node is running on 127.0.0.1:8545.");
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
      const onChainChanged = () => setWalletError("");
      provider.on("accountsChanged", onAccountsChanged);
      provider.on("chainChanged", onChainChanged);
      return () => {
        if (typeof provider.removeListener === "function") {
          provider.removeListener("accountsChanged", onAccountsChanged);
          provider.removeListener("chainChanged", onChainChanged);
        }
      };
    }
  }, []);

  return { account, connectWallet, walletError };
}
