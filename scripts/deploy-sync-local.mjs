import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const serverEnvPath = path.join(projectRoot, "server", ".env");

function runDeployCommand() {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, ["--workspace", "blockchain", "run", "deploy:local"], {
    cwd: projectRoot,
    encoding: "utf8"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Unknown deploy error").trim());
  }

  return result.stdout || "";
}

function extractAddress(output) {
  const match = output.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : "";
}

function updateEnvContractAddress(address) {
  const existing = fs.existsSync(serverEnvPath) ? fs.readFileSync(serverEnvPath, "utf8") : "";
  if (!existing) {
    fs.writeFileSync(serverEnvPath, `CONTRACT_ADDRESS=${address}\n`, "utf8");
    return;
  }

  if (/^CONTRACT_ADDRESS=/m.test(existing)) {
    const updated = existing.replace(/^CONTRACT_ADDRESS=.*/m, `CONTRACT_ADDRESS=${address}`);
    fs.writeFileSync(serverEnvPath, updated, "utf8");
  } else {
    fs.appendFileSync(serverEnvPath, `\nCONTRACT_ADDRESS=${address}\n`, "utf8");
  }
}

try {
  const output = runDeployCommand();
  const address = extractAddress(output);
  if (!address) {
    throw new Error(`Could not parse deployed contract address from output:\n${output}`);
  }

  updateEnvContractAddress(address);
  console.log(`Deployed contract: ${address}`);
  console.log("Updated server/.env CONTRACT_ADDRESS");
  console.log("Next: restart backend service to load the new address.");
} catch (error) {
  console.error("deploy-sync failed:", error.message);
  process.exit(1);
}
