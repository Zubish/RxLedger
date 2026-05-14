import {
  addAudit,
  addSecurityEvent,
  canAdjust,
  canAdmin,
  canManageBranch,
  canWrite,
  canWriteBranch,
  daysUntil,
  deleteOtherSessions,
  fail,
  getAuthenticatedUser,
  getBearerToken,
  getRequestIp,
  getRequestUserAgent,
  hasActiveBranchAssignment,
  id,
  loadDatabase,
  nowIso,
  requireMethod,
  sanitizeDatabase,
  saveDatabase,
  sendSecurityEmail,
  today,
} from './_shared.js'
import type { Database, HandlerRequest, HandlerResponse, LedgerType, Medicine, Role, Supplier } from './_shared.js'
import type { Branch } from './_shared.js'

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
      case 'triggerSecurityPanic':
        await triggerSecurityPanic(req, db, actor.id)
        break
      case 'upsertMedicine':
        upsertMedicine(db, actor.id, actor.role, body.payload)
        break
      case 'upsertMedicines':
        upsertMedicines(db, actor.id, actor.role, body.payload)
        break
      case 'upsertSupplier':
        upsertSupplier(db, actor.id, actor.role, body.payload)
        break
      case 'upsertBranch':
        upsertBranch(db, actor.id, actor.role, body.payload)
        break
      case 'updateBranchAccess':
        updateBranchAccess(db, actor.id, body.payload)
        break
      case 'requestBranchAccess':
        requestBranchAccess(db, actor.id, body.payload)
        break
      case 'receiveStock':
        receiveStock(db, actor.id, actor.role, body.payload)
        break
      case 'createRequisition':
        createRequisition(db, actor.id, body.payload)
        break
      case 'fulfillRequisition':
        fulfillRequisition(db, actor.id, body.payload)
        break
      case 'rejectRequisition':
        rejectRequisition(db, actor.id, body.payload)
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
      case 'sendChatMessage':
        sendChatMessage(db, actor.id, body.payload)
        break
      case 'markChatRead':
        markChatRead(db, actor.id)
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

function getPrimaryAdminId(db: Database) {
  return db.settings.primaryAdminId || db.users.find((user) => user.role === 'admin' && user.status === 'active')?.id || ''
}

function updateUser(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  const primaryAdminId = getPrimaryAdminId(db)
  if (!actor || !canAdmin(actor, primaryAdminId)) throw new Error('Only the permanent admin can update users')
  const userId = requireString(payload?.userId, 'User')
  const target = db.users.find((user) => user.id === userId)
  if (!target) throw new Error('User not found')
  const updates = (payload?.updates ?? {}) as Partial<{ role: Role; status: 'pending' | 'active' | 'suspended' }>
  if (target.id === primaryAdminId && ((updates.status && updates.status !== 'active') || (updates.role && updates.role !== 'admin'))) {
    throw new Error('The permanent account admin cannot be downgraded or suspended')
  }
  if (target.id === actorId && updates.status && updates.status !== 'active') throw new Error('You cannot suspend your own active admin account')
  const before = { ...target }
  if (updates.role) target.role = updates.role
  if (updates.status) {
    target.status = updates.status
    if (updates.status === 'active') {
      target.approvedAt = nowIso()
      target.approvedBy = actorId
      if (!target.branchIds.length && db.branches[0]) target.branchIds = [db.branches[0].id]
    }
  }
  addAudit(db, actorId, 'Updated user access', 'user', userId, before, { ...target })
}

async function triggerSecurityPanic(req: HandlerRequest, db: Database, actorId: string) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const token = getBearerToken(req)
  await deleteOtherSessions(actorId, token)
  addSecurityEvent(db, {
    userId: actor.id,
    email: actor.email,
    type: 'panic-triggered',
    severity: 'critical',
    detail: 'The user triggered Secure my account. Other sessions were signed out.',
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
  })
  addAudit(db, actorId, 'Triggered secure account panic action', 'user', actorId, undefined, { signedOutOtherSessions: true })
  try {
    await sendSecurityEmail(actor.email, 'RxLedger account security action triggered', 'Secure my account was triggered for your RxLedger account. Other sessions were signed out. If this was not you, reset your password immediately.')
  } catch (error) {
    addSecurityEvent(db, {
      userId: actor.id,
      email: actor.email,
      type: 'security-email-failed',
      severity: 'warning',
      detail: error instanceof Error ? error.message : 'Unable to send panic alert email.',
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
    })
  }
}

