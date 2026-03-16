export default function PropertyTable({ properties = [] }) {
  if (!properties.length) {
    return <p className="muted">No properties match the current filters.</p>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Chain ID</th>
            <th>Token</th>
            <th>Owner</th>
            <th>Verified</th>
            <th>Fraud</th>
            <th>Approvals</th>
          </tr>
        </thead>
        <tbody>
          {properties.map((property) => {
            const approved = (property.approvals || []).filter((a) => a.status === "approved").length;
            const total = (property.approvals || []).length;
            return (
              <tr key={property._id}>
                <td>#{property.chainId}</td>
                <td>#{property.tokenId}</td>
                <td className="mono">{property.owner}</td>
                <td>{property.verified ? "Yes" : "No"}</td>
                <td>{property.fraud?.suspicious ? "Flagged" : "Clean"}</td>
                <td>{approved}/{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
