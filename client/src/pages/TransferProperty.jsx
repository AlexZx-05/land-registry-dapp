import { useMemo, useState } from "react";
import { fetchProperties, transferProperty } from "../services/api.js";

function isValidAddress(value = "") {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export default function TransferProperty() {
  const [chainId, setChainId] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [propertySnapshot, setPropertySnapshot] = useState(null);
  const [statusType, setStatusType] = useState("info");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [result, setResult] = useState(null);

  const normalizedChainId = chainId.trim();
  const walletValid = useMemo(() => isValidAddress(newOwner), [newOwner]);

  const readiness = useMemo(() => {
    const checks = [
      { label: "Chain ID entered", ok: Boolean(normalizedChainId) },
      { label: "Property snapshot loaded", ok: Boolean(propertySnapshot) },
      { label: "New owner wallet valid", ok: walletValid },
      {
        label: "New owner differs from current owner",
        ok: propertySnapshot ? propertySnapshot.owner?.toLowerCase() !== newOwner.trim().toLowerCase() : false
      }
    ];
    return {
      checks,
      completed: checks.filter((item) => item.ok).length,
      total: checks.length
    };
  }, [normalizedChainId, propertySnapshot, walletValid, newOwner]);

  async function loadPropertySnapshot() {
    if (!normalizedChainId) {
      setStatusType("error");
      setStatus("Enter chain ID first");
      return;
    }
    setIsLoadingSnapshot(true);
    setStatusType("info");
    setStatus("Loading property snapshot...");
    try {
      const list = await fetchProperties();
      const match = list.find((item) => String(item.chainId) === normalizedChainId);
      if (!match) {
        setPropertySnapshot(null);
        setStatusType("error");
        setStatus(`Property with chainId ${normalizedChainId} not found`);
        return;
      }
      setPropertySnapshot(match);
      setStatusType("success");
      setStatus(`Property #${normalizedChainId} loaded`);
    } catch (error) {
      setStatusType("error");
      setStatus(error.response?.data?.message || error.message);
      setPropertySnapshot(null);
    } finally {
      setIsLoadingSnapshot(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusType("info");
    setStatus("Submitting transfer transaction...");
    setResult(null);

    if (!normalizedChainId) {
      setStatusType("error");
      setStatus("Property chain ID is required");
      setIsSubmitting(false);
      return;
    }
    if (!walletValid) {
      setStatusType("error");
      setStatus("New owner wallet address is invalid");
      setIsSubmitting(false);
      return;
    }
    if (!propertySnapshot) {
      setStatusType("error");
      setStatus("Load property snapshot before transfer");
      setIsSubmitting(false);
      return;
    }
    if (propertySnapshot.owner?.toLowerCase() === newOwner.trim().toLowerCase()) {
      setStatusType("error");
      setStatus("New owner must be different from current owner");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await transferProperty(normalizedChainId, newOwner.trim());
      setStatusType("success");
      setStatus("Ownership transferred successfully");
      setResult({
        chainId: response.chainId || normalizedChainId,
        previousOwner: propertySnapshot.owner,
        newOwner: response.owner || newOwner.trim(),
        txHash: response.txHash || "N/A"
      });
    } catch (error) {
      setStatusType("error");
      setStatus(error.response?.data?.message || error.message);
      setResult(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section-stack">
      <div className="hero">
        <h2>Transfer Property</h2>
        <p>Execute ownership transfer after approvals; every change is written on-chain and to timeline.</p>
      </div>
      <div className="module-action-bar transfer-action-bar">
        <div>
          <p className="muted">Module Actions</p>
          <h3>Ownership Transfer</h3>
        </div>
        <button type="submit" form="transfer-property-form" disabled={isSubmitting}>
          {isSubmitting ? "Transferring..." : "Transfer Ownership"}
        </button>
      </div>
      <div className="readiness-strip panel">
        <div>
          <p className="muted">Transfer Readiness</p>
          <h3>{Math.round((readiness.completed / readiness.total) * 100)}% complete</h3>
        </div>
        <div className="readiness-meter" aria-hidden="true">
          <span style={{ width: `${Math.round((readiness.completed / readiness.total) * 100)}%` }} />
        </div>
        <p className="muted">{readiness.completed}/{readiness.total} checks passed</p>
      </div>
      <div className="grid-2">
        <form id="transfer-property-form" className="form panel" onSubmit={onSubmit}>
          <div className="panel-subtitle">Transfer Request</div>
          <label>
            Property Chain ID
            <input value={chainId} onChange={(e) => setChainId(e.target.value)} required />
          </label>
          <button type="button" onClick={loadPropertySnapshot} disabled={isLoadingSnapshot}>
            {isLoadingSnapshot ? "Loading..." : "Load Property Snapshot"}
          </button>

          {propertySnapshot ? (
            <div className="panel info-panel">
              <p className="muted"><strong>Current Owner:</strong> <span className="mono">{propertySnapshot.owner}</span></p>
              <p className="muted"><strong>Token:</strong> #{propertySnapshot.tokenId}</p>
              <p className="muted"><strong>Verification:</strong> {propertySnapshot.verified ? "Verified" : "Pending"}</p>
            </div>
          ) : null}

          <label>
            New Owner Wallet
            <input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="0x..." required />
          </label>
          {!walletValid && newOwner ? <p className="error">Enter a valid 42-character EVM wallet address.</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Transferring..." : "Transfer Ownership"}
          </button>
        </form>
        <aside className="panel">
          <h3>Transfer Notes</h3>
          <ul className="gov-list">
            <li>Requires all approval stages completed</li>
            <li>Owner history auto-updates</li>
            <li>Fraud analyzer re-evaluates transfer pattern</li>
          </ul>
          <div className="checklist">
            {readiness.checks.map((item) => (
              <div key={item.label} className="check-row">
                <span className={item.ok ? "check-dot done" : "check-dot"} />
                <p className="muted">{item.label}</p>
              </div>
            ))}
          </div>

          {status ? (
            <p className={`status-banner ${statusType === "error" ? "status-error" : ""} ${statusType === "success" ? "status-success" : ""}`}>
              {status}
            </p>
          ) : null}

          {result ? (
            <div className="panel info-panel">
              <h3>Transfer Result</h3>
              <p className="muted">Chain ID: {result.chainId}</p>
              <p className="muted">Previous Owner: <span className="mono">{result.previousOwner}</span></p>
              <p className="muted">New Owner: <span className="mono">{result.newOwner}</span></p>
              <p className="muted">Tx Hash: <span className="mono">{result.txHash}</span></p>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