function updateBranchAccess(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  const branchId = requireString(payload?.branchId, 'Branch')
  const primaryAdminId = getPrimaryAdminId(db)
  if (!actor || !canManageBranch(actor, branchId, primaryAdminId)) throw new Error('Only this branch manager or the permanent admin can update branch access')
  const branch = db.branches.find((item) => item.id === branchId)
  if (!branch) throw new Error('Branch not found')
  const userId = requireString(payload?.userId, 'User')
  const target = db.users.find((user) => user.id === userId)
  if (!target) throw new Error('User not found')
  if (target.status !== 'active') throw new Error('Only active users can be assigned to branches')
  if (target.id === primaryAdminId) throw new Error('The permanent admin already has access to every branch')
  const canAccess = Boolean(payload?.canAccess)
  const expiresAt = optionalString(payload?.expiresAt)
  if (canAccess && expiresAt && expiresAt < today()) throw new Error('Branch access expiry must be today or a future date')
  if (!canAccess && target.managedBranchIds.includes(branchId)) throw new Error('Branch managers cannot be removed from their managed branch here')
  const otherManagedBranchIds = target.managedBranchIds.filter((id) => id !== branchId && hasActiveBranchAssignment(target, id))
  if (canAccess && otherManagedBranchIds.length) {
    throw new Error('This user manages another branch. Change their manager assignment before moving them.')
  }
  const otherBranchIds = target.branchIds.filter((id) => id !== branchId && hasActiveBranchAssignment(target, id))
  if (canAccess && otherBranchIds.length && !canAdmin(actor, primaryAdminId)) {
    const currentBranch = db.branches.find((item) => item.id === otherBranchIds[0])
    throw new Error(`${target.name} is still assigned to ${currentBranch?.name ?? 'another branch'}. That branch manager must release them before they can work here.`)
  }
  const before = { ...target, branchIds: [...target.branchIds], managedBranchIds: [...target.managedBranchIds], branchAccessExpiresAt: { ...(target.branchAccessExpiresAt ?? {}) } }
  target.branchAccessExpiresAt = { ...(target.branchAccessExpiresAt ?? {}) }
  target.branchIds = canAccess ? [branchId] : target.branchIds.filter((id) => id !== branchId)
  if (canAccess && expiresAt) {
    target.branchAccessExpiresAt[branchId] = expiresAt
  } else {
    delete target.branchAccessExpiresAt[branchId]
  }
  if (canAccess) {
    db.branchAccessRequests = db.branchAccessRequests.map((request) => (
      request.userId === userId && request.branchId === branchId && request.status === 'pending'
        ? { ...request, status: 'approved', updatedAt: nowIso(), resolvedAt: nowIso(), resolvedBy: actorId }
        : request
    ))
  }
  addAudit(db, actorId, canAccess ? 'Granted branch access' : 'Removed branch access', 'user', userId, before, { ...target })
}

function requestBranchAccess(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  if (actor.status !== 'active') throw new Error('Only active users can request branch access')
  if (actor.id === getPrimaryAdminId(db)) throw new Error('The permanent admin already has access to every branch')
  const branchId = requireString(payload?.branchId, 'Branch')
  if (!db.branches.some((branch) => branch.id === branchId && branch.active)) throw new Error('Active branch not found')
  if (hasActiveBranchAssignment(actor, branchId)) throw new Error('You already have access to this branch')
  const existing = db.branchAccessRequests.find((request) => request.userId === actorId && request.branchId === branchId && request.status === 'pending')
  if (existing) return
  const request = {
    id: id('bar'),
    userId: actorId,
    branchId,
    status: 'pending' as const,
    requestedAt: nowIso(),
    updatedAt: nowIso(),
  }
  db.branchAccessRequests.unshift(request)
  addAudit(db, actorId, 'Requested branch access', 'branch-access-request', request.id, undefined, request)
}

