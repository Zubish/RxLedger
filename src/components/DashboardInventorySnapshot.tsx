import { FileText } from "lucide-react";

type SnapshotRow = {
  quantity: number;
  status: "ok" | "near-expiry" | "expired";
};

export function DashboardInventorySnapshot({
  rows,
  branches,
  formatMoney,
  onViewReports,
}: {
  rows: SnapshotRow[];
  branches: { id: string; name: string; value: number }[];
  formatMoney: (value: number) => string;
  onViewReports: () => void;
}) {
  const stockedRows = rows.filter((row) => row.quantity > 0);
  const total = stockedRows.length;
  const healthy = stockedRows.filter((row) => row.status === "ok").length;
  const nearExpiry = stockedRows.filter(
    (row) => row.status === "near-expiry",
  ).length;
  const expired = stockedRows.filter((row) => row.status === "expired").length;
  const healthyEnd = total ? (healthy / total) * 100 : 0;
  const nearExpiryEnd = total ? ((healthy + nearExpiry) / total) * 100 : 0;
  const highestValue = Math.max(0, ...branches.map((branch) => branch.value));
  const segments = [
    { label: "Within expiry window", count: healthy, className: "healthy" },
    { label: "Near expiry", count: nearExpiry, className: "near-expiry" },
    { label: "Expired", count: expired, className: "expired" },
  ];

  return (
    <section className="content-section dashboard-snapshot">
      <div className="section-heading">
        <h2>Inventory Snapshot</h2>
        <button className="ghost-button" type="button" onClick={onViewReports}>
          <FileText size={16} /> View reports
        </button>
      </div>
      <p className="snapshot-scope">
        {total} stocked batches in your dashboard scope.
      </p>
      <div className="snapshot-health">
        <div
          className="snapshot-donut"
          aria-hidden="true"
          style={{
            background: total
              ? `conic-gradient(var(--rx-brand) 0% ${healthyEnd}%, var(--rx-amber) ${healthyEnd}% ${nearExpiryEnd}%, #ad322b ${nearExpiryEnd}% 100%)`
              : "var(--rx-border)",
          }}
        >
          <div>
            <strong>{total}</strong>
            <span>Stocked batches</span>
          </div>
        </div>
        <dl className="snapshot-legend" aria-label="Stocked batch health">
          {segments.map(({ label, count, className }) => (
            <div key={className}>
              <dt>
                <i className={className} aria-hidden="true" />
                {label}
              </dt>
              <dd>
                {count}
                <span> ({total ? Math.round((count / total) * 100) : 0}%)</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {!total && (
        <p className="snapshot-empty">No stocked batches in this scope.</p>
      )}
      <div className="snapshot-branch-values">
        <h3>Stock Value by Branch</h3>
        <p>Current inventory at cost, not a historical trend.</p>
        <div className="dashboard-scroll-list">
          {branches.map((branch) => (
            <div className="snapshot-value-row" key={branch.id}>
              <div>
                <span>{branch.name}</span>
                <strong>{formatMoney(branch.value)}</strong>
              </div>
              <div className="snapshot-value-track" aria-hidden="true">
                <span
                  style={{
                    width: `${highestValue ? (branch.value / highestValue) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
          {!branches.length && (
            <p className="snapshot-empty">No active branches in this scope.</p>
          )}
        </div>
      </div>
    </section>
  );
}
