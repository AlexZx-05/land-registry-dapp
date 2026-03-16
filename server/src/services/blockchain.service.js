import { ethers } from "ethers";

const LAND_REGISTRY_ABI = [
  "event PropertyRegistered(uint256 indexed id, address indexed owner, string polygon, string ipfsHash)",
  "function registerProperty(string memory _polygon, string memory _ipfsHash) external",
  "function transferOwnership(uint256 _id, address _newOwner) external",
  "function verifyProperty(uint256 _id) external",
  "function getProperty(uint256 _id) external view returns (uint256 id, address owner, string memory polygon, string memory ipfsHash, bool verified)",
  "function ownerOf(uint256 tokenId) external view returns (address)"
];

let cachedContract;

async function ensureDeployed(provider, address) {
  const code = await provider.getCode(address);
  if (!code || code === "0x") {
    throw new Error(
      `No contract deployed at CONTRACT_ADDRESS=${address}. Restarted Hardhat nodes reset state; redeploy and update server/.env`
    );
  }
}

function getContract() {
  if (cachedContract) return cachedContract;

  const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS } = process.env;
  if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    throw new Error("Missing RPC_URL, PRIVATE_KEY, or CONTRACT_ADDRESS in server environment");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  cachedContract = new ethers.Contract(CONTRACT_ADDRESS, LAND_REGISTRY_ABI, wallet);
  return cachedContract;
}

function getRegisteredChainId(receipt, contract) {
  for (const log of receipt.logs || []) {
    try {
      const parsed = contract.interface.parseLog({
        topics: log.topics,
        data: log.data
      });
      if (parsed?.name === "PropertyRegistered") {
        return Number(parsed.args.id);
      }
    } catch (_error) {
      // Ignore unrelated logs.
    }
  }
  throw new Error("Could not extract property chainId from PropertyRegistered event");
}

export async function registerOnChain(polygon, ipfsHash) {
  const contract = getContract();
  await ensureDeployed(contract.runner.provider, contract.target);

  const tx = await contract.registerProperty(polygon, ipfsHash);
  const receipt = await tx.wait();
  let chainId;
  try {
    chainId = getRegisteredChainId(receipt, contract);
  } catch (_error) {
    // Fallback to on-chain counter in case event parsing fails due provider/log differences.
    chainId = Number(await contract.propertyCount());
    if (!Number.isInteger(chainId) || chainId <= 0) {
      throw new Error("Could not extract property chainId from PropertyRegistered event or propertyCount()");
    }
  }
  return { receipt, chainId };
}

export async function transferOnChain(chainId, newOwner) {
  const contract = getContract();
  const tx = await contract.transferOwnership(chainId, newOwner);
  return tx.wait();
}

export async function verifyOnChain(chainId) {
  const contract = getContract();
  const tx = await contract.verifyProperty(chainId);
  return tx.wait();
}

function toEth(gasUsed, gasPriceWei) {
  const wei = gasUsed * gasPriceWei;
  return { wei: wei.toString(), eth: ethers.formatEther(wei) };
}

export async function compareGasScenarios() {
  const contract = getContract();
  const feeData = await contract.runner.provider.getFeeData();
  const baseGasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");

  const registerGas = await contract.registerProperty.estimateGas(
    "[[28.6139,77.2090],[28.6145,77.2101],[28.6141,77.2082]]",
    "ipfs://sample"
  );

  let transferGas = 0n;
  let verifyGas = 0n;
  try {
    transferGas = await contract.transferOwnership.estimateGas(1, contract.runner.address);
  } catch {
    transferGas = 0n;
  }

  try {
    verifyGas = await contract.verifyProperty.estimateGas(1);
  } catch {
    verifyGas = 0n;
  }

  const levels = [
    { name: "low", multiplier: 8n, divisor: 10n },
    { name: "market", multiplier: 10n, divisor: 10n },
    { name: "priority", multiplier: 12n, divisor: 10n }
  ];

  return levels.map((level) => {
    const gasPrice = (baseGasPrice * level.multiplier) / level.divisor;
    return {
      level: level.name,
      gasPriceWei: gasPrice.toString(),
      register: toEth(registerGas, gasPrice),
      transfer: toEth(transferGas, gasPrice),
      verify: toEth(verifyGas, gasPrice)
    };
  });
}
