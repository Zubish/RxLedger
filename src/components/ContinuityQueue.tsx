import { useMemo } from "react";
import { ChevronRight, ClipboardList, MapPin } from "lucide-react";

import type {
  Branch,
  ContinuityRequest,
  ContinuityRequestStatus,
  ContinuityUrgency,
  Database,
} from "../types";

import { WhatsAppIcon } from "./WhatsAppIcon";
import { MobileDisclosure } from "./MobileDisclosure";

const number = new Intl.NumberFormat("en-NG");

type ContinuityGroup = {
  key: string;
  patientName: string;
  patientPhone: string;
  requests: ContinuityRequest[];
};

type BranchAvailability = {
  branch: Branch;
  quantity: number;
  mapHref?: string;
};

export function ContinuityQueue({
  db,
  continuityGroups,
  expandedContinuityKey,
  setExpandedContinuityKey,
  canViewWorkspace,
  scopeFilter,
  setScopeFilter,
  statusFilter,
  setStatusFilter,
  statusLabels,
  urgencyLabels,
  medicineMeta,
  getAvailability,
  getWhatsappHref,
  onCopyPatientMessage,
  onUpdateRequest,
  onProcessInPos,
}: {
  db: Database;
  continuityGroups: ContinuityGroup[];
  expandedContinuityKey: string | null;
  setExpandedContinuityKey: (
    updater: (current: string | null) => string | null,
  ) => void;
  canViewWorkspace: boolean;
  scopeFilter: "my-branch" | "workspace";
  setScopeFilter: (scope: "my-branch" | "workspace") => void;
  statusFilter: "active" | ContinuityRequestStatus | "all";
  setStatusFilter: (
    status: "active" | ContinuityRequestStatus | "all",
  ) => void;
  statusLabels: Record<ContinuityRequestStatus, string>;
  urgencyLabels: Record<ContinuityUrgency, string>;
  medicineMeta: (medicine: Database["medicines"][number]) => string;
  getAvailability: (request: ContinuityRequest) => BranchAvailability[];
  getWhatsappHref: (request: ContinuityRequest) => string;
  onCopyPatientMessage: (request: ContinuityRequest) => void;
  onUpdateRequest: (
    requestId: string,
    status: ContinuityRequestStatus,
  ) => void;
  onProcessInPos: (request: ContinuityRequest) => void;
}) {
  const medicineById = useMemo(() => new Map(db.medicines.map((medicine) => [medicine.id, medicine])), [db.medicines]);
  const branchById = useMemo(() => new Map(db.branches.map((branch) => [branch.id, branch])), [db.branches]);
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Patient medication queue</h2>
          <p>
            Review patient requests, available stock, and follow-up for the selected branch.
          </p>
        </div>
        <div className="continuity-queue-controls">
          <label className="continuity-status-select">
            Queue status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            >
              <option value="active">Active</option>
              <option value="matched">Stock available</option>
              <option value="open">Waiting</option>
              <option value="contacted">Contacted</option>
              <option value="transferred">Transfer requested</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All requests</option>
            </select>
          </label>
          {canViewWorkspace && <div className="segmented-control">
          {(["my-branch", "workspace"] as const).map((scope) => (
            <button
              className={scopeFilter === scope ? "active" : ""}
              type="button"
              key={scope}
              aria-pressed={scopeFilter === scope}
              onClick={() => setScopeFilter(scope)}
            >
              {scope === "my-branch" ? "My branch" : "Workspace"}
            </button>
          ))}
          </div>}
        </div>
      </div>
      <div className="continuity-list">
        {continuityGroups.map((group) => {
          const expanded = expandedContinuityKey === group.key;
          const visiblePreview = group.requests.slice(0, 2);
          const mostUrgent = group.requests.reduce((current, request) => {
            const rank = { urgent: 3, important: 2, routine: 1 };
            return rank[request.urgency] > rank[current.urgency]
              ? request
              : current;
          }, group.requests[0]);
          const hasMatched = group.requests.some(
            (request) => request.status === "matched",
          );

          return (
            <article
              className={`continuity-card ${hasMatched ? "matched" : mostUrgent.status} ${
                expanded ? "is-expanded" : "is-collapsed"
              }`}
              key={group.key}
            >
              <header className="continuity-card-header">
                <div className="continuity-patient-block">
                  <strong className="continuity-patient-name">
                    {group.patientName}
                  </strong>
                  <span className="continuity-patient-phone">
                    {group.patientPhone || "No phone recorded"} /{" "}
                    {group.requests.length} owed medicine
                    {group.requests.length === 1 ? "" : "s"}
                  </span>
                  <div className="continuity-owed-list compact">
                    {visiblePreview.map((request) => {
                      const medicine = medicineById.get(request.medicineId);
                      return (
                        <span key={request.id}>
                          {request.requestedMedicineName}
                          {medicine ? ` / ${medicineMeta(medicine)}` : ""} /{" "}
                          {number.format(request.quantityRequested)} owed
                        </span>
                      );
                    })}
                    {group.requests.length > visiblePreview.length && (
                      <span>
                        +{group.requests.length - visiblePreview.length} more
                      </span>
                    )}
                  </div>
                </div>
                <div className="continuity-card-status">
                  <span
                    className={`pill ${
                      mostUrgent.urgency === "urgent"
                        ? "expired"
                        : mostUrgent.urgency === "important"
                          ? "warning"
                          : "active"
                    }`}
                  >
                    {urgencyLabels[mostUrgent.urgency]}
                  </span>
                  <strong>
                    {hasMatched
                      ? "Stock available"
                      : statusLabels[mostUrgent.status]}
                  </strong>
                </div>
              </header>
              <button
                className="continuity-dropdown"
                type="button"
                onClick={() =>
                  setExpandedContinuityKey((current) =>
                    current === group.key ? null : group.key,
                  )
                }
                aria-expanded={expanded}
                aria-controls={`continuity-details-${group.requests[0].id}`}
                aria-label={`${expanded ? "Hide" : "Show"} details for ${group.patientName}`}
              >
                <span>Details</span>
                <ChevronRight size={15} />
              </button>
              {expanded && (
                <div className="continuity-request-list" id={`continuity-details-${group.requests[0].id}`}>
                  {group.requests.map((request) => {
                    const medicine = medicineById.get(request.medicineId);
                    const origin = branchById.get(request.originBranchId);
                    const matched = request.matchedBranchId ? branchById.get(request.matchedBranchId) : undefined;
                    const availability = getAvailability(request);
                    const whatsapp = getWhatsappHref(request);

                    return (
                      <section
                        className="continuity-request-item"
                        key={request.id}
                      >
                        <div className="continuity-request-heading">
                          <strong>
                            {request.requestedMedicineName}
                            {medicine ? ` / ${medicineMeta(medicine)}` : ""}
                          </strong>
                          <span>{statusLabels[request.status]}</span>
                        </div>
                        <p className="continuity-quantity">Needed: {number.format(request.quantityRequested)}</p>
                        <MobileDisclosure title="Stock and request details"
                          summary={availability.length ? `${availability.length} branch${availability.length === 1 ? "" : "es"} with stock` : "Awaiting stock"}>
                        <div className="continuity-meta-grid">
                          <span className="continuity-desktop-quantity">Needed: {number.format(request.quantityRequested)}</span>
                          <span>
                            Recorded {formatDateTime(request.createdAt)} by{" "}
                            {getUserName(db, request.createdBy)}
                          </span>
                          <span>
                            {request.fulfilledAt
                              ? `Sold ${formatDateTime(request.fulfilledAt)} by ${getUserName(db, request.resolvedBy)}`
                              : `Recorded at ${origin?.name ?? request.originBranchId}`}
                          </span>
                          <span>
                            {matched
                              ? `Available at ${matched.name}`
                              : "Waiting for available stock"}
                          </span>
                        </div>
                        {request.note && (
                          <p className="continuity-note">{request.note}</p>
                        )}
                        <div className="branch-availability-list">
                          {availability.map((entry) => (
                            <div key={entry.branch.id}>
                              <MapPin size={15} />
                              <span>
                                <strong>{entry.branch.name}</strong>
                                {entry.branch.address || "No address recorded"}{" "}
                                / {number.format(entry.quantity)} available
                              </span>
                              {entry.mapHref && (
                                <a
                                  href={entry.mapHref}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Map
                                </a>
                              )}
                            </div>
                          ))}
                          {!availability.length && (
                            <small>
                              No non-expired stock is available in another
                              branch yet.
                            </small>
                          )}
                        </div>
                        </MobileDisclosure>
                        <footer>
                          <button
                            type="button"
                            onClick={() => onCopyPatientMessage(request)}
                          >
                            <ClipboardList size={14} /> Copy
                          </button>
                          {whatsapp && (
                            <a
                              href={whatsapp}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <WhatsAppIcon size={14} /> WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => onProcessInPos(request)}
                          >
                            Process in POS
                          </button>
                          <MobileDisclosure title="More actions" summary="Contact status, transfer or cancel">
                            <div className="continuity-secondary-actions">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRequest(request.id, "contacted")
                            }
                          >
                            Mark contacted
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRequest(request.id, "transferred")
                            }
                          >
                            Request transfer
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRequest(request.id, "cancelled")
                            }
                          >
                            Cancel
                          </button>
                            </div>
                          </MobileDisclosure>
                        </footer>
                      </section>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
        {!continuityGroups.length && (
          <div className="empty-state">
            No continuity requests match this scope. When a patient is waiting
            for unavailable stock, add them here instead of relying on memory.
          </div>
        )}
      </div>
    </section>
  );
}

function getUserName(db: Database, userId?: string) {
  if (!userId) return "Not recorded";
  return db.users.find((user) => user.id === userId)?.name ?? "Unknown user";
}

function formatDateTime(value?: string) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}
