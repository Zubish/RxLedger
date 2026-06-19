import { ChevronRight, ClipboardList, MapPin, Smartphone } from "lucide-react";

import type {
  Branch,
  ContinuityRequest,
  ContinuityRequestStatus,
  ContinuityUrgency,
  Database,
} from "../types";

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
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Patient medication queue</h2>
          <p>
            Review only the records your branch can act on. Other branches stay
            quiet until a patient appears there or stock is available.
          </p>
        </div>
        <div className="segmented-control">
          {(["my-branch", "workspace"] as const).map((scope) => (
            <button
              className={scopeFilter === scope ? "active" : ""}
              type="button"
              key={scope}
              onClick={() => setScopeFilter(scope)}
            >
              {scope === "my-branch" ? "My branch" : "Workspace"}
            </button>
          ))}
        </div>
      </div>
      <div className="continuity-filter-row">
        {(
          [
            "active",
            "matched",
            "open",
            "contacted",
            "transferred",
            "fulfilled",
            "cancelled",
            "all",
          ] as const
        ).map((status) => (
          <button
            className={statusFilter === status ? "pill active" : "pill"}
            type="button"
            key={status}
            onClick={() => setStatusFilter(status)}
          >
            {status === "active"
              ? "Active"
              : status === "all"
                ? "All"
                : statusLabels[status]}
          </button>
        ))}
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
                      const medicine = db.medicines.find(
                        (item) => item.id === request.medicineId,
                      );
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
              >
                <span>Details</span>
                <ChevronRight size={15} />
              </button>
              {expanded && (
                <div className="continuity-request-list">
                  {group.requests.map((request) => {
                    const medicine = db.medicines.find(
                      (item) => item.id === request.medicineId,
                    );
                    const origin = db.branches.find(
                      (branch) => branch.id === request.originBranchId,
                    );
                    const matched = db.branches.find(
                      (branch) => branch.id === request.matchedBranchId,
                    );
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
                        <div className="continuity-meta-grid">
                          <span>
                            Needed: {number.format(request.quantityRequested)}
                          </span>
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
                              <Smartphone size={14} /> WhatsApp
                            </a>
                          )}
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
                            onClick={() => onProcessInPos(request)}
                          >
                            Process in POS
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateRequest(request.id, "cancelled")
                            }
                          >
                            Cancel
                          </button>
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
