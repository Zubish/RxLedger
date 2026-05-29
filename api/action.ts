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
  getCompanySlugFromRequest,
  getRequestIp,
  getRequestUserAgent,
  hasActiveBranchAssignment,
  id,
  loadTenantDatabase,
  nowIso,
  requireMethod,
  sanitizeDatabase,
  saveTenantDatabase,
  sendSecurityEmail,
  today,
} from './_shared.js'
import type { Database, HandlerRequest, HandlerResponse, LedgerType, Medicine, PosDraft, Product, Role, Sale, Supplier, User } from './_shared.js'
import type { Branch } from './_shared.js'

type ActionBody = {
  action: string
  payload?: Record<string, unknown>
}

type SubscriptionPlanId = NonNullable<Database['settings']['subscriptionPlanId']>
type PricingRoundingRule = NonNullable<Database['settings']['pricingRoundingRule']>
const pricingRoundingRules: PricingRoundingRule[] = [0, 1, 5, 10, 50, 100]

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as ActionBody
    const companySlug = getCompanySlugFromRequest(req)
    if (!companySlug) {
      fail(res, 400, 'Choose a company portal before making changes')
      return
    }
    const db = await loadTenantDatabase(companySlug)
    if (!db) {
      fail(res, 404, 'Company portal not found')
      return
    }
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
      case 'upsertProduct':
        upsertProduct(db, actor.id, actor.role, body.payload)
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
      case 'receiveRequisition':
        receiveRequisition(db, actor.id, body.payload)
        break
      case 'rejectRequisition':
        rejectRequisition(db, actor.id, body.payload)
        break
      case 'issueStock':
        issueStock(db, actor.id, actor.role, body.payload)
        break
      case 'recordSale':
        recordSale(db, actor.id, actor.role, body.payload)
        break
      case 'savePosDraft':
        savePosDraft(db, actor.id, actor.role, body.payload)
        break
      case 'clearPosDraft':
        clearPosDraft(db, actor.id, body.payload)
        break
      case 'adjustStock':
        adjustStock(db, actor.id, actor.role, body.payload)
        break
      case 'updateSellingPrice':
        updateSellingPrice(db, actor.id, actor.role, body.payload)
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

    await saveTenantDatabase(companySlug, db)
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

function normalizeSubscriptionPlanId(value: unknown, fallback: SubscriptionPlanId): SubscriptionPlanId {
  return value === 'single-branch' || value === 'smart-pharmacy' || value === 'enterprise' ? value : fallback
}

function subscriptionPlanBlockers(db: Database, targetPlanId: SubscriptionPlanId) {
  if (targetPlanId === 'enterprise') return []
  const activeBranches = db.branches.filter((branch) => branch.active).length
  const activeStaff = db.users.filter((user) => user.status === 'active').length
  const branchLimit = targetPlanId === 'single-branch' ? 1 : 5
  const staffLimit = targetPlanId === 'single-branch' ? 5 : 25
  const planName = targetPlanId === 'single-branch' ? 'Single Branch' : 'Smart Pharmacy'
  const blockers: string[] = []
  if (activeBranches > branchLimit) blockers.push(`${planName} allows ${branchLimit} active branch${branchLimit === 1 ? '' : 'es'}.`)
  if (activeStaff > staffLimit) blockers.push(`${planName} allows up to ${staffLimit} active staff.`)
  return blockers
}

