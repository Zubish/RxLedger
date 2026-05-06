import {
  addAudit,
  canAdjust,
  canAdmin,
  canWrite,
  daysUntil,
  fail,
  getAuthenticatedUser,
  id,
  loadDatabase,
  nowIso,
  requireMethod,
  sanitizeDatabase,
  saveDatabase,
  today,
} from './_shared'
import type { Database, HandlerRequest, HandlerResponse, LedgerType, Medicine, Role, Supplier } from './_shared'

type ActionBody = {
  action: string
  payload?: Record<string, unknown>
}

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as ActionBody
    const db = await loadDatabase()
    const actor = await getAuthenticatedUser(req, db)
    if (!actor) {
      fail(res, 401, 'Authentication required')
      return
    }

    switch (body.action) {
      case 'updateUser':
        updateUser(db, actor.id, body.payload)
        break
      case 'upsertMedicine':
        upsertMedicine(db, actor.id, actor.role, body.payload)
        break
      case 'upsertSupplier':
        upsertSupplier(db, actor.id, actor.role, body.payload)
        break
      case 'receiveStock':
        receiveStock(db, actor.id, actor.role, body.payload)
        break
      case 'issueStock':
        issueStock(db, actor.id, actor.role, body.payload)
        break
      case 'adjustStock':
        adjustStock(db, actor.id, actor.role, body.payload)
        break
      case 'updateSettings':
        updateSettings(db, actor.id, actor.role, body.payload)
        break
      default:
        fail(res, 400, 'Unknown action')
        return
    }

    await saveDatabase(db)
    const clean = sanitizeDatabase(db)
    res.status(200).json({ db: clean, currentUser: clean.users.find((user) => user.id === actor.id) })
  } catch (error) {
    fail(res, 400, error instanceof Error ? error.message : 'Unable to complete action')
  }
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value.trim()
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function requireNumber(value: unknown, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number`)
  return parsed
}

function updateUser(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canAdmin(actor)) throw new Error('Only admins can update users')
  const userId = requireString(payload?.userId, 'User')
  const target = db.users.find((user) => user.id === userId)
  if (!target) throw new Error('User not found')
  const updates = (payload?.updates ?? {}) as Partial<{ role: Role; status: 'pending' | 'active' | 'suspended' }>
  if (target.id === actorId && updates.status && updates.status !== 'active') throw new Error('You cannot suspend your own active admin account')
  const before = { ...target }
  if (updates.role) target.role = updates.role
  if (updates.status) {
    target.status = updates.status
    if (updates.status === 'active') {
      target.approvedAt = nowIso()
      target.approvedBy = actorId
    }
  }
  addAudit(db, actorId, 'Updated user access', 'user', userId, before, { ...target })
}

function upsertMedicine(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to save medicines')
  const recordInput = (payload?.record ?? {}) as Partial<Medicine>
  const barcodes = Array.isArray(recordInput.barcodes) ? recordInput.barcodes.map(String).map((item) => item.trim()).filter(Boolean) : []
  const record: Medicine = {
    id: recordInput.id || id('med'),
    sku: requireString(recordInput.sku, 'SKU'),
    brandName: requireString(recordInput.brandName, 'Brand name'),
    genericName: requireString(recordInput.genericName, 'Generic name'),
    form: optionalString(recordInput.form) || 'Tablet',
    strength: optionalString(recordInput.strength),
    unit: optionalString(recordInput.unit) || 'Unit',
    category: optionalString(recordInput.category),
    manufacturer: optionalString(recordInput.manufacturer),
    nafdacNumber: optionalString(recordInput.nafdacNumber),
    barcodes,
    reorderLevel: Number(recordInput.reorderLevel) || 0,
    active: recordInput.active !== false,
  }
  const duplicateBarcode = db.medicines.find((medicine) => medicine.id !== record.id && medicine.barcodes.some((code) => record.barcodes.includes(code)))
  if (duplicateBarcode) throw new Error(`Barcode already belongs to ${duplicateBarcode.brandName}`)
  const before = db.medicines.find((medicine) => medicine.id === record.id)
  db.medicines = before ? db.medicines.map((medicine) => (medicine.id === record.id ? record : medicine)) : [record, ...db.medicines]
  addAudit(db, actorId, before ? 'Updated medicine record' : 'Created medicine record', 'medicine', record.id, before, record)
}

function upsertSupplier(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to save suppliers')
  const input = (payload?.record ?? {}) as Partial<Supplier>
  const record: Supplier = {
    id: input.id || id('sup'),
    name: requireString(input.name, 'Supplier name'),
    contact: optionalString(input.contact),
    address: optionalString(input.address),
    licenseRef: optionalString(input.licenseRef),
    active: input.active !== false,
  }
  const before = db.suppliers.find((supplier) => supplier.id === record.id)
  db.suppliers = before ? db.suppliers.map((supplier) => (supplier.id === record.id ? record : supplier)) : [record, ...db.suppliers]
  addAudit(db, actorId, before ? 'Updated supplier' : 'Created supplier', 'supplier', record.id, before, record)
}

function receiveStock(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to receive stock')
  const medicineId = requireString(payload?.medicineId, 'Medicine')
  const supplierId = requireString(payload?.supplierId, 'Supplier')
  if (!db.medicines.some((medicine) => medicine.id === medicineId)) throw new Error('Medicine not found')
  if (!db.suppliers.some((supplier) => supplier.id === supplierId)) throw new Error('Supplier not found')
  const quantity = requireNumber(payload?.quantity, 'Quantity')
  if (quantity <= 0) throw new Error('Quantity must be greater than zero')
  const batch = {
    id: id('bat'),
    medicineId,
    supplierId,
    batchNumber: requireString(payload?.batchNumber, 'Batch number'),
    expiryDate: requireString(payload?.expiryDate, 'Expiry date'),
    unitCost: Number(payload?.unitCost) || 0,
    sellingPrice: Number(payload?.sellingPrice) || 0,
    receivedDate: today(),
    location: optionalString(payload?.location) || 'Main Store',
    branchId: 'main',
  }
  const ledger = {
    id: id('led'),
    medicineId,
    batchId: batch.id,
    type: 'stock-in' as LedgerType,
    quantity,
    reason: 'Goods received',
    reference: optionalString(payload?.invoiceRef) || 'GRN',
    userId: actorId,
    createdAt: nowIso(),
  }
  const receipt = {
    id: id('grn'),
    supplierId,
    invoiceRef: optionalString(payload?.invoiceRef) || 'Manual receive',
    receivedAt: nowIso(),
    userId: actorId,
    items: [{ medicineId, batchId: batch.id, quantity, unitCost: batch.unitCost }],
  }
  db.batches.unshift(batch)
  db.ledger.unshift(ledger)
  db.receipts.unshift(receipt)
  addAudit(db, actorId, 'Received stock', 'batch', batch.id, undefined, { batch, quantity })
}

function issueStock(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to issue stock')
  const medicineId = requireString(payload?.medicineId, 'Medicine')
  const quantity = requireNumber(payload?.quantity, 'Quantity')
  if (quantity <= 0) throw new Error('Quantity must be greater than zero')
  const rows = db.batches
    .filter((batch) => batch.medicineId === medicineId)
    .map((batch) => ({
      batch,
      quantity: db.ledger.filter((entry) => entry.batchId === batch.id).reduce((sum, entry) => sum + entry.quantity, 0),
      daysToExpiry: daysUntil(batch.expiryDate),
    }))
    .filter((row) => row.quantity > 0 && row.daysToExpiry >= 0)
    .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))
  const total = rows.reduce((sum, row) => sum + row.quantity, 0)
  if (quantity > total) throw new Error('Stock-out blocked: quantity exceeds available non-expired stock')
  let remaining = quantity
  const entries = []
  for (const row of rows) {
    if (remaining <= 0) break
    const take = Math.min(row.quantity, remaining)
    entries.push({
      id: id('led'),
      medicineId,
      batchId: row.batch.id,
      type: 'stock-out' as LedgerType,
      quantity: -take,
      reason: optionalString(payload?.reason) || 'Dispense',
      reference: optionalString(payload?.reference) || 'Manual issue',
      userId: actorId,
      createdAt: nowIso(),
    })
    remaining -= take
  }
  db.ledger.unshift(...entries)
  addAudit(db, actorId, 'Issued stock using FEFO', 'ledger', entries[0]?.id ?? id('led'), undefined, entries)
}

function adjustStock(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canAdjust({ ...actor, role: actorRole })) throw new Error('You do not have permission to adjust stock')
  const batchId = requireString(payload?.batchId, 'Batch')
  const batch = db.batches.find((item) => item.id === batchId)
  if (!batch) throw new Error('Batch not found')
  const mode = requireString(payload?.mode, 'Transaction type') as LedgerType
  const quantity = requireNumber(payload?.quantity, 'Quantity')
  const current = db.ledger.filter((entry) => entry.batchId === batchId).reduce((sum, entry) => sum + entry.quantity, 0)
  const isPositive = mode === 'adjustment' || mode === 'customer-return'
  if (!isPositive && quantity > current) throw new Error('Adjustment blocked: cannot reduce more than available stock')
  const entry = {
    id: id('led'),
    medicineId: batch.medicineId,
    batchId,
    type: mode,
    quantity: isPositive ? quantity : -quantity,
    reason: requireString(payload?.reason, 'Reason'),
    reference: optionalString(payload?.reference) || mode,
    userId: actorId,
    createdAt: nowIso(),
  }
  db.ledger.unshift(entry)
  addAudit(db, actorId, `Posted ${mode}`, 'ledger', entry.id, undefined, entry)
}

function updateSettings(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canAdmin({ ...actor, role: actorRole })) throw new Error('Only admins can update settings')
  const before = { ...db.settings }
  db.settings = {
    pharmacyName: optionalString(payload?.pharmacyName) || db.settings.pharmacyName,
    branchName: optionalString(payload?.branchName) || db.settings.branchName,
    nearExpiryDays: Number(payload?.nearExpiryDays) || db.settings.nearExpiryDays,
    approvalThreshold: Number(payload?.approvalThreshold) || db.settings.approvalThreshold,
  }
  addAudit(db, actorId, 'Updated system settings', 'settings', 'main', before, db.settings)
}
