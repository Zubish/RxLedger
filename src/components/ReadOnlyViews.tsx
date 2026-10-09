import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";

import type { AuditLog, Batch, Branch, Medicine, User } from "../types";

const number = new Intl.NumberFormat("en-NG");

type StockRowView = {
  batch: Pick<Batch, "id" | "batchNumber" | "expiryDate" | "location" | "branchId">;
  medicine: Medicine;
  branch?: Pick<Branch, "name">;
  quantity: number;
  status: "expired" | "near-expiry" | "ok";
};

type ReportRow = Record<string, string | number>;

export function MedicineIdentity({
  medicine,
  meta,
}: {
  medicine: Medicine;
  meta?: string;
}) {
  const displayMeta =
    meta ??
    [medicine.genericName, medicine.strength, medicine.form]
      .filter(Boolean)
      .join(" / ");
  return (
    <span className="medicine-identity">
      <strong>{medicine.brandName}</strong>
      <span>{displayMeta}</span>
    </span>
  );
}

export function Metric({
  icon: Icon,
  label,
  value,
  description,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  description?: string;
  tone?: "neutral" | "warning" | "danger" | "good";
}) {
  return (
    <div className={`metric ${tone}`}>
      <Icon size={21} />
      <span>{label}</span>
      <strong>{value}</strong>
      {description && <small>{description}</small>}
    </div>
  );
}

export function AuditTrail({
  auditLogs,
  users,
}: {
  auditLogs: AuditLog[];
  users: User[];
}) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Audit Trail</h2>
          <p>
            Critical actions are captured with actor, entity, timestamp, and
            before/after payloads.
          </p>
        </div>
      </div>
      <div className="audit-list">
        {auditLogs.length ? (
          auditLogs.map((log) => {
            const user = users.find((item) => item.id === log.userId);
            return (
              <article className="audit-item" key={log.id}>
                <ShieldCheck size={18} />
                <div>
                  <strong>{log.action}</strong>
                  <span>
                    {user?.name ?? "System"} / {log.entity} /{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <code>{log.entityId}</code>
              </article>
            );
          })
        ) : (
          <div className="empty-state">No audit entries yet.</div>
        )}
      </div>
    </section>
  );
}

export function StockTable({
  rows,
  compact = false,
  getMedicineMeta,
  getMedicineSellableUnit,
}: {
  rows: StockRowView[];
  compact?: boolean;
  getMedicineMeta?: (medicine: Medicine) => string;
  getMedicineSellableUnit: (medicine?: Medicine) => string;
}) {
  return (
    <div className="table-wrap">
      <table className={compact ? "compact-table" : ""}>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Expiry</th>
            <th>Unit</th>
            <th>Qty</th>
            {!compact && <th>Branch</th>}
            <th>Location</th>
            {!compact && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={`${row.batch.id}-${row.quantity}`}>
                <td>
                  <MedicineIdentity
                    medicine={row.medicine}
                    meta={getMedicineMeta?.(row.medicine)}
                  />
                </td>
                <td>{row.batch.batchNumber}</td>
                <td>{row.batch.expiryDate}</td>
                <td>{getMedicineSellableUnit(row.medicine)}</td>
                <td>{number.format(row.quantity)}</td>
                {!compact && <td>{row.branch?.name ?? row.batch.branchId}</td>}
                <td>{row.batch.location}</td>
                {!compact && (
                  <td>
                    <span className={`pill ${row.status}`}>
                      {row.status.replace("-", " ")}
                    </span>
                  </td>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={compact ? 6 : 8}>No stock rows yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ReportTable({ rows }: { rows: ReportRow[] }) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="table-wrap report-table">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {headers.map((header) => (
                  <td key={header}>{row[header]}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td>No report rows available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