function upsertMedicine(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to save medicines')
  const record = normalizeMedicine((payload?.record ?? {}) as Partial<Medicine>)
  saveMedicineRecord(db, actorId, record)
}

function upsertMedicines(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to save medicines')
  const inputs = Array.isArray(payload?.records) ? (payload.records as Partial<Medicine>[]) : []
  if (!inputs.length) throw new Error('Add at least one medicine record')
  const records = inputs.map((record) => normalizeMedicine(record))
  const seenBarcodes = new Map<string, string>()
  for (const record of records) {
    for (const barcode of record.barcodes) {
      const previous = seenBarcodes.get(barcode)
      if (previous && previous !== record.id) throw new Error(`Barcode ${barcode} appears more than once in this import`)
      seenBarcodes.set(barcode, record.id)
    }
  }
  records.forEach((record) => saveMedicineRecord(db, actorId, record))
  addAudit(db, actorId, `Bulk saved ${records.length} medicine records`, 'medicine', 'bulk', undefined, records.map((record) => record.id))
}

function normalizeMedicine(recordInput: Partial<Medicine>): Medicine {
  const barcodes = Array.isArray(recordInput.barcodes) ? recordInput.barcodes.map(String).map((item) => item.trim()).filter(Boolean) : []
  return {
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
}

function saveMedicineRecord(db: Database, actorId: string, record: Medicine) {
  const duplicateBarcode = db.medicines.find((medicine) => medicine.id !== record.id && medicine.barcodes.some((code) => record.barcodes.includes(code)))
  if (duplicateBarcode) throw new Error(`Barcode already belongs to ${duplicateBarcode.brandName}`)
  const duplicateSku = db.medicines.find((medicine) => medicine.id !== record.id && medicine.sku.toLowerCase() === record.sku.toLowerCase())
  if (duplicateSku) throw new Error(`SKU already belongs to ${duplicateSku.brandName}`)
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

function upsertBranch(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  const input = (payload?.record ?? {}) as Partial<Branch>
  if (!actor) throw new Error('Authentication required')
  const primaryAdminId = getPrimaryAdminId(db)
  if (!input.id && !canAdmin({ ...actor, role: actorRole }, primaryAdminId)) throw new Error('Only the permanent admin can create branches')
  if (input.id && !canManageBranch(actor, input.id, primaryAdminId)) throw new Error('Only this branch manager or the permanent admin can save this branch')
  const name = requireString(input.name, 'Branch name')
  const managerUserId = optionalString(input.managerUserId)
  if (managerUserId && !canAdmin({ ...actor, role: actorRole }, primaryAdminId)) throw new Error('Only the permanent admin can assign branch managers')
  if (managerUserId) {
    if (managerUserId === primaryAdminId) throw new Error('The permanent admin remains global and should not be assigned as a branch manager')
    const manager = db.users.find((user) => user.id === managerUserId && user.status === 'active')
    if (!manager) throw new Error('Manager user not found')
    if (manager.role === 'viewer') throw new Error('Viewers cannot be branch managers')
  }
  const record: Branch = {
    id: input.id || id('br'),
    name,
    code: optionalString(input.code) || name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'BRANCH',
    address: optionalString(input.address),
    managerName: optionalString(input.managerName),
    managerUserId,
    phone: optionalString(input.phone),
    active: input.id === 'main' ? true : input.active !== false,
    createdAt: input.createdAt || nowIso(),
  }
  const duplicateCode = db.branches.find((branch) => branch.id !== record.id && branch.code.toLowerCase() === record.code.toLowerCase())
  if (duplicateCode) throw new Error(`Branch code already belongs to ${duplicateCode.name}`)
  const before = db.branches.find((branch) => branch.id === record.id)
  db.branches = before ? db.branches.map((branch) => (branch.id === record.id ? record : branch)) : [record, ...db.branches]
  if (record.id === 'main') db.settings.branchName = record.name
  if (before?.managerUserId && before.managerUserId !== record.managerUserId) {
    const previousManager = db.users.find((user) => user.id === before.managerUserId)
    if (previousManager && previousManager.id !== primaryAdminId) {
      previousManager.managedBranchIds = previousManager.managedBranchIds.filter((id) => id !== record.id)
      previousManager.branchIds = previousManager.branchIds.filter((id) => id !== record.id)
      delete previousManager.branchAccessExpiresAt?.[record.id]
    }
  }
  if (record.managerUserId) {
    const manager = db.users.find((user) => user.id === record.managerUserId)
    if (manager) {
      db.branches = db.branches.map((branch) => (
        branch.id !== record.id && branch.managerUserId === manager.id
          ? { ...branch, managerUserId: '', managerName: '' }
          : branch
      ))
      manager.branchIds = [record.id]
      manager.managedBranchIds = [record.id]
      manager.branchAccessExpiresAt = {}
      db.branchAccessRequests = db.branchAccessRequests.map((request) => (
        request.userId === manager.id && request.branchId === record.id && request.status === 'pending'
          ? { ...request, status: 'approved', updatedAt: nowIso(), resolvedAt: nowIso(), resolvedBy: actorId }
          : request
      ))
    }
  }
  addAudit(db, actorId, before ? 'Updated branch' : 'Created branch', 'branch', record.id, before, record)
}

function receiveStock(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to receive stock')
  const supplierId = requireString(payload?.supplierId, 'Supplier')
  if (!db.suppliers.some((supplier) => supplier.id === supplierId)) throw new Error('Supplier not found')
  const branchId = optionalString(payload?.branchId) || db.branches.find((branch) => branch.active)?.id || 'main'
  if (!db.branches.some((branch) => branch.id === branchId && branch.active)) throw new Error('Active branch not found')
  if (!canWriteBranch(actor, branchId, getPrimaryAdminId(db))) throw new Error('You only have view access in this branch')
  const inputs = Array.isArray(payload?.items)
    ? (payload.items as Record<string, unknown>[])
    : [{
        medicineId: payload?.medicineId,
        batchNumber: payload?.batchNumber,
        expiryDate: payload?.expiryDate,
        quantity: payload?.quantity,
        unitCost: payload?.unitCost,
        sellingPrice: payload?.sellingPrice,
        location: payload?.location,
      }]
  if (!inputs.length) throw new Error('Add at least one stock line')
  const reference = optionalString(payload?.invoiceRef) || 'Manual receive'
  const receipt = {
    id: id('grn'),
    supplierId,
    invoiceRef: reference,
    receivedAt: nowIso(),
    userId: actorId,
    items: [] as Array<{ medicineId: string; batchId: string; quantity: number; unitCost: number }>,
  }
  const batches = []
  const ledgerEntries = []
  for (const input of inputs) {
    const medicineId = requireString(input.medicineId, 'Medicine')
    if (!db.medicines.some((medicine) => medicine.id === medicineId)) throw new Error('Medicine not found')
    const quantity = requireNumber(input.quantity, 'Quantity')
    if (quantity <= 0) throw new Error('Quantity must be greater than zero')
    const expiryDate = requireString(input.expiryDate, 'Expiry date')
    if (expiryDate < today()) throw new Error('Expiry date must be today or a future date')
    const unitCost = Number(input.unitCost) || 0
    const sellingPrice = Number(input.sellingPrice) || 0
    if (sellingPrice > 0 && sellingPrice < unitCost) throw new Error('Selling price cannot be lower than unit cost')
    const batch = {
      id: id('bat'),
      medicineId,
      supplierId,
      batchNumber: requireString(input.batchNumber, 'Batch number'),
      expiryDate,
      unitCost,
      sellingPrice,
      receivedDate: today(),
      location: optionalString(input.location) || 'Main Store',
      branchId,
    }
    const ledger = {
      id: id('led'),
      medicineId,
      batchId: batch.id,
      type: 'stock-in' as LedgerType,
      quantity,
      reason: 'Goods received',
      reference,
      userId: actorId,
      createdAt: nowIso(),
    }
    batches.push(batch)
    ledgerEntries.push(ledger)
    receipt.items.push({ medicineId, batchId: batch.id, quantity, unitCost: batch.unitCost })
  }
  db.batches.unshift(...batches)
  db.ledger.unshift(...ledgerEntries)
  db.receipts.unshift(receipt)
  addAudit(db, actorId, `Received ${receipt.items.length} stock line${receipt.items.length > 1 ? 's' : ''}`, 'receipt', receipt.id, undefined, receipt)
}

function getBatchAvailable(db: Database, batchId: string) {
  return db.ledger.filter((entry) => entry.batchId === batchId).reduce((sum, entry) => sum + entry.quantity, 0)
}

function getUserRequestingBranches(db: Database, actorId: string) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) return []
  if (canAdmin(actor, getPrimaryAdminId(db))) return db.branches.filter((branch) => branch.active)
  const branchIds = Array.from(new Set([...actor.branchIds, ...actor.managedBranchIds]))
  return db.branches.filter((branch) => branch.active && branchIds.includes(branch.id))
}

