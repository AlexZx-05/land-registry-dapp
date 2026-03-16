import mongoose from "mongoose";
import { ethers } from "ethers";
import User from "../models/user.model.js";
import { getParcelBySurveyNumber } from "../services/parcel.service.js";

function checkMongo() {
  const state = mongoose.connection.readyState;
  const ok = state === 1;
  return {
    ok,
    code: ok ? "MONGO_OK" : "MONGO_NOT_CONNECTED",
    detail: `readyState=${state}`
  };
}

async function checkRpcAndContract() {
  const rpcUrl = process.env.RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!rpcUrl || !contractAddress) {
    return {
      rpc: { ok: false, code: "RPC_ENV_MISSING", detail: "Missing RPC_URL or CONTRACT_ADDRESS" },
      contract: { ok: false, code: "CONTRACT_ENV_MISSING", detail: "Missing RPC_URL or CONTRACT_ADDRESS" }
    };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const [blockNumber, chainId, code] = await Promise.all([
      provider.getBlockNumber(),
      provider.getNetwork().then((n) => Number(n.chainId)),
      provider.getCode(contractAddress)
    ]);

    const rpcOk = Number.isInteger(blockNumber) && Number.isInteger(chainId);
    const contractOk = code && code !== "0x";

    return {
      rpc: {
        ok: rpcOk,
        code: rpcOk ? "RPC_OK" : "RPC_UNSTABLE",
        detail: rpcOk ? `chainId=${chainId}, block=${blockNumber}` : "Could not read chain data"
      },
      contract: {
        ok: Boolean(contractOk),
        code: contractOk ? "CONTRACT_OK" : "CONTRACT_NOT_DEPLOYED",
        detail: contractOk ? `Contract found at ${contractAddress}` : `No code at ${contractAddress}`
      }
    };
  } catch (error) {
    return {
      rpc: { ok: false, code: "RPC_UNREACHABLE", detail: error.message },
      contract: { ok: false, code: "CONTRACT_UNKNOWN", detail: "RPC check failed before contract check" }
    };
  }
}

async function checkAuthUser(auth) {
  if (!auth?.userId) {
    return {
      ok: false,
      code: "AUTH_MISSING",
      detail: "No authenticated user in request context"
    };
  }
  const user = await User.findById(auth.userId).lean();
  const ok = Boolean(user);
  return {
    ok,
    code: ok ? "AUTH_OK" : "AUTH_USER_NOT_FOUND",
    detail: ok ? `user=${user.email}, role=${user.role}` : "Authenticated user does not exist in DB"
  };
}

function checkParcelLookup() {
  const parcel = getParcelBySurveyNumber("118/2");
  const ok = Boolean(parcel);
  return {
    ok,
    code: ok ? "PARCEL_LOOKUP_OK" : "PARCEL_LOOKUP_FAILED",
    detail: ok ? `parcelId=${parcel.parcelId}` : "Seed parcel 118/2 not found"
  };
}

export async function getSystemPreflight(req, res) {
  try {
    const [mongo, rpcContract, auth, parcelLookup] = await Promise.all([
      Promise.resolve(checkMongo()),
      checkRpcAndContract(),
      checkAuthUser(req.auth),
      Promise.resolve(checkParcelLookup())
    ]);

    const checks = {
      mongo,
      rpc: rpcContract.rpc,
      contract: rpcContract.contract,
      auth,
      parcelLookup
    };

    const ok = Object.values(checks).every((item) => item.ok);
    return res.json({
      ok,
      timestamp: new Date().toISOString(),
      checks
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: "PREFLIGHT_ERROR",
      message: error.message
    });
  }
}
