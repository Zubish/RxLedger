import { useEffect, useRef, useState, type ReactNode } from "react";
import { alertDisposition, type AlertPreference } from "../alertPolicy";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  X,
  XCircle,
} from "lucide-react";

const number = new Intl.NumberFormat("en-NG");

type AlertTone = "danger" | "warning" | "info" | "good";

export function AlertItem({
  title,
  detail,
  tone,
}: {
  title: ReactNode;
  detail: string;
  tone: AlertTone;
}) {
  const Icon =
    tone === "danger"
      ? XCircle
      : tone === "warning"
        ? AlertTriangle
        : tone === "good"
          ? CheckCircle2
          : ClipboardList;

  return (
    <div className={`alert-item ${tone}`}>
      <Icon size={19} />
      <div>
        <div className="alert-title">{title}</div>
        <span>{detail}</span>
      </div>
    </div>
  );
}

export function NoticeOverlay({
  notice,
}: {
  notice: {
    tone: "success" | "warning" | "danger" | "info";
    message: string;
  };
}) {
  const icon =
    notice.tone === "success" ? (
      <CheckCircle2 size={20} />
    ) : notice.tone === "warning" ? (
      <Bell size={20} />
    ) : notice.tone === "danger" ? (
      <AlertTriangle size={20} />
    ) : (
      <MessageSquare size={20} />
    );
  const label =
    notice.tone === "success"
      ? "Action completed"
      : notice.tone === "warning"
        ? "Attention"
        : notice.tone === "danger"
          ? "Action not completed"
          : "Notice";

  return (
    <div className="notice-overlay" aria-live="polite" aria-atomic="true">
      <section className={`notice-panel ${notice.tone}`} role="status">
        <div className="notice-panel-icon">{icon}</div>
        <div className="notice-panel-copy">
          <strong>{label}</strong>
          <p>{notice.message}</p>
        </div>
      </section>
    </div>
  );
}