function requireNumber(value: unknown, label: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid number`)
  return parsed
}

function normalizeMarkupMap(value: unknown) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, amount]) => [key.trim().toLowerCase(), Math.max(0, Number(amount) || 0)])
    .filter(([key]) => key))
}

function pricingPolicy(settings: Database['settings']) {
  const roundingRule = pricingRoundingRules.includes(settings.pricingRoundingRule ?? 10) ? settings.pricingRoundingRule ?? 10 : 10
  return {
    enabled: Boolean(settings.autoPricingEnabled),
    globalMarkupPercent: Math.max(0, Number(settings.globalMarkupPercent) || 0),
    roundingRule,
    categoryMarkupPercentages: normalizeMarkupMap(settings.categoryMarkupPercentages),
    productMarkupPercentages: normalizeMarkupMap(settings.productMarkupPercentages),
    cashierDiscountLimitPercent: Math.max(0, Number(settings.cashierDiscountLimitPercent ?? 5) || 0),
    managerDiscountLimitPercent: Math.max(0, Number(settings.managerDiscountLimitPercent ?? 10) || 0),
  }
}

function roundSellingPrice(value: number, rule: PricingRoundingRule) {
  const price = Math.max(0, Number(value) || 0)
  if (!rule) return Math.round(price * 100) / 100
  return Math.ceil(price / rule) * rule
}

function productSpecificKeys(itemType: 'medicine' | 'product', item: Medicine | Product) {
  if (itemType === 'medicine') {
    const medicine = item as Medicine
    return [
      `${itemType}:${medicine.id}`,
      medicine.id,
      medicine.sku,
      medicine.brandName,
      medicine.genericName,
      medicine.nafdacNumber,
    ].map((key) => key.trim().toLowerCase()).filter(Boolean)
  }
  const product = item as Product
  return [
    `${itemType}:${product.id}`,
    product.id,
    product.sku,
    product.name,
  ].map((key) => key.trim().toLowerCase()).filter(Boolean)
}

function markupForItem(db: Database, itemType: 'medicine' | 'product', itemId: string) {
  const policy = pricingPolicy(db.settings)
  const item = itemType === 'medicine'
    ? db.medicines.find((medicine) => medicine.id === itemId)
    : db.products.find((product) => product.id === itemId)
  if (!item) return policy.globalMarkupPercent
  for (const key of productSpecificKeys(itemType, item)) {
    const value = policy.productMarkupPercentages[key]
    if (value !== undefined) return value
  }
  const category = item.category.trim().toLowerCase()
  if (category && policy.categoryMarkupPercentages[category] !== undefined) return policy.categoryMarkupPercentages[category]
  return policy.globalMarkupPercent
}

function calculatedSellingPrice(db: Database, itemType: 'medicine' | 'product', itemId: string, unitCost: number) {
  const policy = pricingPolicy(db.settings)
  const markupPercent = markupForItem(db, itemType, itemId)
  return roundSellingPrice(Math.max(0, unitCost) * (1 + markupPercent / 100), policy.roundingRule)
}

function discountLimitPercent(db: Database, actor: User) {
  if (canAdmin(actor, getPrimaryAdminId(db)) || actor.role === 'admin') return 100
  const policy = pricingPolicy(db.settings)
  if (db.branches.some((branch) => canManageBranch(actor, branch.id, getPrimaryAdminId(db)))) return policy.managerDiscountLimitPercent
  if (actor.role === 'pharmacist' || actor.role === 'inventory') return policy.managerDiscountLimitPercent
  if (actor.role === 'cashier') return policy.cashierDiscountLimitPercent
  return 0
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
  await deleteOtherSessions(actorId)
  actor.knownDevices = []
  addSecurityEvent(db, {
    userId: actor.id,
    email: actor.email,
    type: 'panic-triggered',
    severity: 'critical',
    detail: 'The user triggered Secure my account. All sessions were signed out and remembered browsers were cleared.',
    ipAddress: getRequestIp(req),
    userAgent: getRequestUserAgent(req),
  })
  addAudit(db, actorId, 'Triggered secure account panic action', 'user', actorId, undefined, { signedOutAllSessions: true, clearedRememberedBrowsers: true })
  try {
    await sendSecurityEmail(actor.email, 'RxLedger account security action triggered', 'Secure my account was triggered for your RxLedger account. All sessions were signed out and remembered browsers were cleared. If this was not you, reset your password immediately.')
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

function barcodeExists(db: Database, barcode: string, ownerId = '') {
  const needle = barcode.toLowerCase()
  return db.medicines.some((medicine) => medicine.id !== ownerId && medicine.barcodes.some((code) => code.toLowerCase() === needle))
    || db.products.some((product) => product.barcodes.some((code) => code.toLowerCase() === needle))
}

function generateMedicineBarcode(db: Database, ownerId: string) {
  let barcode: string
  do {
    barcode = `RXL${Math.floor(100000000000 + Math.random() * 900000000000)}`
  } while (barcodeExists(db, barcode, ownerId))
  return barcode
}

function canManageMedicinePrices(db: Database, actor: User, actorRole: Role, branchId?: string) {
  const primaryAdminId = getPrimaryAdminId(db)
  if (canAdmin(actor, primaryAdminId)) return true
  if (branchId && canManageBranch(actor, branchId, primaryAdminId)) return true
  return actorRole === 'inventory' && branchId ? hasActiveBranchAssignment(actor, branchId) : false
}

function upsertMedicine(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor || !canWrite({ ...actor, role: actorRole })) throw new Error('You do not have permission to save medicines')
  const record = normalizeMedicine((payload?.record ?? {}) as Partial<Medicine>)
  const branchId = optionalString(payload?.branchId)
  saveMedicineRecord(db, actorId, actor, actorRole, branchId, record)
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
      const normalizedBarcode = barcode.toLowerCase()
      const previous = seenBarcodes.get(normalizedBarcode)
      if (previous && previous !== record.id) throw new Error(`Barcode ${barcode} appears more than once in this import`)
      seenBarcodes.set(normalizedBarcode, record.id)
    }
  }
  const branchId = optionalString(payload?.branchId)
  records.forEach((record) => saveMedicineRecord(db, actorId, actor, actorRole, branchId, record))
  addAudit(db, actorId, `Bulk saved ${records.length} medicine records`, 'medicine', 'bulk', undefined, records.map((record) => record.id))
}

function normalizeMedicine(recordInput: Partial<Medicine>): Medicine {
  const barcodes = Array.isArray(recordInput.barcodes) ? recordInput.barcodes.map(String).map((item) => item.trim()).filter(Boolean) : []
  const costPrice = Number(recordInput.costPrice) || 0
  const sellingPrice = Number(recordInput.sellingPrice) || 0
  if (sellingPrice > 0 && sellingPrice < costPrice) throw new Error('Selling price must be equal to or greater than cost price')
  return {
    id: recordInput.id || id('med'),
    sku: requireString(recordInput.sku, 'SKU'),
    brandName: requireString(recordInput.brandName, 'Brand name'),
    genericName: requireString(recordInput.genericName, 'Generic name'),
    form: optionalString(recordInput.form) || 'Tablet',
    strength: optionalString(recordInput.strength),
    unit: optionalString(recordInput.unit) || 'Pack',
    packSize: Math.max(1, Number(recordInput.packSize) || 1),
    sellableUnit: optionalString(recordInput.sellableUnit) || optionalString(recordInput.unit) || 'Unit',
    costPrice,
    sellingPrice,
    category: optionalString(recordInput.category),
    manufacturer: optionalString(recordInput.manufacturer),
    nafdacNumber: optionalString(recordInput.nafdacNumber),
    barcodes,
    reorderLevel: Number(recordInput.reorderLevel) || 0,
    active: recordInput.active !== false,
  }
}

function saveMedicineRecord(db: Database, actorId: string, actor: User, actorRole: Role, branchId: string | undefined, record: Medicine) {
  const before = db.medicines.find((medicine) => medicine.id === record.id)
  const canSetPrices = canManageMedicinePrices(db, actor, actorRole, branchId)
  if (!canSetPrices) {
    record.costPrice = before?.costPrice ?? 0
    record.sellingPrice = before?.sellingPrice ?? 0
  }
  if (!record.barcodes.length) record.barcodes = [generateMedicineBarcode(db, record.id)]
  const recordBarcodes = new Set(record.barcodes.map((code) => code.toLowerCase()))
  const duplicateBarcode = db.medicines.find((medicine) => medicine.id !== record.id && medicine.barcodes.some((code) => recordBarcodes.has(code.toLowerCase())))
  if (duplicateBarcode) throw new Error(`Barcode already belongs to ${duplicateBarcode.brandName}`)
  const duplicateProductBarcode = db.products.find((product) => product.barcodes.some((code) => recordBarcodes.has(code.toLowerCase())))
  if (duplicateProductBarcode) throw new Error(`Barcode already belongs to ${duplicateProductBarcode.name}`)
  const duplicateSku = db.medicines.find((medicine) => medicine.id !== record.id && medicine.sku.toLowerCase() === record.sku.toLowerCase())
  if (duplicateSku) throw new Error(`SKU already belongs to ${duplicateSku.brandName}`)
  const identityKey = medicineDuplicateKey(record)
  const likelyDuplicate = db.medicines.find((medicine) => medicine.id !== record.id && medicineDuplicateKey(medicine) === identityKey)
  if (likelyDuplicate) throw new Error(`Likely duplicate medicine: ${likelyDuplicate.brandName} has the same generic, form, strength, and NAFDAC/brand identity`)
  db.medicines = before ? db.medicines.map((medicine) => (medicine.id === record.id ? record : medicine)) : [record, ...db.medicines]
  addAudit(db, actorId, before ? 'Updated medicine record' : 'Created medicine record', 'medicine', record.id, before, record)
}

function medicineDuplicateKey(medicine: Medicine) {
  return [
    medicine.brandName,
    medicine.genericName,
    medicine.form,
    medicine.strength,
    medicine.nafdacNumber || medicine.sku,
  ].map((part) => part.trim().toLowerCase()).join('|')
}

function upsertProduct(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  const productManager = actor && (canWrite({ ...actor, role: actorRole }) || actorRole === 'cashier' || canManageBranch(actor, actor.branchIds[0] || actor.managedBranchIds[0] || '', getPrimaryAdminId(db)))
  if (!actor || !productManager) throw new Error('You do not have permission to save products')
  const input = (payload?.record ?? {}) as Partial<Product>
  const costPrice = Number(input.costPrice) || 0
  const provisionalId = input.id || id('prd')
  const sellingPrice = pricingPolicy(db.settings).enabled
    ? roundSellingPrice(costPrice * (1 + pricingPolicy(db.settings).globalMarkupPercent / 100), pricingPolicy(db.settings).roundingRule)
    : Number(input.sellingPrice) || 0
  if (sellingPrice > 0 && sellingPrice < costPrice) throw new Error('Selling price must be equal to or greater than cost price')
  const barcodes = Array.isArray(input.barcodes) ? input.barcodes.map(String).map((item) => item.trim()).filter(Boolean) : []
  const record: Product = {
    id: provisionalId,
    sku: requireString(input.sku, 'SKU'),
    name: requireString(input.name, 'Product name'),
    category: optionalString(input.category) || 'General retail',
    unit: optionalString(input.unit) || 'Unit',
    costPrice,
    sellingPrice,
    quantity: Math.max(0, Number(input.quantity) || 0),
    barcodes,
    supplierId: optionalString(input.supplierId),
    active: input.active !== false,
    createdAt: input.createdAt || nowIso(),
  }
  const duplicateSku = db.products.find((product) => product.id !== record.id && product.sku.toLowerCase() === record.sku.toLowerCase())
  if (duplicateSku) throw new Error(`SKU already belongs to ${duplicateSku.name}`)
  const duplicateBarcode = db.products.find((product) => product.id !== record.id && product.barcodes.some((code) => record.barcodes.includes(code)))
  if (duplicateBarcode) throw new Error(`Barcode already belongs to ${duplicateBarcode.name}`)
  const before = db.products.find((product) => product.id === record.id)
  db.products = before ? db.products.map((product) => (product.id === record.id ? record : product)) : [record, ...db.products]
  addAudit(db, actorId, before ? 'Updated product record' : 'Created product record', 'product', record.id, before, record)
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
    if (manager.role === 'viewer' || manager.role === 'cashier') throw new Error('Cashiers and viewers cannot be branch managers')
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
        itemType: 'medicine',
        medicineId: payload?.medicineId,
        itemId: payload?.medicineId,
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
    items: [] as Database['receipts'][number]['items'],
  }
  const batches = []
  const ledgerEntries = []
  for (const input of inputs) {
    const itemType = input.itemType === 'product' ? 'product' : 'medicine'
    if (itemType === 'product') {
      const productId = requireString(input.productId || input.itemId, 'Product')
      const product = db.products.find((item) => item.id === productId && item.active)
      if (!product) throw new Error('Active product not found')
      const quantity = requireNumber(input.quantity, 'Quantity')
      if (quantity <= 0) throw new Error('Quantity must be greater than zero')
      const batchNumber = optionalString(input.batchNumber)
      const expiryDate = optionalString(input.expiryDate)
      if (expiryDate && expiryDate < today()) throw new Error('Expiry date must be today or a future date')
      const unitCost = Number(input.unitCost) || product.costPrice || 0
      const sellingPrice = pricingPolicy(db.settings).enabled
        ? calculatedSellingPrice(db, 'product', productId, unitCost)
        : Number(input.sellingPrice) || product.sellingPrice || 0
      if (sellingPrice > 0 && sellingPrice < unitCost) throw new Error('Selling price cannot be lower than unit cost')
      const beforeProduct = { ...product }
      product.quantity += quantity
      if (unitCost > 0) product.costPrice = unitCost
      if (sellingPrice > 0) product.sellingPrice = sellingPrice
      const location = optionalString(input.location) || 'Main Store'
      const ledger = {
        id: id('led'),
        itemType: 'product' as const,
        medicineId: '',
        productId,
        batchId: '',
        batchNumber,
        expiryDate,
        unitCost,
        sellingPrice,
        location,
        type: 'stock-in' as LedgerType,
        quantity,
        reason: 'Goods received',
        reference,
        userId: actorId,
        createdAt: nowIso(),
        toBranchId: branchId,
      }
      ledgerEntries.push(ledger)
      receipt.items.push({
        itemType: 'product',
        medicineId: '',
        productId,
        batchId: '',
        batchNumber,
        expiryDate,
        sellingPrice,
        location,
        branchId,
        quantity,
        unitCost,
      })
      addAudit(db, actorId, `Received product stock for ${product.name}`, 'product', productId, beforeProduct, { ...product, receivedQuantity: quantity, receipt: reference, batchNumber, expiryDate, location })
      continue
    }
    const medicineId = requireString(input.medicineId || input.itemId, 'Medicine')
    const medicine = db.medicines.find((item) => item.id === medicineId)
    if (!medicine) throw new Error('Medicine not found')
    const containerQuantity = requireNumber(input.quantity, 'Container quantity')
    if (containerQuantity <= 0) throw new Error('Container quantity must be greater than zero')
    const unitsPerContainer = Math.max(1, Number(medicine.packSize) || 1)
    const quantity = containerQuantity * unitsPerContainer
    const expiryDate = requireString(input.expiryDate, 'Expiry date')
    if (expiryDate < today()) throw new Error('Expiry date must be today or a future date')
    const containerCost = Number(input.unitCost) || (medicine.costPrice > 0 ? medicine.costPrice * unitsPerContainer : 0)
    const unitCost = containerCost > 0 ? containerCost / unitsPerContainer : medicine.costPrice || 0
    const sellingPrice = pricingPolicy(db.settings).enabled
      ? calculatedSellingPrice(db, 'medicine', medicineId, unitCost)
      : Number(input.sellingPrice) || medicine.sellingPrice || 0
    if (sellingPrice > 0 && sellingPrice < unitCost) throw new Error('Selling price cannot be lower than unit cost')
    const beforeMedicine = { ...medicine }
    if (unitCost > 0) medicine.costPrice = unitCost
    if (sellingPrice > 0) medicine.sellingPrice = sellingPrice
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
      itemType: 'medicine' as const,
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
    receipt.items.push({ itemType: 'medicine', medicineId, batchId: batch.id, quantity, unitCost: batch.unitCost, sellingPrice, location: batch.location, batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, branchId })
    if (unitCost > 0 || sellingPrice > 0) {
      addAudit(db, actorId, `Updated catalog pricing from receipt for ${medicine.brandName}`, 'medicine', medicineId, beforeMedicine, { costPrice: medicine.costPrice, sellingPrice: medicine.sellingPrice, receipt: reference })
    }
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
  const releaseInputs = Array.isArray(payload?.items) ? (payload.items as Record<string, unknown>[]) : []
  const releaseByItem = new Map(releaseInputs.map((input) => [
    requireString(input.itemId ?? input.id, 'Requisition item'),
    Math.max(0, requireNumber(input.quantity, 'Release quantity')),
  ]))
  const transferEntries = []
  const transferBatches = []
  let totalReleased = 0
  const reference = `Requisition ${request.id}`
  for (const item of request.items) {
    const sourceBatch = db.batches.find((batch) => batch.id === item.batchId)
    if (!sourceBatch) throw new Error('Source batch not found')
    const releaseQuantity = releaseByItem.has(item.id) ? releaseByItem.get(item.id) ?? 0 : item.quantity
    if (releaseQuantity > item.quantity) throw new Error('Release quantity cannot exceed requested quantity')
    if (releaseQuantity > getBatchAvailable(db, sourceBatch.id)) throw new Error('A requested batch no longer has enough stock')
    item.releasedQuantity = releaseQuantity
    item.fulfilledQuantity = releaseQuantity
    if (releaseQuantity <= 0) continue
    const destinationBatch = {
      ...sourceBatch,
      id: id('bat'),
      branchId: request.requestingBranchId,
      location: `Transfer from ${db.branches.find((branch) => branch.id === request.sourceBranchId)?.code || 'branch'}`,
    }
    item.destinationBatchId = destinationBatch.id
    transferBatches.push(destinationBatch)
    transferEntries.push({
      id: id('led'),
      medicineId: item.medicineId,
      batchId: sourceBatch.id,
      type: 'stock-out' as LedgerType,
      quantity: -releaseQuantity,
      reason: 'Internal requisition transfer',
      reference,
      userId: actorId,
      createdAt: nowIso(),
      fromBranchId: request.sourceBranchId,
      toBranchId: request.requestingBranchId,
    })
    totalReleased += releaseQuantity
  }
  if (totalReleased <= 0) throw new Error('Release at least one item quantity to fulfill this requisition')
  db.batches.unshift(...transferBatches)
  db.ledger.unshift(...transferEntries)
  request.status = 'released'
  request.releasedBy = actorId
  request.releasedAt = nowIso()
  request.handledBy = actorId
  request.handledAt = request.releasedAt
  request.updatedAt = nowIso()
  addAudit(db, actorId, 'Released internal requisition stock', 'requisition', request.id, before, request)
}

function receiveRequisition(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const requestId = requireString(payload?.requestId, 'Requisition')
  const request = db.requisitions.find((item) => item.id === requestId)
  if (!request || request.status !== 'released') throw new Error('Released requisition not found')
  if (!canWriteBranch(actor, request.requestingBranchId, getPrimaryAdminId(db))) throw new Error('You need branch posting access to receive this request')
  const before = { ...request, items: request.items.map((item) => ({ ...item })) }
  const receiveInputs = Array.isArray(payload?.items) ? (payload.items as Record<string, unknown>[]) : []
  const receiveByItem = new Map(receiveInputs.map((input) => [
    requireString(input.itemId ?? input.id, 'Requisition item'),
    Math.max(0, requireNumber(input.quantity, 'Received quantity')),
  ]))
  const receiptEntries = []
  let totalReceived = 0
  const reference = `Requisition ${request.id}`
  for (const item of request.items) {
    const releasedQuantity = item.releasedQuantity ?? item.fulfilledQuantity ?? 0
    const receivedQuantity = receiveByItem.has(item.id) ? receiveByItem.get(item.id) ?? 0 : releasedQuantity
    if (receivedQuantity > releasedQuantity) throw new Error('Received quantity cannot exceed released quantity')
    item.receivedQuantity = receivedQuantity
    if (receivedQuantity <= 0) continue
    const destinationBatchId = item.destinationBatchId
    if (!destinationBatchId || !db.batches.some((batch) => batch.id === destinationBatchId && batch.branchId === request.requestingBranchId)) {
      throw new Error('Destination batch for this requisition item was not found')
    }
    receiptEntries.push({
      id: id('led'),
      medicineId: item.medicineId,
      batchId: destinationBatchId,
      type: 'stock-in' as LedgerType,
      quantity: receivedQuantity,
      reason: 'Internal requisition received',
      reference,
      userId: actorId,
      createdAt: nowIso(),
      fromBranchId: request.sourceBranchId,
      toBranchId: request.requestingBranchId,
    })
    totalReceived += receivedQuantity
  }
  if (totalReceived <= 0) throw new Error('Receive at least one released item quantity')
  db.ledger.unshift(...receiptEntries)
  request.status = 'received'
  request.receivedBy = actorId
  request.receivedAt = nowIso()
  request.updatedAt = nowIso()
  addAudit(db, actorId, 'Received internal requisition stock', 'requisition', request.id, before, request)
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

function canSellInBranch(db: Database, actor: User, branchId: string) {
  return canAdmin(actor, getPrimaryAdminId(db)) || canManageBranch(actor, branchId, getPrimaryAdminId(db)) || ((actor.role === 'pharmacist' || actor.role === 'cashier') && hasActiveBranchAssignment(actor, branchId))
}

function canCompleteSaleInBranch(actor: User, branchId: string) {
  return actor.role === 'cashier' && hasActiveBranchAssignment(actor, branchId)
}

function receiptReference() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
  return `RXL-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function bookingCode() {
  return `BK-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function activeDraft(db: Database, userId: string, branchId: string) {
  const now = nowIso()
  db.posDrafts = db.posDrafts.filter((draft) => draft.expiresAt > now)
  return db.posDrafts.find((draft) => draft.userId === userId && draft.branchId === branchId)
}

function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function normalizeDraftItems(payload: unknown): PosDraft['items'] {
  if (!Array.isArray(payload)) return []
  return payload.map((item) => {
    const input = item as Record<string, unknown>
    const itemType: 'medicine' | 'product' = input.itemType === 'product' ? 'product' : 'medicine'
    const daysSupply = Math.max(0, Number(input.daysSupply) || 0)
    return {
      itemType,
      itemId: requireString(input.itemId, itemType === 'product' ? 'Product' : 'Medicine'),
      quantity: requireNumber(input.quantity, 'Quantity'),
      daysSupply: daysSupply || undefined,
      counselingNote: optionalString(input.counselingNote),
      labelInstruction: optionalString(input.labelInstruction),
    }
  }).filter((item) => item.quantity > 0)
}

function savePosDraft(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const branchId = requireString(payload?.branchId, 'Branch')
  if (!canSellInBranch(db, { ...actor, role: actorRole }, branchId)) throw new Error('You do not have permission to use POS in this branch')
  const items = normalizeDraftItems(payload?.items)
  if (!items.length) throw new Error('Add at least one item to save the POS cart')
  const existing = activeDraft(db, actorId, branchId)
  const now = nowIso()
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const draftDiscount = Math.max(0, Number(payload?.discount) || 0)
  const draft: PosDraft = {
    id: existing?.id || id('draft'),
    userId: actorId,
    branchId,
    bookingCode: existing?.bookingCode || bookingCode(),
    customerName: optionalString(payload?.customerName) || existing?.customerName || '',
    customerPhone: optionalString(payload?.customerPhone) || existing?.customerPhone || '',
    paymentMethod: (optionalString(payload?.paymentMethod) || existing?.paymentMethod || 'cash') as Sale['paymentMethod'],
    discount: draftDiscount,
    note: optionalString(payload?.note) || existing?.note || '',
    followUpMessage: optionalString(payload?.followUpMessage) || existing?.followUpMessage || '',
    items,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    expiresAt,
  }
  db.posDrafts = existing ? db.posDrafts.map((item) => item.id === existing.id ? draft : item) : [draft, ...db.posDrafts]
  addAudit(db, actorId, 'Saved POS draft cart', 'pos-draft', draft.id, existing, draft)
}

function clearPosDraft(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const branchId = requireString(payload?.branchId, 'Branch')
  const draftId = optionalString(payload?.draftId)
  const before = draftId
    ? db.posDrafts.find((draft) => draft.id === draftId && draft.branchId === branchId)
    : activeDraft(db, actorId, branchId)
  db.posDrafts = draftId
    ? db.posDrafts.filter((draft) => draft.id !== draftId)
    : db.posDrafts.filter((draft) => !(draft.userId === actorId && draft.branchId === branchId))
  if (before) addAudit(db, actorId, 'Cleared POS draft cart', 'pos-draft', before.id, before, undefined)
}

function recordSale(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const branchId = optionalString(payload?.branchId) || db.branches.find((branch) => branch.active)?.id || 'main'
  if (!db.branches.some((branch) => branch.id === branchId && branch.active)) throw new Error('Active branch not found')
  if (!canSellInBranch(db, { ...actor, role: actorRole }, branchId)) throw new Error('You do not have permission to sell in this branch')
  if (!canCompleteSaleInBranch({ ...actor, role: actorRole }, branchId)) throw new Error('Only cashiers can complete POS sales')
  const requestedDraftId = optionalString(payload?.draftId)
  const draft = requestedDraftId
    ? db.posDrafts.find((item) => item.id === requestedDraftId && item.branchId === branchId && item.expiresAt > nowIso())
    : activeDraft(db, actorId, branchId)
  const inputs = normalizeDraftItems(payload?.items ?? draft?.items)
  if (!inputs.length) throw new Error('Add at least one item to the POS cart')

  const saleItems: Sale['items'] = []
  const ledgerEntries = []
  for (const input of inputs) {
    const quantity = requireNumber(input.quantity, 'Quantity')
    if (quantity <= 0) throw new Error('Quantity must be greater than zero')
    if (input.itemType === 'product') {
      const product = db.products.find((item) => item.id === input.itemId && item.active)
      if (!product) throw new Error('Active product not found')
      if (quantity > product.quantity) throw new Error(`${product.name} does not have enough stock`)
      if (product.sellingPrice <= 0) throw new Error(`${product.name} needs a selling price before it can be sold`)
      product.quantity -= quantity
      saleItems.push({
        itemType: 'product',
        medicineId: '',
        productId: product.id,
        itemName: product.name,
        quantity,
        unitPrice: product.sellingPrice,
        lineTotal: quantity * product.sellingPrice,
        daysSupply: input.daysSupply,
        counselingNote: input.counselingNote,
        labelInstruction: input.labelInstruction,
      })
      ledgerEntries.push({
        id: id('led'),
        itemType: 'product' as const,
        medicineId: '',
        productId: product.id,
        batchId: '',
        unitCost: product.costPrice,
        sellingPrice: product.sellingPrice,
        type: 'stock-out' as LedgerType,
        quantity: -quantity,
        reason: 'POS sale',
        reference: optionalString(payload?.reference) || 'POS sale',
        userId: actorId,
        createdAt: nowIso(),
        fromBranchId: branchId,
      })
      continue
    }
    const medicineId = input.itemId
    const medicine = db.medicines.find((item) => item.id === medicineId && item.active)
    if (!medicine) throw new Error('Active medicine not found')
    const rows = db.batches
      .filter((batch) => batch.branchId === branchId && batch.medicineId === medicineId)
      .map((batch) => ({
        batch,
        quantity: getBatchAvailable(db, batch.id),
        daysToExpiry: daysUntil(batch.expiryDate),
      }))
      .filter((row) => row.quantity > 0 && row.daysToExpiry >= 0)
      .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))
    const total = rows.reduce((sum, row) => sum + row.quantity, 0)
    if (quantity > total) throw new Error(`${medicine.brandName} does not have enough non-expired stock in this branch`)
    let remaining = quantity
    for (const row of rows) {
      if (remaining <= 0) break
      const take = Math.min(row.quantity, remaining)
      const unitPrice = medicine.sellingPrice || row.batch.sellingPrice
      if (unitPrice <= 0) throw new Error(`${medicine.brandName} needs a selling price before it can be sold`)
      const lineTotal = take * unitPrice
      saleItems.push({
        itemType: 'medicine',
        medicineId,
        batchId: row.batch.id,
        itemName: medicine.brandName,
        quantity: take,
        unitPrice,
        lineTotal,
        daysSupply: input.daysSupply,
        refillDueAt: input.daysSupply ? addDays(nowIso(), input.daysSupply) : undefined,
        counselingNote: input.counselingNote,
        labelInstruction: input.labelInstruction,
      })
      ledgerEntries.push({
        id: id('led'),
        itemType: 'medicine' as const,
        medicineId,
        batchId: row.batch.id,
        type: 'stock-out' as LedgerType,
        quantity: -take,
        reason: 'POS sale',
        reference: optionalString(payload?.reference) || 'POS sale',
        userId: actorId,
        createdAt: nowIso(),
      })
      remaining -= take
    }
  }
  const subtotal = saleItems.reduce((sum, item) => sum + item.lineTotal, 0)
  const requestedDiscount = Math.min(Math.max(0, Number(payload?.discount ?? draft?.discount) || 0), subtotal)
  const maxDiscount = subtotal * (discountLimitPercent(db, { ...actor, role: actorRole }) / 100)
  if (requestedDiscount > maxDiscount) {
    throw new Error(`Discount exceeds your ${discountLimitPercent(db, { ...actor, role: actorRole })}% limit`)
  }
  const discount = requestedDiscount
  const reference = receiptReference()
  ledgerEntries.forEach((entry) => {
    if (entry.reason === 'POS sale') entry.reference = reference
  })

  const sale: Sale = {
    id: id('sale'),
    branchId,
    cashierUserId: actorId,
    customerName: optionalString(payload?.customerName) || draft?.customerName || '',
    customerPhone: optionalString(payload?.customerPhone) || draft?.customerPhone || '',
    paymentMethod: (optionalString(payload?.paymentMethod) || draft?.paymentMethod || 'cash') as Sale['paymentMethod'],
    reference,
    note: optionalString(payload?.note) || draft?.note || '',
    followUpMessage: optionalString(payload?.followUpMessage) || draft?.followUpMessage || '',
    soldAt: nowIso(),
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    bookingCode: draft?.bookingCode,
    items: saleItems,
  }
  db.ledger.unshift(...ledgerEntries)
  db.sales.unshift(sale)
  db.posDrafts = db.posDrafts.filter((item) => item.id !== draft?.id)
  addAudit(db, actorId, 'Completed POS sale', 'sale', sale.id, undefined, sale)
}

function updateSellingPrice(db: Database, actorId: string, actorRole: Role, payload: Record<string, unknown> | undefined) {
  const actor = db.users.find((user) => user.id === actorId)
  if (!actor) throw new Error('Authentication required')
  const medicineId = requireString(payload?.medicineId, 'Medicine')
  const branchId = requireString(payload?.branchId, 'Branch')
  const priceManager = canManageMedicinePrices(db, actor, actorRole, branchId)
  if (!priceManager) throw new Error('You do not have permission to update selling prices')
  const sellingPrice = requireNumber(payload?.sellingPrice, 'Selling price')
  const costPrice = Number(payload?.costPrice)
  const overrideReason = optionalString(payload?.overrideReason)
  if (pricingPolicy(db.settings).enabled && (!canAdmin(actor, getPrimaryAdminId(db)) || !overrideReason)) {
    throw new Error('Auto pricing is enabled. Only the permanent admin can override a selling price, and a reason is required.')
  }
  if (sellingPrice < 0) throw new Error('Selling price cannot be negative')
  if (!canAdmin(actor, getPrimaryAdminId(db)) && !hasActiveBranchAssignment(actor, branchId)) throw new Error('You do not have access to this branch')
  const medicine = db.medicines.find((item) => item.id === medicineId)
  if (!medicine) throw new Error('Medicine not found')
  const nextCostPrice = Number.isFinite(costPrice) ? Math.max(0, costPrice) : medicine.costPrice
  if (sellingPrice > 0 && sellingPrice < nextCostPrice) throw new Error('Selling price must be equal to or greater than cost price')
  const beforeMedicine = { ...medicine }
  medicine.costPrice = nextCostPrice
  medicine.sellingPrice = sellingPrice
  const batches = db.batches.filter((batch) => batch.branchId === branchId && batch.medicineId === medicineId && getBatchAvailable(db, batch.id) > 0)
  const before = batches.map((batch) => ({ id: batch.id, sellingPrice: batch.sellingPrice }))
  batches.forEach((batch) => {
    batch.sellingPrice = sellingPrice
    if (nextCostPrice > 0) batch.unitCost = nextCostPrice
  })
  addAudit(db, actorId, `Updated pricing for ${medicine.brandName}${overrideReason ? ` / Override: ${overrideReason}` : ''}`, 'medicine', medicineId, { medicine: beforeMedicine, batches: before }, { branchId, costPrice: nextCostPrice, sellingPrice, overrideReason: overrideReason || undefined })
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
  const currentPlanId = db.settings.subscriptionPlanId ?? 'smart-pharmacy'
  const subscriptionPlanId = normalizeSubscriptionPlanId(payload?.subscriptionPlanId, currentPlanId)
  const blockers = subscriptionPlanId === currentPlanId ? [] : subscriptionPlanBlockers(db, subscriptionPlanId)
  if (blockers.length) {
    throw new Error(`${blockers.join(' ')} No historical stock, sales, patient, branch, or audit data will be deleted; archive or deactivate extra usage before downgrading.`)
  }
  db.settings = {
    pharmacyName: optionalString(payload?.pharmacyName) || db.settings.pharmacyName,
    softwareName: optionalString(payload?.softwareName) || db.settings.softwareName,
    accountName: optionalString(payload?.accountName) || db.settings.accountName,
    branchName: optionalString(payload?.branchName) || db.settings.branchName,
    companySlug: db.settings.companySlug,
    companyCode: db.settings.companyCode,
    businessLicense: optionalString(payload?.businessLicense) || db.settings.businessLicense,
    mainBranchAddress: optionalString(payload?.mainBranchAddress) || db.settings.mainBranchAddress,
    logoDataUrl: optionalString(payload?.logoDataUrl),
    primaryAdminId: db.settings.primaryAdminId || actorId,
    nearExpiryDays: Number(payload?.nearExpiryDays) || db.settings.nearExpiryDays,
    approvalThreshold: Number(payload?.approvalThreshold) || db.settings.approvalThreshold,
    autoPricingEnabled: Boolean(payload?.autoPricingEnabled),
    globalMarkupPercent: Math.max(0, Number(payload?.globalMarkupPercent) || 0),
    pricingRoundingRule: pricingRoundingRules.includes(Number(payload?.pricingRoundingRule) as PricingRoundingRule) ? Number(payload?.pricingRoundingRule) as PricingRoundingRule : 10,
    categoryMarkupPercentages: normalizeMarkupMap(payload?.categoryMarkupPercentages),
    productMarkupPercentages: normalizeMarkupMap(payload?.productMarkupPercentages),
    cashierDiscountLimitPercent: Math.max(0, Math.min(100, Number(payload?.cashierDiscountLimitPercent ?? 5) || 0)),
    managerDiscountLimitPercent: Math.max(0, Math.min(100, Number(payload?.managerDiscountLimitPercent ?? 10) || 0)),
    unusualMarkupPercent: Math.max(0, Number(payload?.unusualMarkupPercent ?? 80) || 0),
    costChangeWarningPercent: Math.max(0, Number(payload?.costChangeWarningPercent ?? 30) || 0),
    subscriptionPlanId,
    trialStartedAt: db.settings.trialStartedAt,
    trialEndsAt: db.settings.trialEndsAt,
  }
  addAudit(db, actorId, 'Updated system settings', 'settings', 'main', before, db.settings)
}

function sendChatMessage(db: Database, actorId: string, payload: Record<string, unknown> | undefined) {
  const body = requireString(payload?.body, 'Message')
  if (body.length > 2000) throw new Error('Message is too long')
  const channel: 'group' | 'direct' = optionalString(payload?.channel) === 'direct' ? 'direct' : 'group'
  const recipientUserId = channel === 'direct' ? requireString(payload?.recipientUserId, 'Recipient') : ''
  if (channel === 'direct') {
    if (recipientUserId === actorId) throw new Error('Choose another employee for a direct message')
    const recipient = db.users.find((user) => user.id === recipientUserId && user.status === 'active')
    if (!recipient) throw new Error('Recipient not found or inactive')
  }
  const message = {
    id: id('msg'),
    userId: actorId,
    channel,
    recipientUserId,
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
