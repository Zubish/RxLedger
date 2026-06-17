import type { ReactNode } from "react";
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

export function NotificationsView<
  T extends {
    id: string;
    tone: AlertTone;
    title: string;
    detail: string;
  },
>({
  notifications,
  openNotification,
}: {
  notifications: T[];
  openNotification: (notification: T) => void;
}) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Notification Center</h2>
          <p>
            Chat, access, received stock, stock-out, low-stock, expired, and
            near-expiry prompts in one place.
          </p>
        </div>
      </div>
      <div className="alert-list">
        {notifications.length ? (
          notifications.map((notification) => (
            <button
              className={`notification-item alert-item ${notification.tone}`}
              key={notification.id}
              type="button"
              onClick={() => openNotification(notification)}
            >
              <NotificationIcon tone={notification.tone} />
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.detail}</span>
              </div>
            </button>
          ))
        ) : (
          <AlertItem
            tone="good"
            title="No active notifications"
            detail="Team messages, stock levels, expiry windows, and access approvals are currently clear."
          />
        )}
      </div>
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
