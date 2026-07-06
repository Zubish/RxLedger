import type { Dispatch, FormEvent, SetStateAction } from "react";
import { ClipboardList, Smartphone } from "lucide-react";

const money = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});

export type PatientProfileSummary = {
  name: string;
  phone: string;
  visitCount: number;
  totalSpent: number;
};

export type PatientEditForm = {
  name: string;
  phone: string;
};

export type PatientContinuityItem = {
  id: string;
  label: string;
  detail: string;
};

export type PatientHistoryVisit = {
  id: string;
  reference: string;
  branchName: string;
  itemCount: number;
  total: number;
  lines: string[];
};

export type PatientHistoryGroup = {
  dateLabel: string;
  visits: PatientHistoryVisit[];
};

export type PatientFollowUpCard = {
  dateLabel: string;
  branchName: string;
  reference: string;
  message: string;
  whatsappHref: string | null;
};

export function PatientProfilePanel({
  profile,
  workspaceLabel,
  emptyMessage,
  editingPatient,
  patientEdit,
  setPatientEdit,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  continuityItems,
  continuityTitle,
  continuityEyebrow,
  historyGroups,
  selectedSaleId,
  onSelectSale,
  historyStatusLabel,
  canLoadMoreHistory,
  historyLoading,
  historyLoadMoreLabel = "Load older visits",
  onLoadMoreHistory,
  followUpCard,
  onCopyFollowUp,
}: {
  profile?: PatientProfileSummary;
  workspaceLabel: string;
  emptyMessage: string;
  editingPatient: boolean;
  patientEdit: PatientEditForm;
  setPatientEdit: Dispatch<SetStateAction<PatientEditForm>>;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (event: FormEvent) => void;
  continuityItems: PatientContinuityItem[];
  continuityTitle: string;
  continuityEyebrow?: string;
  historyGroups: PatientHistoryGroup[];
  selectedSaleId?: string;
  onSelectSale: (saleId: string) => void;
  historyStatusLabel?: string;
  canLoadMoreHistory?: boolean;
  historyLoading?: boolean;
  historyLoadMoreLabel?: string;
  onLoadMoreHistory?: () => void;
  followUpCard?: PatientFollowUpCard;
  onCopyFollowUp: (message: string) => void;
}) {
  if (!profile) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <>
      <header className="patient-profile-header">
        <div>
          <span className="eyebrow">Patient profile</span>
          <h2>{profile.name}</h2>
          <p>
            {profile.phone || "Phone number not recorded"} /{" "}
            {profile.visitCount} visit{profile.visitCount === 1 ? "" : "s"}{" "}
            across {workspaceLabel}
          </p>
        </div>
        <div className="patient-profile-actions">
          <strong>{money.format(profile.totalSpent)}</strong>
          <button type="button" onClick={onStartEdit}>
            Edit profile
          </button>
        </div>
      </header>

      {editingPatient && (
        <form
          className="patient-profile-edit"
          onSubmit={(event) => {
            onSaveEdit(event);
          }}
        >
          <label>
            Patient name
            <input
              value={patientEdit.name}
              onChange={(event) =>
                setPatientEdit((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              required
            />
          </label>
          <label>
            Phone number
            <input
              value={patientEdit.phone}
              onChange={(event) =>
                setPatientEdit((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              required
            />
          </label>
          <div>
            <button type="submit">Save profile</button>
            <button type="button" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {continuityItems.length > 0 && (
        <section className="patient-continuity-strip">
          {continuityEyebrow ? (
            <div>
              <span className="eyebrow">{continuityEyebrow}</span>
              <strong>{continuityTitle}</strong>
            </div>
          ) : (
            <strong>{continuityTitle}</strong>
          )}
          <div className={continuityEyebrow ? "patient-continuity-list" : ""}>
            {continuityItems.map((item) =>
              continuityEyebrow ? (
                <article key={item.id}>
                  <span>{item.label}</span>
                  <small>{item.detail}</small>
                </article>
              ) : (
                <span key={item.id}>
                  {item.label}
                  {item.detail ? ` / ${item.detail}` : ""}
                </span>
              ),
            )}
          </div>
        </section>
      )}

      <div className="patient-profile-grid">
        <section>
          <h3>Medication History</h3>
          <div className="patient-timeline">
            {historyGroups.map((group) => (
              <section className="patient-history-day" key={group.dateLabel}>
                <h4>{group.dateLabel}</h4>
                {group.visits.map((visit) => (
                  <button
                    className={
                      visit.id === selectedSaleId
                        ? "patient-history-visit active"
                        : "patient-history-visit"
                    }
                    key={visit.id}
                    type="button"
                    onClick={() => onSelectSale(visit.id)}
                  >
                    <span>
                      <strong>{visit.reference}</strong>
                      <small>
                        {visit.branchName} / {visit.itemCount} item
                        {visit.itemCount === 1 ? "" : "s"} /{" "}
                        {money.format(visit.total)}
                      </small>
                    </span>
                    <ul>
                      {visit.lines.map((line, index) => (
                        <li key={`${visit.id}-${index}`}>{line}</li>
                      ))}
                    </ul>
                  </button>
                ))}
              </section>
            ))}
          </div>
          {(historyStatusLabel || canLoadMoreHistory) && (
            <div className="history-paging">
              {historyStatusLabel && <span>{historyStatusLabel}</span>}
              {canLoadMoreHistory && onLoadMoreHistory && (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={onLoadMoreHistory}
                  disabled={historyLoading}
                >
                  {historyLoading ? "Loading..." : historyLoadMoreLabel}
                </button>
              )}
            </div>
          )}
        </section>

        <section>
          <h3>Follow-up Messages</h3>
          <div className="patient-message-list">
            {followUpCard ? (
              <article key={followUpCard.reference}>
                <strong>
                  {followUpCard.dateLabel} / {followUpCard.branchName} /{" "}
                  {followUpCard.reference}
                </strong>
                <p>{followUpCard.message}</p>
                <footer>
                  <button
                    type="button"
                    onClick={() => onCopyFollowUp(followUpCard.message)}
                  >
                    <ClipboardList size={14} /> Copy
                  </button>
                  {followUpCard.whatsappHref && (
                    <a
                      href={followUpCard.whatsappHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Smartphone size={14} /> WhatsApp
                    </a>
                  )}
                </footer>
              </article>
            ) : (
              <div className="empty-state">
                Select a medication history entry with a saved follow-up
                message to view it here.
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
