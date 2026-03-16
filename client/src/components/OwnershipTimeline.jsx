export default function OwnershipTimeline({ history = [] }) {
  if (!history.length) {
    return (
      <div className="timeline-empty">
        <h4>No ownership timeline yet</h4>
        <p className="muted">Load a valid chain ID to view ownership transfer history and on-chain trace records.</p>
      </div>
    );
  }

  const isSingleEvent = history.length === 1;
  const chartPoints = history.map((event, index) => {
    const x = isSingleEvent ? 130 : 20 + index * (220 / Math.max(1, history.length - 1));
    const y = isSingleEvent ? 52 : 80 - Math.min(60, index * 10);
    return { x, y };
  });
  const polylinePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="timeline">
      {isSingleEvent ? (
        <div className="timeline-single-state">
          <div className="timeline-single-dot" />
          <div>
            <h4>Initial ownership record captured</h4>
            <p className="muted">Trend chart appears automatically after the next transfer event.</p>
          </div>
        </div>
      ) : (
        <svg className="timeline-graph" viewBox="0 0 260 100" preserveAspectRatio="none">
          {chartPoints.length > 1 ? (
            <polyline points={polylinePoints} fill="none" stroke="#1d7dd6" strokeWidth="3" strokeLinecap="round" />
          ) : null}
          {chartPoints.map((point, index) => (
            <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="4" fill="#1d7dd6" />
          ))}
        </svg>
      )}
      {history.map((event, index) => (
        <div key={`${event.owner}-${event.transferredAt}-${index}`} className="timeline-item">
          <div className="timeline-dot" />
          <div>
            <strong>{event.owner}</strong>
            <p>{new Date(event.transferredAt).toLocaleString()}</p>
            <small className="mono">{event.txHash}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