function createRequisition(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const sourceBranchId = requireString(payload?.sourceBranchId, 'Supplying branch')
  const requestingBranchId = requireString(payload?.requestingBranchId, 'Requesting branch')
  if (sourceBranchId === requestingBranchId) throw new Error('Choose a different requesting branch')
  if (!db.branches.some((branch) => branch.id === sourceBranchId && branch.active)) throw new Error('Supplying branch not found')
  if (!db.branches.some((branch) => branch.id === requestingBranchId && branch.active)) throw new Error('Requesting branch not found')
  if (!getUserRequestingBranches(db, actorId).some((branch) => branch.id === requestingBranchId)) {
    throw new Error('You can only request into a branch you work in')
  }
  const inputs = Array.isArray(payload?.items) ? (payload.items as Record<string, unknown>[]) : []
  if (!inputs.length) throw new Error('Add at least one requisition item')
  const items = inputs.map((input) => {
    const batchId = requireString(input.batchId, 'Batch')
    const batch = db.batches.find((item) => item.id === batchId)
    if (!batch || batch.branchId !== sourceBranchId) throw new Error('Batch is not available in the supplying branch')
    const medicineId = requireString(input.medicineId, 'Medicine')
    if (batch.medicineId !== medicineId || !db.medicines.some((medicine) => medicine.id === medicineId)) throw new Error('Medicine and batch do not match')
    const quantity = requireNumber(input.quantity, 'Quantity')
    if (quantity <= 0) throw new Error('Quantity must be greater than zero')
    if (quantity > getBatchAvailable(db, batchId)) throw new Error('Requested quantity exceeds current batch availability')
    return {
      id: id('reqitem'),
      medicineId,
      batchId,
      quantity,
    }
  })
  const request = {
    id: id('req'),
    requesterUserId: actorId,
    requestingBranchId,
    sourceBranchId,
    status: 'pending' as const,
    items,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    note: optionalString(payload?.note),
  }
  db.requisitions.unshift(request)
  addAudit(db, actorId, 'Created internal requisition', 'requisition', request.id, undefined, request)
}

