import { useEffect, useState } from "react";
import { fetchSystemPreflight } from "../services/api.js";

function Badge({ ok }) {
  return <span className={`diag-badge ${ok ? "diag-ok" : "diag-fail"}`}>{ok ? "OK" : "FAIL"}</span>;
}

export default function DiagnosticsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetchSystemPreflight();
      setData(response);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>System Diagnostics</h3>
        <button type="button" onClick={load} disabled={loading}>
          {loading ? "Checking..." : "Run Preflight"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {!data && !error ? <p className="muted">Run preflight to verify runtime dependencies.</p> : null}

      {data ? (
        <>
          <div className="diag-summary">
            <p className="muted">Overall: <strong>{data.ok ? "READY" : "NOT READY"}</strong></p>
            <p className="muted">Checked at: {new Date(data.timestamp).toLocaleString()}</p>
          </div>
          <div className="diag-grid">
            {Object.entries(data.checks).map(([name, check]) => (
              <article key={name} className="diag-card">
                <div className="diag-head">
                  <h4>{name}</h4>
                  <Badge ok={check.ok} />
                </div>
                <p className="muted diag-code">{check.code}</p>
                <p className="diag-detail">{check.detail}</p>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