type Notice = {
  id: string;
  tone: AlertTone;
  title: string;
  detail: string;
  branchId?: string;
  branchLabel?: string;
  kind?: string;
};
const alertPriority: Record<AlertTone, number> = {
  danger: 0,
  warning: 1,
  info: 2,
  good: 3,
};
const alertLabels: Record<string, string> = {
  low: "Pharmacy items below minimum stock",
  out: "Pharmacy items out of stock",
  expired: "Expired stock batches",
  near: "Stock batches nearing expiry",
  pending: "Staff access requests",
  chat: "Unread messages",
  received: "Stock received",
  incoming: "Incoming requisitions",
  released: "Transfers awaiting receipt",
  handled: "Requisition updates",
  branch: "Branch access requests",
  continuity: "Continuity follow-ups",
};
export function NotificationsView<T extends Notice>({
  notifications,
  allNotifications = notifications,
  preferences = [],
  openNotification,
  updatePreferences,
  compact = false,
  now: suppliedNow,
}: {
  notifications: T[];
  allNotifications?: T[];
  preferences?: AlertPreference[];
  openNotification: (notification: T) => void;
  updatePreferences?: (
    items: T[],
    mode: "snoozed" | "muted" | "restore",
  ) => Promise<boolean>;
  compact?: boolean;
  now?: number;
}) {
  const [initialNow] = useState(() => Date.now());
  const now = suppliedNow ?? initialNow;
  const [tab, setTab] = useState<"active" | "muted" | "snoozed">("active");
  const [selection, setSelection] = useState<T[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (selection && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [selection]);
  const scoped = allNotifications.filter(
    (item) =>
      !compact ||
      ["low", "out", "expired", "near"].includes(item.kind || "") ||
      item.id.startsWith("pending-"),
  );
  const items = scoped.filter(
    (item) => alertDisposition(item.id, preferences, now) === tab,
  );
  const groups = new Map<string, { label: string; items: T[] }>();
  items.forEach((item) => {
    const kind = item.kind || item.id.split(/[-:]/)[0];
    const key = kind + "|" + (item.branchId || "");
    const group = groups.get(key) || {
      label: alertLabels[kind] || "Updates",
      items: [],
    };
    group.items.push(item);
    groups.set(key, group);
  });
  const expired = scoped.filter((item) => item.kind === "expired").length;
  function openClear(targets: T[]) {
    setActionError("");
    setSelection(targets);
  }
  function closeDialog() {
    dialog.current?.close();
    setSelection(null);
  }
  async function apply(targets: T[], mode: "snoozed" | "muted" | "restore") {
    if (!updatePreferences || busy) return;
    setBusy(true);
    setActionError("");
    try {
      if (await updatePreferences(targets, mode)) closeDialog();
      else
        setActionError(
          "Unable to update these alerts. Refresh to get the latest issues, then try again.",
        );
    } catch {
      setActionError(
        "Unable to save your alert preferences. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const actions = (targets: T[]) =>
    updatePreferences && (
      <div className="alert-actions">
        {tab === "active" ? (
          <>
            <button
              type="button"
              className="ghost-button"
              disabled={busy}
              onClick={() => openClear(targets)}
            >
              Clear
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={busy}
              onClick={() => void apply(targets, "muted")}
            >
              Mute
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ghost-button"
            disabled={busy}
            onClick={() => void apply(targets, "restore")}
          >
            Restore
          </button>
        )}
      </div>
    );
  return (
    <section className={`content-section ${compact ? "dashboard-alerts" : ""}`}>
      <div className="section-heading">
        <div>
          <h2>{compact ? "Operational Alerts" : "Notification Center"}</h2>
          <p>
            Grouped by alert type and branch. Clearing or muting only changes
            your own list.
          </p>
        </div>
        {items.length > 0 && updatePreferences && (
          <div className="alert-actions">
            {tab === "active" ? (
              <>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={busy}
                  onClick={() => openClear(items)}
                >
                  Clear all
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={busy}
                  onClick={() => void apply(items, "muted")}
                >
                  Mute all
                </button>
              </>
            ) : (
              <button
                className="ghost-button"
                type="button"
                disabled={busy}
                onClick={() => void apply(items, "restore")}
              >
                Restore all
              </button>
            )}
          </div>
        )}
      </div>
      {actionError && !selection && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {expired > 0 && (
        <p className="alert-critical-summary">
          {expired} expired stock batch{expired === 1 ? "" : "es"}{" "}
          {expired === 1 ? "remains" : "remain"} unresolved, including any
          cleared or muted alerts.
        </p>
      )}
      <div
        className="segmented-control alert-list-tabs"
        aria-label="Alert lists"
      >
        {(["active", "muted", "snoozed"] as const).map((value) => (
          <button
            type="button"
            key={value}
            className={value === tab ? "active" : ""}
            aria-pressed={value === tab}
            onClick={() => setTab(value)}
          >
            {value === "snoozed"
              ? "Cleared"
              : value === "muted"
                ? "Muted"
                : "Active"}{" "}
            (
            {
              scoped.filter(
                (item) => alertDisposition(item.id, preferences, now) === value,
              ).length
            }
            )
          </button>
        ))}
      </div>
      <div className="alert-list grouped-alerts">
        {[...groups]
          .sort(
            ([, a], [, b]) =>
              alertPriority[a.items[0].tone] - alertPriority[b.items[0].tone],
          )
          .map(([key, group]) => (
            <details className={`alert-group ${group.items[0].tone}`} key={key}>
              <summary>
                <span>
                  <strong>
                    {group.items.length}{" "}
                    {group.items.length === 1
                      ? group.label
                          .replace("items", "item")
                          .replace("batches", "batch")
                          .replace("requests", "request")
                          .replace("messages", "message")
                          .replace("follow-ups", "follow-up")
                          .replace("updates", "update")
                          .replace("Transfers", "Transfer")
                      : group.label}
                  </strong>
                  <span>{group.items[0].branchLabel || "Workspace"}</span>
                </span>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="alert-group-toolbar">
                <span>Apply to this group</span>
                {actions(group.items)}
              </div>
              {group.items.map((item) => (
                <div className="alert-detail-row" key={item.id}>
                  <button
                    className={`notification-item alert-item ${item.tone}`}
                    type="button"
                    onClick={() => openNotification(item)}
                  >
                    <NotificationIcon tone={item.tone} />
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                      {tab === "snoozed" && (
                        <span>
                          Reminder:{" "}
                          {new Date(
                            Date.parse(
                              preferences.find((pref) => pref.key === item.id)
                                ?.clearedAt || "",
                            ) +
                              7 * 86400000,
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </button>
                  {actions([item])}
                </div>
              ))}
            </details>
          ))}
      </div>
      {!items.length && (
        <AlertItem
          tone="good"
          title={`No ${tab === "snoozed" ? "cleared" : tab} alerts`}
          detail={
            tab === "active"
              ? "Check the muted or cleared lists for issues that still need attention."
              : "Alerts will appear here when you clear or mute them."
          }
        />
      )}
      {selection && (
        <dialog
          ref={dialog}
          className="alert-clear-dialog"
          aria-labelledby="clear-alert-title"
          onCancel={(event) => {
            event.preventDefault();
            closeDialog();
          }}
        >
          <h2 id="clear-alert-title">
            Clear {selection.length} alert{selection.length === 1 ? "" : "s"}?
          </h2>
          <p>
            These issues may still need attention. Unresolved alerts will return
            in 7 days unless you move them to the muted list.
          </p>
          <p>
            Restocking resolves stock alerts automatically. New issues will
            still appear immediately.
          </p>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          <div className="alert-dialog-actions">
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => void apply(selection, "snoozed")}
            >
              Remind me in 7 days
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={busy}
              onClick={() => void apply(selection, "muted")}
            >
              Move to muted list
            </button>
            <button
              className="ghost-button"
              type="button"
              disabled={busy}
              onClick={closeDialog}
            >
              Cancel
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}

export function ReceivedStockModal({
  notification,
  onClose,
}: {
  notification: {
    title: string;
    detail: string;
    receivedStock?: {
      type: "receipt" | "requisition";
      sourceLabel: string;
      destinationLabel: string;
      receivedBy: string;
      receivedAt: string;
      items: Array<{
        id: string;
        name: string;
        meta: string;
        quantity: number;
        unit: string;
        batchNumber?: string;
        expiryDate?: string;
      }>;
    };
  };
  onClose: () => void;
}) {
  const received = notification.receivedStock;
  if (!received) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <section className="modal-panel wide received-stock-modal">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {received.type === "requisition"
                ? "Branch transfer received"
                : "Stock received"}
            </span>
            <h2>{notification.title}</h2>
            <p>{notification.detail}</p>
          </div>
          <button
            className="ghost-button icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close received items"
            title="Close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="received-stock-summary">
          <span>
            From <strong>{received.sourceLabel}</strong>
          </span>
          <span>
            To <strong>{received.destinationLabel}</strong>
          </span>
          <span>
            Received by <strong>{received.receivedBy}</strong>
          </span>
          <span>{new Date(received.receivedAt).toLocaleString()}</span>
        </div>
        <div className="received-stock-list">
          {received.items.map((item) => (
            <article className="line-card" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.meta || "Medication"}</span>
                {(item.batchNumber || item.expiryDate) && (
                  <small>
                    {[
                      item.batchNumber ? `Batch ${item.batchNumber}` : "",
                      item.expiryDate
                        ? `Expiry ${new Date(item.expiryDate).toLocaleDateString()}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </small>
                )}
              </div>
              <b>
                {number.format(item.quantity)} {item.unit}
              </b>
            </article>
          ))}
        </div>
        <div className="form-actions">
          <button className="primary-button" type="button" onClick={onClose}>
            Close notification
          </button>
        </div>
      </section>
    </div>
  );
}

function NotificationIcon({ tone }: { tone: AlertTone }) {
  const Icon =
    tone === "danger"
      ? XCircle
      : tone === "warning"
        ? AlertTriangle
        : tone === "good"
          ? CheckCircle2
          : ClipboardList;

  return <Icon size={19} />;
}
