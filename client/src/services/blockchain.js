export async function addHardhatNetwork() {
  if (!window.ethereum) {
    throw new Error("MetaMask not detected");
  }

  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: "0x7A69",
        chainName: "Hardhat Local",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["http://127.0.0.1:8545"],
        blockExplorerUrls: []
      }
    ]
  });
}