function fulfillRequisition(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const requestId = requireString(payload?.requestId, 'Requisition')
  const request = db.requisitions.find((item) => item.id === requestId)
  if (!request || request.status !== 'pending') throw new Error('Pending requisition not found')
  if (!canWriteBranch(actor, request.sourceBranchId, getPrimaryAdminId(db))) throw new Error('You need branch posting access to fulfill this request')
  const before = { ...request, items: request.items.map((item) => ({ ...item })) }
  const transferEntries = []
  const transferBatches = []
  for (const item of request.items) {
    const sourceBatch = db.batches.find((batch) => batch.id === item.batchId)
    if (!sourceBatch) throw new Error('Source batch not found')
    if (item.quantity > getBatchAvailable(db, sourceBatch.id)) throw new Error('A requested batch no longer has enough stock')
    const destinationBatch = {
      ...sourceBatch,
      id: id('bat'),
      branchId: request.requestingBranchId,
      location: `Transfer from ${db.branches.find((branch) => branch.id === request.sourceBranchId)?.code || 'branch'}`,
    }
    const reference = `Requisition ${request.id}`
    transferBatches.push(destinationBatch)
    transferEntries.push({
      id: id('led'),
      medicineId: item.medicineId,
      batchId: sourceBatch.id,
      type: 'stock-out' as LedgerType,
      quantity: -item.quantity,
      reason: 'Internal requisition transfer',
      reference,
      userId: actorId,
      createdAt: nowIso(),
      fromBranchId: request.sourceBranchId,
      toBranchId: request.requestingBranchId,
    })
    transferEntries.push({
      id: id('led'),
      medicineId: item.medicineId,
      batchId: destinationBatch.id,
      type: 'stock-in' as LedgerType,
      quantity: item.quantity,
      reason: 'Internal requisition received',
      reference,
      userId: actorId,
      createdAt: nowIso(),
      fromBranchId: request.sourceBranchId,
      toBranchId: request.requestingBranchId,
    })
    item.fulfilledQuantity = item.quantity
  }
  db.batches.unshift(...transferBatches)
  db.ledger.unshift(...transferEntries)
  request.status = 'fulfilled'
  request.handledBy = actorId
  request.handledAt = nowIso()
  request.updatedAt = nowIso()
  addAudit(db, actorId, 'Fulfilled internal requisition', 'requisition', request.id, before, request)
}

