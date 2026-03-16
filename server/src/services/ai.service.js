import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const aiScriptPath = path.resolve(__dirname, "../../../ai-module/fraud_detection.py");

function normalizePolygon(points) {
  return points.map(([lat, lng]) => `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`).join("|");
}

function runIsolationForest(payload) {
  return new Promise((resolve) => {
    const pythonCmd = process.env.PYTHON_BIN || "python";
    const child = spawn(pythonCmd, [aiScriptPath], { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0 || !stdout.trim()) {
        resolve({ score: 0, anomalous: false, model: "fallback", error: stderr || "python_error" });
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve({ score: 0, anomalous: false, model: "fallback", error: "invalid_python_output" });
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export async function evaluateFraudSignals({ polygonCoordinates, properties, ownershipHistory = [] }) {
  const canonical = normalizePolygon(polygonCoordinates);
  const duplicatePolygon = properties.some((p) => normalizePolygon(p.polygonCoordinates || []) === canonical);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const rapidTransfer = ownershipHistory.filter((entry) => new Date(entry.transferredAt).getTime() >= sevenDaysAgo).length >= 3;

  const dataset = properties.map((p) => [
    (p.polygonCoordinates || []).length,
    p.ownershipHistory?.length || 0,
    p.fraud?.duplicatePolygon ? 1 : 0,
    p.fraud?.rapidTransfer ? 1 : 0
  ]);

  const target = [
    polygonCoordinates.length,
    ownershipHistory.length,
    duplicatePolygon ? 1 : 0,
    rapidTransfer ? 1 : 0
  ];

  const aiResult = await runIsolationForest({ dataset, target });
  const reasons = [];
  if (duplicatePolygon) reasons.push("Duplicate polygon detected");
  if (rapidTransfer) reasons.push("Rapid ownership transfers in last 7 days");
  if (aiResult.anomalous) reasons.push("Isolation Forest flagged anomalous pattern");

  return {
    duplicatePolygon,
    rapidTransfer,
    isolationForestScore: Number(aiResult.score || 0),
    suspicious: reasons.length > 0,
    reasons
  };
}
