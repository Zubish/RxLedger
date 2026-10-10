/** Alert keys identify an issue, not an entire category, so new issues stay visible. */
export type AlertPreference = {
  userId: string;
  key: string;
  branchId?: string;
  mode: "snoozed" | "muted";
  clearedAt: string;
};
export const ALERT_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;
export function alertDisposition(
  key: string,
  preferences: AlertPreference[],
  now = Date.now(),
) {
  const preference = preferences.find((item) => item.key === key);
  if (!preference) return "active";
  if (preference.mode === "muted") return "muted";
  return now - Date.parse(preference.clearedAt) < ALERT_REMINDER_MS
    ? "snoozed"
    : "active";
}
type Inventory = {
  medicines: Array<{
    id: string;
    brandName: string;
    genericName: string;
    strength?: string;
    active: boolean;
    reorderLevel: number;
    unit: string;
    sellableUnit?: string;
  }>;
  branches: Array<{ id: string; name: string; active: boolean }>;
  batches: Array<{
    id: string;
    medicineId: string;
    branchId: string;
    expiryDate: string;
    batchNumber: string;
    location: string;
  }>;
  stockSnapshot: Array<{ batchId: string; quantity: number }>;
  settings: { nearExpiryDays: number };
};
export function inventoryAlerts(db: Inventory, now = Date.now()) {
  const quantities = new Map(
    db.stockSnapshot.map((item) => [item.batchId, item.quantity]),
  );
  const totals = new Map<string, number>();
  const medicines = new Map(db.medicines.map((item) => [item.id, item]));
  const branches = new Map(db.branches.map((item) => [item.id, item.name]));
  const alerts: Array<{
    id: string;
    kind: string;
    branchId: string;
    branchLabel: string;
    tone: "danger" | "warning";
    title: string;
    detail: string;
    view: "medicines";
  }> = [];
  const day = new Date(now).toISOString().slice(0, 10);
  db.batches.forEach((batch) => {
    const quantity = Math.max(0, quantities.get(batch.id) || 0);
    const key = batch.branchId + ":" + batch.medicineId;
    totals.set(key, (totals.get(key) || 0) + quantity);
    const medicine = medicines.get(batch.medicineId);
    if (!medicine || !quantity) return;
    const days = Math.round(
      (Date.parse(batch.expiryDate.slice(0, 10)) - Date.parse(day)) / 86400000,
    );
    if (days > db.settings.nearExpiryDays || !Number.isFinite(days)) return;
    const kind = days < 0 ? "expired" : "near";
    alerts.push({
      id: `${kind}:${batch.branchId}:${batch.id}`,
      kind,
      branchId: batch.branchId,
      branchLabel: branches.get(batch.branchId) || "Branch",
      tone: days < 0 ? "danger" : "warning",
      title: [medicine.brandName || medicine.genericName, medicine.strength]
        .filter(Boolean)
        .join(" "),
      detail: `Batch ${batch.batchNumber} / ${quantity} ${medicine.sellableUnit || medicine.unit} in ${batch.location}. ${days < 0 ? "Expired stock needs attention." : `Expires in ${days} days.`}`,
      view: "medicines",
    });
  });
  db.branches
    .filter((branch) => branch.active)
    .forEach((branch) =>
      db.medicines
        .filter((medicine) => medicine.active && medicine.reorderLevel > 0)
        .forEach((medicine) => {
          const quantity = totals.get(branch.id + ":" + medicine.id) || 0;
          if (quantity > medicine.reorderLevel) return;
          const kind = quantity <= 0 ? "out" : "low";
          alerts.push({
            id: `${kind}:${branch.id}:${medicine.id}`,
            kind,
            branchId: branch.id,
            branchLabel: branch.name,
            tone: kind === "out" ? "danger" : "warning",
            title: [
              medicine.brandName || medicine.genericName,
              medicine.strength,
            ]
              .filter(Boolean)
              .join(" "),
            detail: `Available: ${quantity} ${medicine.sellableUnit || medicine.unit}. Minimum stock: ${medicine.reorderLevel} ${medicine.sellableUnit || medicine.unit}.`,
            view: "medicines",
          });
        }),
    );
  return alerts;
}
export function reconcileAlertPreferences<
  T extends Inventory & { alertPreferences?: AlertPreference[] },
>(db: T, now = Date.now()): T {
  if (!db.alertPreferences?.length) return db;
  const current = new Set(inventoryAlerts(db, now).map((alert) => alert.id));
  return {
    ...db,
    alertPreferences: db.alertPreferences.filter(
      (preference) =>
        !/^(low|out|near|expired):/.test(preference.key) ||
        current.has(preference.key),
    ),
  };
}