function rejectRequisition(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const requestId = requireString(payload?.requestId, 'Requisition')
  const request = db.requisitions.find((item) => item.id === requestId)
  if (!request || request.status !== 'pending') throw new Error('Pending requisition not found')
  if (!canWriteBranch(actor, request.sourceBranchId, getPrimaryAdminId(db))) throw new Error('You need branch posting access to reject this request')
  const before = { ...request }
  request.status = 'rejected'
  request.handledBy = actorId
  request.handledAt = nowIso()
  request.updatedAt = nowIso()
  request.note = optionalString(payload?.note) || request.note
  addAudit(db, actorId, 'Rejected internal requisition', 'requisition', request.id, before, request)
}

function issueStock(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to issue stock')
  const medicineId = requireString(payload?.medicineId, 'Medicine')
  const branchId = optionalString(payload?.branchId) || db.branches.find((branch) => branch.active)?.id || 'main'
  if (!db.branches.some((branch) => branch.id === branchId && branch.active)) throw new Error('Active branch not found')
  if (!canWriteBranch(actor, branchId, getPrimaryAdminId(db))) throw new Error('You only have view access in this branch')
  const quantity = requireNumber(payload?.quantity, 'Quantity')
  if (quantity <= 0) throw new Error('Quantity must be greater than zero')
  const rows = db.batches
    .filter((batch) => batch.branchId === branchId && batch.medicineId === medicineId)
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
  if (!canWriteBranch(actor, batch.branchId, getPrimaryAdminId(db))) throw new Error('You only have view access in this branch')
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
  if (!actor || !canAdmin({ ...actor, role: actorRole }, getPrimaryAdminId(db))) throw new Error('Only the permanent admin can update settings')
  const before = { ...db.settings }
  db.settings = {
    pharmacyName: optionalString(payload?.pharmacyName) || db.settings.pharmacyName,
    softwareName: optionalString(payload?.softwareName) || db.settings.softwareName,
    accountName: optionalString(payload?.accountName) || db.settings.accountName,
    branchName: optionalString(payload?.branchName) || db.settings.branchName,
    primaryAdminId: db.settings.primaryAdminId || actorId,
    nearExpiryDays: Number(payload?.nearExpiryDays) || db.settings.nearExpiryDays,
    approvalThreshold: Number(payload?.approvalThreshold) || db.settings.approvalThreshold,
  }
  addAudit(db, actorId, 'Updated system settings', 'settings', 'main', before, db.settings)
}

function sendChatMessage(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const body = requireString(payload?.body, 'Message')
  if (body.length > 2000) throw new Error('Message is too long')
  const message = {
    id: id('msg'),
    userId: actorId,
    body,
    createdAt: nowIso(),
  }
  db.chatMessages.unshift(message)
  markChatRead(db, actorId)
}

function markChatRead(db: Database, actorId: string) {
  const actor = db.users.find((user) => user.id === actorId)
  if (actor) actor.lastChatSeenAt = nowIso()
}
