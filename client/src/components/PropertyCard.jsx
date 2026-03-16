export default function PropertyCard({ property }) {
  const approvalDone = (property.approvals || []).filter((approval) => approval.status === "approved").length;
  const approvalTotal = (property.approvals || []).length;
  const parcelLabel = property.parcelId || property.surveyNumber || "N/A";
  const shortOwner = property.owner ? `${property.owner.slice(0, 8)}...${property.owner.slice(-6)}` : "N/A";
  const shortHash = property.ipfsHash ? `${property.ipfsHash.slice(0, 22)}...${property.ipfsHash.slice(-10)}` : "N/A";
  const isVerified = Boolean(property.verified);
  const isFlagged = Boolean(property.fraud?.suspicious);

  return (
    <article className="card property-card">
      <div className="property-head">
        <h4>Property #{property.chainId}</h4>
        <span className={isVerified ? "badge-ok" : "badge-warn"}>
          {isVerified ? "Verified" : "Pending"}
        </span>
      </div>

      <div className="property-top-metrics">
        <div className="metric-pill">
          <strong>NFT Token</strong>
          <span>#{property.tokenId}</span>
        </div>
        <div className="metric-pill">
          <strong>Parcel</strong>
          <span>{parcelLabel}</span>
        </div>
      </div>

      <div className="property-grid">
        <div className="property-cell">
          <strong>Owner Wallet</strong>
          <span className="mono" title={property.owner}>{shortOwner}</span>
        </div>
        <div className="property-cell">
          <strong>Verification</strong>
          <span>{isVerified ? "Yes" : "No"}</span>
        </div>
        <div className="property-cell property-cell-wide">
          <strong>Document Hash</strong>
          <span className="mono" title={property.ipfsHash}>{shortHash}</span>
        </div>
        <div className="property-cell">
          <strong>Document</strong>
          <span>{property.document?.fileName || "N/A"}</span>
        </div>
        <div className="property-cell">
          <strong>Document Type</strong>
          <span>{property.document?.documentType || "N/A"}</span>
        </div>
      </div>

      <div className="card-row card-row-inline">
        <strong>Fraud Risk</strong>
        <span className={isFlagged ? "risk-high" : "risk-low"}>
          {isFlagged ? "Under Investigation" : "Clean"}
        </span>
      </div>

      <div className="card-row card-row-inline">
        <strong>Government Approvals</strong>
        <span>{approvalDone}/{approvalTotal} completed</span>
      </div>

      <div className="approval-pill-row">
        {(property.approvals || []).map((approval) => (
          <span key={approval.level} className={`chip chip-${approval.status}`}>
            {approval.level}
          </span>
        ))}
      </div>
    </article>
  );
}
