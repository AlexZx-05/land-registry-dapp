import { useMemo, useState } from "react";
import { approveProperty, fetchProperties, verifyProperty } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function VerifyProperty() {
  const { user } = useAuth();
  const [chainId, setChainId] = useState("");
  const [propertySnapshot, setPropertySnapshot] = useState(null);
  const [statusType, setStatusType] = useState("info");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const canApproveTehsildar = ["tehsildar", "admin"].includes(user?.role);
  const canApproveSdm = ["sdm", "admin"].includes(user?.role);
  const canApproveCollector = ["collector", "admin"].includes(user?.role);
  const canFinalVerify = ["officer", "admin"].includes(user?.role);

  const normalizedChainId = chainId.trim();

  const approvalStatus = useMemo(() => {
    const approvals = propertySnapshot?.approvals || [];
    const getStatus = (level) => approvals.find((item) => item.level === level)?.status || "pending";
    const tehsildar = getStatus("tehsildar");
    const sdm = getStatus("sdm");
    const collector = getStatus("collector");
    const completed = [tehsildar, sdm, collector].filter((item) => item === "approved").length;
    return { tehsildar, sdm, collector, completed, total: 3 };
  }, [propertySnapshot]);

  const readinessPercent = Math.round(
    ((normalizedChainId ? 1 : 0) + (propertySnapshot ? 1 : 0) + (approvalStatus.completed === 3 ? 1 : 0)) / 3 * 100
  );

  async function loadPropertySnapshot() {
    if (!normalizedChainId) {
      setStatusType("error");
      setStatus("Enter chain ID first");
      return;
    }
    setIsLoadingSnapshot(true);
    setStatusType("info");
    setStatus("Loading approval state...");
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
      setStatus(`Loaded property #${normalizedChainId}`);
    } catch (error) {
      setStatusType("error");
      setStatus(error.response?.data?.message || error.message);
      setPropertySnapshot(null);
    } finally {
      setIsLoadingSnapshot(false);
    }
  }

  async function onApprove(level, approved) {
    if (!normalizedChainId) {
      setStatus("Enter chain ID first");
      return;
    }
    setIsSubmitting(true);
    setStatusType("info");
    setStatus("Submitting approval...");
    try {
      await approveProperty(normalizedChainId, level, approved);
      setLastAction(`${level} marked as ${approved ? "approved" : "rejected"}`);
      setStatusType("success");
      setStatus(`${level} marked as ${approved ? "approved" : "rejected"}`);
      await loadPropertySnapshot();
    } catch (error) {
      setStatusType("error");
      setStatus(error.response?.data?.message || error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!normalizedChainId) {
      setStatusType("error");
      setStatus("Enter chain ID first");
      return;
    }
    setIsSubmitting(true);
    setStatusType("info");
    setStatus("Submitting verify...");
    try {
      await verifyProperty(normalizedChainId);
      setLastAction("Property verified successfully");
      setStatusType("success");
      setStatus("Property verified successfully");
      await loadPropertySnapshot();
    } catch (error) {
      setStatusType("error");
      setStatus(error.response?.data?.message || error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section-stack verify-page">
      <div className="hero hero-verify">
        <h2>Verify Property</h2>
        <p>Complete multi-level governance approvals before final blockchain verification.</p>
      </div>
      <div className="module-action-bar verify-toolbar">
        <div>
          <p className="muted">Module Actions</p>
          <h3>Governance Verification</h3>
        </div>
        <div className="module-action-buttons">
          <button type="button" className="secondary-btn" onClick={loadPropertySnapshot} disabled={isLoadingSnapshot}>
            {isLoadingSnapshot ? "Loading..." : "Load Approval State"}
          </button>
          <button type="submit" form="verify-property-form" className="verify-submit-btn" disabled={!canFinalVerify || isSubmitting}>
            {isSubmitting ? "Submitting..." : "Verify on Blockchain"}
          </button>
        </div>
      </div>
      <div className="readiness-strip panel verify-readiness">
        <div>
          <p className="muted">Verification Readiness</p>
          <h3>{readinessPercent}% complete</h3>
        </div>
        <div className="readiness-meter" aria-hidden="true">
          <span style={{ width: `${readinessPercent}%` }} />
        </div>
        <p className="muted">{approvalStatus.completed}/3 approvals completed</p>
      </div>
      <div className="grid-2 verify-layout">
        <form id="verify-property-form" className="form panel verify-form" onSubmit={onSubmit}>
          <div className="verify-step-head">
            <div className="panel-subtitle">Step 1</div>
            <h3>Governance Approval Controls</h3>
          </div>
          <label>
            Property Chain ID
            <input value={chainId} onChange={(e) => setChainId(e.target.value)} required />
          </label>
          <button type="button" className="secondary-btn" onClick={loadPropertySnapshot} disabled={isLoadingSnapshot}>
            {isLoadingSnapshot ? "Loading..." : "Load Approval State"}
          </button>

          {propertySnapshot ? (
            <div className="panel info-panel">
              <p className="muted"><strong>Token:</strong> #{propertySnapshot.tokenId}</p>
              <p className="muted"><strong>Owner:</strong> <span className="mono">{propertySnapshot.owner}</span></p>
              <p className="muted"><strong>Verification:</strong> {propertySnapshot.verified ? "Verified" : "Pending"}</p>
            </div>
          ) : null}

          <div className="approval-actions">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onApprove("tehsildar", true)}
              disabled={!canApproveTehsildar || isSubmitting}
              title={canApproveTehsildar ? "" : "Only tehsildar/admin can approve this stage"}
            >
              Approve Tehsildar
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onApprove("sdm", true)}
              disabled={!canApproveSdm || isSubmitting}
              title={canApproveSdm ? "" : "Only sdm/admin can approve this stage"}
            >
              Approve SDM
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onApprove("collector", true)}
              disabled={!canApproveCollector || isSubmitting}
              title={canApproveCollector ? "" : "Only collector/admin can approve this stage"}
            >
              Approve Collector
            </button>
          </div>
          <button
            type="submit"
            className="verify-submit-btn"
            disabled={!canFinalVerify || isSubmitting}
            title={canFinalVerify ? "" : "Only officer/admin can run final blockchain verification"}
          >
            {isSubmitting ? "Submitting..." : "Verify on Blockchain"}
          </button>
        </form>
        <aside className="panel verify-side-panel">
          <h3>Approval Flow</h3>
          <div className="stage-grid">
            <article className="stage-card">
              <p className="muted">Tehsildar review</p>
              <strong className={`stage-state stage-${approvalStatus.tehsildar}`}>{approvalStatus.tehsildar}</strong>
            </article>
            <article className="stage-card">
              <p className="muted">SDM review</p>
              <strong className={`stage-state stage-${approvalStatus.sdm}`}>{approvalStatus.sdm}</strong>
            </article>
            <article className="stage-card">
              <p className="muted">Collector review</p>
              <strong className={`stage-state stage-${approvalStatus.collector}`}>{approvalStatus.collector}</strong>
            </article>
            <article className="stage-card">
              <p className="muted">Final verify transaction</p>
              <strong className={`stage-state ${propertySnapshot?.verified ? "stage-approved" : "stage-pending"}`}>
                {propertySnapshot?.verified ? "verified" : "pending"}
              </strong>
            </article>
          </div>
          <p className="status-banner">
            Logged in role: <strong>{user?.role || "unknown"}</strong>
            <br />
            {canFinalVerify
              ? "You can run final blockchain verification."
              : "You cannot run final blockchain verification with this role."}
          </p>
          {lastAction ? <p className="muted">Last action: {lastAction}</p> : null}
          {status ? (
            <p className={`status-banner ${statusType === "error" ? "status-error" : ""} ${statusType === "success" ? "status-success" : ""}`}>
              {status}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
