import { useEffect, useState } from "react";
import PropertyCard from "../components/PropertyCard.jsx";
import OwnershipTimeline from "../components/OwnershipTimeline.jsx";
import PropertyTable from "../components/PropertyTable.jsx";
import DiagnosticsPanel from "../components/DiagnosticsPanel.jsx";
import { fetchGasComparison, fetchProperties, fetchTimeline } from "../services/api.js";

export default function Dashboard() {
  const [properties, setProperties] = useState([]);
  const [pageError, setPageError] = useState("");
  const [timelineError, setTimelineError] = useState("");
  const [selectedChainId, setSelectedChainId] = useState("");
  const [timeline, setTimeline] = useState([]);
  const [gasComparison, setGasComparison] = useState([]);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [viewMode, setViewMode] = useState("cards");

  useEffect(() => {
    fetchProperties()
      .then(setProperties)
      .catch((err) => setPageError(err.response?.data?.message || err.message));

    fetchGasComparison()
      .then(setGasComparison)
      .catch(() => setGasComparison([]));
  }, []);

  async function loadTimeline(event) {
    event.preventDefault();
    setTimelineError("");
    try {
      const data = await fetchTimeline(selectedChainId);
      setTimeline(data.ownershipHistory || []);
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      if (String(message).toLowerCase().includes("not found")) {
        setTimeline([]);
        setTimelineError(`No property timeline found for Chain ID ${selectedChainId}. Check the ID and try again.`);
      } else {
        setTimelineError(message);
      }
    }
  }

  const filteredProperties = properties.filter((property) => {
    const matchesRisk =
      riskFilter === "all" ? true : riskFilter === "high" ? property.fraud?.suspicious : !property.fraud?.suspicious;
    const q = query.trim().toLowerCase();
    if (!q) return matchesRisk;
    return (
      String(property.chainId).includes(q) ||
      String(property.tokenId).includes(q) ||
      (property.owner || "").toLowerCase().includes(q) ||
      (property.ipfsHash || "").toLowerCase().includes(q)
    ) && matchesRisk;
  });

  const verifiedCount = properties.filter((p) => p.verified).length;
  const flaggedCount = properties.filter((p) => p.fraud?.suspicious).length;
  const pendingApprovals = properties.filter((p) => (p.approvals || []).some((a) => a.status === "pending")).length;
  const rejectedApprovals = properties.filter((p) => (p.approvals || []).some((a) => a.status === "rejected")).length;

  const approvalStages = ["tehsildar", "sdm", "collector"].map((level) => {
    const complete = properties.filter((p) =>
      (p.approvals || []).some((approval) => approval.level === level && approval.status === "approved")
    ).length;
    return { level, complete, total: properties.length || 1 };
  });

  const alerts = properties
    .flatMap((property) => {
      const items = [];
      if (property.fraud?.suspicious) {
        items.push({ type: "fraud", text: `Property #${property.chainId} flagged by fraud analyzer` });
      }
      if ((property.approvals || []).some((a) => a.status === "rejected")) {
        items.push({ type: "approval", text: `Property #${property.chainId} has rejected approval stage` });
      } else if ((property.approvals || []).some((a) => a.status === "pending")) {
        items.push({ type: "approval", text: `Property #${property.chainId} waiting for government approvals` });
      }
      return items;
    })
    .slice(0, 6);

  return (
    <section className="section-stack dashboard-page">
      <div className="hero">
        <h2>Registry Command Center</h2>
        <p>Live property records, fraud signals, and ownership state in one operational view.</p>
      </div>
      {pageError ? <p className="error">{pageError}</p> : null}
      <div className="ops-summary">
        <p className="muted">Operational Snapshot</p>
        <p className="muted">Total records: <strong>{properties.length}</strong> | Flagged records: <strong>{flaggedCount}</strong></p>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <p>Total Properties</p>
          <h3>{properties.length}</h3>
        </article>
        <article className="kpi-card">
          <p>Verified Properties</p>
          <h3>{verifiedCount}</h3>
        </article>
        <article className="kpi-card">
          <p>Fraud Flags</p>
          <h3>{flaggedCount}</h3>
        </article>
        <article className="kpi-card">
          <p>Pending Approval Sets</p>
          <h3>{pendingApprovals}</h3>
        </article>
        <article className="kpi-card">
          <p>Rejected Approval Sets</p>
          <h3>{rejectedApprovals}</h3>
        </article>
      </div>

      <div className="dashboard-ops">
        <DiagnosticsPanel />

        <div className="dashboard-ops-right">
          <div className="panel">
            <h3>Approval Funnel</h3>
            <div className="funnel">
              {approvalStages.map((stage) => (
                <div key={stage.level} className="funnel-row">
                  <div className="funnel-label">{stage.level}</div>
                  <div className="funnel-bar-track">
                    <div
                      className="funnel-bar-fill"
                      style={{ width: `${Math.round((stage.complete / stage.total) * 100)}%` }}
                    />
                  </div>
                  <div className="funnel-value">{stage.complete}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3>Operations Alerts</h3>
            <div className="alerts">
              {alerts.length ? (
                alerts.map((alert, idx) => (
                  <article key={`${alert.type}-${idx}`} className={`alert-item alert-${alert.type}`}>
                    <p>{alert.text}</p>
                  </article>
                ))
              ) : (
                <p className="muted">No alerts right now.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Property Index</h3>
          <div className="search-tools">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chain, owner, hash..." />
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="all">All Risk</option>
              <option value="high">Flagged Only</option>
              <option value="low">Clean Only</option>
            </select>
            <div className="view-toggle">
              <button type="button" className={viewMode === "cards" ? "active" : ""} onClick={() => setViewMode("cards")}>
                Cards
              </button>
              <button type="button" className={viewMode === "table" ? "active" : ""} onClick={() => setViewMode("table")}>
                Table
              </button>
            </div>
          </div>
        </div>
        <p className="muted">Showing {filteredProperties.length} record(s)</p>
        {viewMode === "cards" ? (
          <div className="cards">
            {filteredProperties.map((property) => (
              <PropertyCard key={property._id} property={property} />
            ))}
          </div>
        ) : (
          <PropertyTable properties={filteredProperties} />
        )}
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3>Ownership Timeline</h3>
            <p className="muted">Track transfer history by chain ID</p>
          </div>
          <form className="inline-form timeline-form" onSubmit={loadTimeline}>
            <label className="timeline-input-wrap">
              <span className="muted">Chain ID</span>
              <input
                value={selectedChainId}
                onChange={(e) => {
                  setSelectedChainId(e.target.value);
                  if (timelineError) setTimelineError("");
                }}
                placeholder="Enter chain ID"
                required
              />
            </label>
            <button type="submit">Load Timeline</button>
          </form>
          {timelineError ? <p className="status-banner status-error timeline-error">{timelineError}</p> : null}
          <OwnershipTimeline history={timeline} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Gas Fee Comparison</h3>
            <p className="muted">Estimated ETH cost by priority tier</p>
          </div>
          <div className="gas-grid">
            {gasComparison.map((option) => (
              <article key={option.level} className="gas-card">
                <div className="gas-head">
                  <h4>{option.level}</h4>
                  <span className={`chip ${option.level === "low" ? "chip-approved" : option.level === "market" ? "chip-pending" : "chip-rejected"}`}>
                    {option.level}
                  </span>
                </div>
                <div className="gas-row">
                  <span>Register</span>
                  <strong>{option.register.eth} ETH</strong>
                </div>
                <div className="gas-row">
                  <span>Transfer</span>
                  <strong>{option.transfer.eth} ETH</strong>
                </div>
                <div className="gas-row">
                  <span>Verify</span>
                  <strong>{option.verify.eth} ETH</strong>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
