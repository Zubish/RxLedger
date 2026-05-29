/// <reference types="node" />

import { neon } from '@neondatabase/serverless'
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

type Role = 'admin' | 'pharmacist' | 'inventory' | 'cashier' | 'viewer'
type UserStatus = 'pending' | 'active' | 'suspended'
type LedgerType = 'stock-in' | 'stock-out' | 'adjustment' | 'write-off' | 'supplier-return' | 'customer-return'
type SubscriptionPlanId = 'single-branch' | 'smart-pharmacy' | 'enterprise'
type PricingRoundingRule = 0 | 1 | 5 | 10 | 50 | 100

type User = {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  status: UserStatus
  branchIds: string[]
  managedBranchIds: string[]
  branchAccessExpiresAt?: Record<string, string>
  lastChatSeenAt?: string
  passwordHash?: string
  passwordSalt?: string
  knownDevices?: Array<{
    id: string
    label: string
    firstSeenAt: string
    lastSeenAt: string
  }>
  createdAt: string
  approvedAt?: string
  approvedBy?: string
}

type Medicine = {
  id: string
  sku: string
  brandName: string
  genericName: string
  form: string
  strength: string
  unit: string
  packSize: number
  sellableUnit: string
  costPrice: number
  sellingPrice: number
  category: string
  manufacturer: string
  nafdacNumber: string
  barcodes: string[]
  reorderLevel: number
  active: boolean
}

type Product = {
  id: string
  sku: string
  name: string
  category: string
  unit: string
  costPrice: number
  sellingPrice: number
  quantity: number
  barcodes: string[]
  supplierId: string
  active: boolean
  createdAt: string
}

type Supplier = {
  id: string
  name: string
  contact: string
  address: string
  licenseRef: string
  active: boolean
}

type Branch = {
  id: string
  name: string
  code: string
  address: string
  managerName: string
  managerUserId?: string
  phone: string
  active: boolean
  createdAt: string
}

type Batch = {
  id: string
  medicineId: string
  supplierId: string
  batchNumber: string
  expiryDate: string
  unitCost: number
  sellingPrice: number
  receivedDate: string
  location: string
  branchId: string
}

type LedgerEntry = {
  id: string
  itemType?: 'medicine' | 'product'
  medicineId: string
  productId?: string
  batchId: string
  batchNumber?: string
  expiryDate?: string
  unitCost?: number
  sellingPrice?: number
  location?: string
  type: LedgerType
  quantity: number
  reason: string
  reference: string
  userId: string
  createdAt: string
  fromBranchId?: string
  toBranchId?: string
}

type ChatMessage = {
  id: string
  userId: string
  channel?: 'group' | 'direct'
  recipientUserId?: string
  body: string
  createdAt: string
}

type PasswordResetRequest = {
  id: string
  userId: string
  email: string
  status: 'pending' | 'completed' | 'expired'
  requestedAt: string
  expiresAt: string
  emailSent?: boolean
  codeHash?: string
  resolvedAt?: string
}

type SecurityEventType = 'password-reset-requested' | 'password-reset-completed' | 'new-device-login' | 'panic-triggered' | 'security-email-failed'

type SecurityEvent = {
  id: string
  userId: string
  email: string
  type: SecurityEventType
  detail: string
  severity: 'info' | 'warning' | 'critical'
  createdAt: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}

type RequisitionStatus = 'pending' | 'released' | 'received' | 'fulfilled' | 'rejected' | 'cancelled'

type RequisitionItem = {
  id: string
  medicineId: string
  batchId: string
  quantity: number
  releasedQuantity?: number
  fulfilledQuantity?: number
  receivedQuantity?: number
  destinationBatchId?: string
}

type Requisition = {
  id: string
  requesterUserId: string
  requestingBranchId: string
  sourceBranchId: string
  status: RequisitionStatus
  items: RequisitionItem[]
  createdAt: string
  updatedAt: string
  releasedBy?: string
  releasedAt?: string
  receivedBy?: string
  receivedAt?: string
  handledBy?: string
  handledAt?: string
  note?: string
}

type Sale = {
  id: string
  branchId: string
  cashierUserId: string
  customerName: string
  customerPhone: string
  paymentMethod: 'cash' | 'card' | 'transfer' | 'mixed'
  reference: string
  note: string
  followUpMessage?: string
  soldAt: string
  subtotal: number
  discount: number
  total: number
  bookingCode?: string
  items: Array<{
    itemType: 'medicine' | 'product'
    medicineId: string
    productId?: string
    batchId?: string
    itemName?: string
    quantity: number
    unitPrice: number
    lineTotal: number
    daysSupply?: number
    refillDueAt?: string
    counselingNote?: string
    followUpMessage?: string
    labelInstruction?: string
  }>
}

type PosDraft = {
  id: string
  userId: string
  branchId: string
  bookingCode: string
  customerName: string
  customerPhone: string
  paymentMethod: Sale['paymentMethod']
  discount: number
  note: string
  followUpMessage?: string
  items: Array<{
    itemType: 'medicine' | 'product'
    itemId: string
    quantity: number
    daysSupply?: number
    counselingNote?: string
    labelInstruction?: string
  }>
  createdAt: string
  updatedAt: string
  expiresAt: string
}

type TenantRecord = {
  id: string
  name: string
  slug: string
  code: string
  businessLicense: string
  mainBranchAddress: string
  superAdminName: string
  superAdminEmail: string
  superAdminPhone: string
  createdAt: string
  workspace: Database
}

type RootState = {
  tenants: TenantRecord[]
  defaultSlug: string
}

type BranchAccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

type BranchAccessRequest = {
  id: string
  userId: string
  branchId: string
  status: BranchAccessRequestStatus
  requestedAt: string
  updatedAt: string
  resolvedBy?: string
  resolvedAt?: string
}

type Database = {
  users: User[]
  medicines: Medicine[]
  products: Product[]
  suppliers: Supplier[]
  branches: Branch[]
  batches: Batch[]
  ledger: LedgerEntry[]
  receipts: Array<{
    id: string
    supplierId: string
    invoiceRef: string
    receivedAt: string
    userId: string
    items: Array<{
      itemType?: 'medicine' | 'product'
      medicineId: string
      productId?: string
      batchId: string
      batchNumber?: string
      expiryDate?: string
      sellingPrice?: number
      location?: string
      branchId?: string
      quantity: number
      unitCost: number
    }>
  }>
  sales: Sale[]
  posDrafts: PosDraft[]
  chatMessages: ChatMessage[]
  passwordResetRequests: PasswordResetRequest[]
  securityEvents: SecurityEvent[]
  requisitions: Requisition[]
  branchAccessRequests: BranchAccessRequest[]
  auditLogs: Array<{
    id: string
    userId: string
    action: string
    entity: string
    entityId: string
    before?: unknown
    after?: unknown
    createdAt: string
  }>
  settings: {
    softwareName: string
    accountName: string
    pharmacyName: string
    branchName: string
    companySlug: string
    companyCode: string
    businessLicense: string
    mainBranchAddress: string
    logoDataUrl: string
    primaryAdminId?: string
    nearExpiryDays: number
    approvalThreshold: number
    autoPricingEnabled?: boolean
    globalMarkupPercent?: number
    pricingRoundingRule?: PricingRoundingRule
    categoryMarkupPercentages?: Record<string, number>
    productMarkupPercentages?: Record<string, number>
    cashierDiscountLimitPercent?: number
    managerDiscountLimitPercent?: number
    unusualMarkupPercent?: number
    costChangeWarningPercent?: number
    subscriptionPlanId?: SubscriptionPlanId
    trialStartedAt?: string
    trialEndsAt?: string
  }
}

type HandlerResponse = {
  status: (code: number) => HandlerResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
  end: () => void
}

type HandlerRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

const SESSION_DAYS = 14
const SESSION_IDLE_MINUTES = 30

export function createEmptyDatabase(): Database {
  return {
    users: [],
    medicines: [],
    products: [],
    suppliers: [],
    branches: [{
      id: 'main',
      name: 'Main Branch',
      code: 'MAIN',
      address: '',
      managerName: '',
      managerUserId: '',
      phone: '',
      active: true,
      createdAt: nowIso(),
    }],
    batches: [],
    ledger: [],
    receipts: [],
    sales: [],
    posDrafts: [],
    chatMessages: [],
    passwordResetRequests: [],
    securityEvents: [],
    requisitions: [],
    branchAccessRequests: [],
    auditLogs: [],
    settings: {
      softwareName: 'RxLedger',
      accountName: 'Pharmacy Account',
      pharmacyName: 'RxLedger',
      branchName: 'Main Branch',
      companySlug: '',
      companyCode: '',
      businessLicense: '',
      mainBranchAddress: '',
      logoDataUrl: '',
      nearExpiryDays: 90,
      approvalThreshold: 25000,
      autoPricingEnabled: false,
      globalMarkupPercent: 30,
      pricingRoundingRule: 10,
      categoryMarkupPercentages: {},
      productMarkupPercentages: {},
      cashierDiscountLimitPercent: 5,
      managerDiscountLimitPercent: 10,
      unusualMarkupPercent: 80,
      costChangeWarningPercent: 30,
      subscriptionPlanId: 'smart-pharmacy',
      trialStartedAt: nowIso(),
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
  }
}

export type { Branch, BranchAccessRequest, BranchAccessRequestStatus, ChatMessage, Database, HandlerRequest, HandlerResponse, LedgerType, Medicine, PasswordResetRequest, PosDraft, Product, Requisition, RequisitionItem, Role, Sale, SecurityEvent, SecurityEventType, Supplier, TenantRecord, User }

export function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
}

function createMedicineBarcode(existing: Set<string>) {
  let barcode: string
  do {
    barcode = `RXL${Math.floor(100000000000 + Math.random() * 900000000000)}`
  } while (existing.has(barcode.toLowerCase()))
  existing.add(barcode.toLowerCase())
  return barcode
}

export function nowIso() {
  return new Date().toISOString()
}

export function today() {
  return nowIso().slice(0, 10)
}

export function slugifyCompany(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function normalizeCompanySlug(value: string) {
  return slugifyCompany(value)
}

export function generateCompanyCode(name: string) {
  const prefix = slugifyCompany(name)
    .split('-')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 5) || 'RXL'
  return `${prefix}-${String(Math.floor(1000 + Math.random() * 9000))}`
}

export function getCompanySlugFromRequest(req: HandlerRequest) {
  const header = req.headers['x-rxledger-company']
  const raw = Array.isArray(header) ? header[0] : header
  return normalizeCompanySlug(raw || '')
}

export function daysUntil(date: string) {
  const todayDate = new Date(`${today()}T00:00:00`)
  const target = new Date(`${date}T00:00:00`)
  return Math.ceil((target.getTime() - todayDate.getTime()) / 86400000)
}

export function requireMethod(req: HandlerRequest, res: HandlerResponse, methods: string[]) {
  if (!req.method || !methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '))
    res.status(405).json({ error: 'Method not allowed' })
    return false
  }
  return true
}

export function getConnectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL
  if (!value) throw new Error('Missing DATABASE_URL or POSTGRES_URL environment variable')
  return value
}

export function getSql() {
  return neon(getConnectionString())
}

export async function ensureSchema() {
  const sql = getSql()
  await sql`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  await sql`
    INSERT INTO app_state (id, data)
    VALUES (1, ${JSON.stringify(createEmptyDatabase())}::jsonb)
    ON CONFLICT (id) DO NOTHING
  `
}

export async function loadDatabase() {
  const root = await loadRootState()
  const tenant = root.tenants.find((item) => item.slug === root.defaultSlug) || root.tenants[0]
  return normalizeDatabase(tenant?.workspace ?? createEmptyDatabase())
}

export async function saveDatabase(db: Database) {
  const root = await loadRootState()
  const slug = db.settings.companySlug || root.defaultSlug
  const existing = root.tenants.find((item) => item.slug === slug)
  if (existing) {
    existing.name = db.settings.accountName
    existing.businessLicense = db.settings.businessLicense
    existing.mainBranchAddress = db.settings.mainBranchAddress
    existing.workspace = normalizeDatabase(db)
  } else {
    root.tenants.unshift(createTenantRecord(db, slug || db.settings.accountName))
    root.defaultSlug = root.tenants[0].slug
  }
  await saveRootState(root)
}

export async function loadRootState() {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT data FROM app_state WHERE id = 1`
  return normalizeRootState(rows[0].data as Partial<RootState> | Partial<Database>)
}

export async function saveRootState(root: RootState) {
  const sql = getSql()
  await sql`
    UPDATE app_state
    SET data = ${JSON.stringify(normalizeRootState(root))}::jsonb,
        updated_at = now()
    WHERE id = 1
  `
}

export async function loadTenantDatabase(slug: string) {
  const root = await loadRootState()
  const normalizedSlug = normalizeCompanySlug(slug)
  const tenant = root.tenants.find((item) => item.slug === normalizedSlug)
  return tenant ? normalizeDatabase(tenant.workspace) : null
}

export async function saveTenantDatabase(slug: string, db: Database) {
  const root = await loadRootState()
  const normalizedSlug = normalizeCompanySlug(slug)
  const tenant = root.tenants.find((item) => item.slug === normalizedSlug)
  if (!tenant) throw new Error('Company portal not found')
  const clean = normalizeDatabase({
    ...db,
    settings: {
      ...db.settings,
      companySlug: normalizedSlug,
      companyCode: db.settings.companyCode || tenant.code,
      businessLicense: db.settings.businessLicense || tenant.businessLicense,
      mainBranchAddress: db.settings.mainBranchAddress || tenant.mainBranchAddress,
    },
  })
  tenant.name = clean.settings.accountName
  tenant.businessLicense = clean.settings.businessLicense
  tenant.mainBranchAddress = clean.settings.mainBranchAddress
  tenant.superAdminName = clean.users.find((user) => user.id === clean.settings.primaryAdminId)?.name || tenant.superAdminName
  tenant.superAdminEmail = clean.users.find((user) => user.id === clean.settings.primaryAdminId)?.email || tenant.superAdminEmail
  tenant.superAdminPhone = clean.users.find((user) => user.id === clean.settings.primaryAdminId)?.phone || tenant.superAdminPhone
  tenant.workspace = clean
  await saveRootState(root)
}

export function normalizeRootState(raw: Partial<RootState> | Partial<Database>): RootState {
  const candidate = raw as Partial<RootState>
  if (Array.isArray(candidate.tenants)) {
    const tenants = candidate.tenants.map((tenant) => {
      const workspace = normalizeDatabase(tenant.workspace ?? createEmptyDatabase())
      const baseSlug = normalizeCompanySlug(tenant.slug || workspace.settings.companySlug || workspace.settings.accountName) || id('company')
      const lowerName = `${tenant.name || ''} ${workspace.settings.accountName || ''}`.toLowerCase()
      const slug = lowerName.includes('totalenergies') ? 'totalenergies-pharmacy' : baseSlug
      workspace.settings.companySlug = slug
      workspace.settings.companyCode = tenant.code || workspace.settings.companyCode || generateCompanyCode(workspace.settings.accountName)
      workspace.settings.businessLicense = workspace.settings.businessLicense || tenant.businessLicense || ''
      workspace.settings.mainBranchAddress = workspace.settings.mainBranchAddress || tenant.mainBranchAddress || ''
      return {
        id: tenant.id || id('tenant'),
        name: tenant.name || workspace.settings.accountName,
        slug,
        code: workspace.settings.companyCode,
        businessLicense: tenant.businessLicense || workspace.settings.businessLicense,
        mainBranchAddress: tenant.mainBranchAddress || workspace.settings.mainBranchAddress,
        superAdminName: tenant.superAdminName || workspace.users.find((user) => user.id === workspace.settings.primaryAdminId)?.name || '',
        superAdminEmail: tenant.superAdminEmail || workspace.users.find((user) => user.id === workspace.settings.primaryAdminId)?.email || '',
        superAdminPhone: tenant.superAdminPhone || workspace.users.find((user) => user.id === workspace.settings.primaryAdminId)?.phone || '',
        createdAt: tenant.createdAt || nowIso(),
        workspace,
      }
    })
    return {
      tenants,
      defaultSlug: normalizeCompanySlug(candidate.defaultSlug || tenants[0]?.slug || ''),
    }
  }
  const database = normalizeDatabase(raw as Partial<Database>)
  const tenant = createTenantRecord(database, database.settings.companySlug || database.settings.accountName)
  const hasExistingWorkspace = Boolean(
    tenant.workspace.users.length ||
    tenant.workspace.medicines.length ||
    tenant.workspace.suppliers.length ||
    tenant.workspace.batches.length ||
    tenant.workspace.ledger.length ||
    tenant.workspace.sales.length ||
    ((raw as Partial<Database>).settings?.primaryAdminId),
  )
  return {
    tenants: hasExistingWorkspace ? [tenant] : [],
    defaultSlug: hasExistingWorkspace ? tenant.slug : '',
  }
}

export function createTenantRecord(db: Database, slugSource: string): TenantRecord {
  const workspace = normalizeDatabase(db)
  const slug = normalizeCompanySlug(slugSource || workspace.settings.accountName) || 'rxledger'
  const code = workspace.settings.companyCode || generateCompanyCode(workspace.settings.accountName)
  workspace.settings.companySlug = slug
  workspace.settings.companyCode = code
  const primaryAdmin = workspace.users.find((user) => user.id === workspace.settings.primaryAdminId)
  return {
    id: id('tenant'),
    name: workspace.settings.accountName,
    slug,
    code,
    businessLicense: workspace.settings.businessLicense || '',
    mainBranchAddress: workspace.settings.mainBranchAddress || '',
    superAdminName: primaryAdmin?.name || '',
    superAdminEmail: primaryAdmin?.email || '',
    superAdminPhone: primaryAdmin?.phone || '',
    createdAt: nowIso(),
    workspace,
  }
}

export function normalizeDatabase(raw: Partial<Database>): Database {
  const empty = createEmptyDatabase()
  const rawSettings = (raw.settings ?? {}) as Partial<Database['settings']>
  const accountName = rawSettings.accountName || rawSettings.pharmacyName || empty.settings.accountName
  const branchName = rawSettings.branchName || empty.settings.branchName
  const primaryAdminId = rawSettings.primaryAdminId || raw.users?.find((user) => user.role === 'admin' && user.status === 'active')?.id
  const branches = (raw.branches?.length ? raw.branches : [{
    ...empty.branches[0],
    name: branchName,
    code: branchName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'MAIN',
  }]).map((branch) => ({
    ...empty.branches[0],
    ...branch,
    id: branch.id || id('br'),
    name: branch.name || branchName,
    code: branch.code || branch.name?.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'MAIN',
    managerUserId: branch.managerUserId === primaryAdminId ? '' : branch.managerUserId || '',
    managerName: branch.managerUserId === primaryAdminId ? '' : branch.managerName || '',
    active: branch.active !== false,
  }))
  const users = (raw.users ?? empty.users).map((user) => {
    const isPrimaryAdmin = user.id === primaryAdminId
    const branchIds = isPrimaryAdmin ? [] : user.branchIds?.length ? user.branchIds : []
    const managedBranchIds = isPrimaryAdmin ? [] : user.managedBranchIds?.length ? user.managedBranchIds : []
    return {
      ...user,
      knownDevices: user.knownDevices ?? [],
      branchIds: Array.from(new Set(branchIds)),
      managedBranchIds: Array.from(new Set(managedBranchIds)),
      branchAccessExpiresAt: user.branchAccessExpiresAt ?? {},
    }
  })
  const existingMedicineBarcodes = new Set<string>()
  for (const product of raw.products ?? empty.products) {
    for (const barcode of product.barcodes ?? []) {
      existingMedicineBarcodes.add(String(barcode).toLowerCase())
    }
  }
  const medicines = (raw.medicines ?? empty.medicines).map((medicine) => {
    const barcodes = (medicine.barcodes ?? []).map(String).map((item) => item.trim()).filter(Boolean)
    if (!barcodes.length) barcodes.push(createMedicineBarcode(existingMedicineBarcodes))
    barcodes.forEach((barcode) => existingMedicineBarcodes.add(barcode.toLowerCase()))
    return {
      ...medicine,
      packSize: Number(medicine.packSize) > 0 ? Number(medicine.packSize) : 1,
      sellableUnit: medicine.sellableUnit || medicine.unit || 'Unit',
      costPrice: Number(medicine.costPrice) || 0,
      sellingPrice: Number(medicine.sellingPrice) || 0,
      barcodes,
    }
  })
  const sales = (raw.sales ?? empty.sales).map((sale) => {
    const subtotal = Number(sale.subtotal) || sale.items?.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0) || 0
    const discount = Number(sale.discount) || 0
    return {
      ...sale,
      subtotal,
      discount,
      total: Number(sale.total) || Math.max(0, subtotal - discount),
      followUpMessage: sale.followUpMessage || undefined,
      items: (sale.items ?? []).map((item) => ({
        itemType: item.itemType || 'medicine',
        medicineId: item.medicineId || '',
        productId: item.productId,
        batchId: item.batchId,
        itemName: item.itemName,
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
        lineTotal: Number(item.lineTotal) || 0,
        daysSupply: Number(item.daysSupply) || undefined,
        refillDueAt: item.refillDueAt || undefined,
        counselingNote: item.counselingNote || undefined,
        followUpMessage: item.followUpMessage || undefined,
        labelInstruction: item.labelInstruction || undefined,
      })),
    }
  })
  return {
    ...empty,
    ...raw,
    users,
    medicines,
    products: (raw.products ?? empty.products).map((product) => ({
      ...product,
      costPrice: Number(product.costPrice) || 0,
      sellingPrice: Number(product.sellingPrice) || 0,
      quantity: Number(product.quantity) || 0,
      barcodes: product.barcodes ?? [],
      createdAt: product.createdAt || nowIso(),
    })),
    suppliers: raw.suppliers ?? empty.suppliers,
    branches,
    batches: raw.batches ?? empty.batches,
    ledger: (raw.ledger ?? empty.ledger).map((entry) => ({
      ...entry,
      itemType: entry.itemType === 'product' ? 'product' : 'medicine',
      medicineId: entry.medicineId || '',
      productId: entry.productId || '',
      batchId: entry.batchId || '',
      quantity: Number(entry.quantity) || 0,
      unitCost: Number(entry.unitCost) || undefined,
      sellingPrice: Number(entry.sellingPrice) || undefined,
    })),
    receipts: (raw.receipts ?? empty.receipts).map((receipt) => ({
      ...receipt,
      items: (receipt.items ?? []).map((item) => ({
        ...item,
        itemType: item.itemType === 'product' ? 'product' : 'medicine',
        medicineId: item.medicineId || '',
        productId: item.productId || '',
        batchId: item.batchId || '',
        branchId: item.branchId || '',
        quantity: Number(item.quantity) || 0,
        unitCost: Number(item.unitCost) || 0,
        sellingPrice: Number(item.sellingPrice) || 0,
      })),
    })),
    sales,
    posDrafts: (raw.posDrafts ?? empty.posDrafts).filter((draft) => draft.expiresAt > nowIso()).map((draft) => ({
      ...draft,
      followUpMessage: draft.followUpMessage || undefined,
      items: (draft.items ?? []).map((item) => ({
        itemType: item.itemType === 'product' ? 'product' : 'medicine',
        itemId: item.itemId || '',
        quantity: Number(item.quantity) || 0,
        daysSupply: Number(item.daysSupply) || undefined,
        counselingNote: item.counselingNote || undefined,
        labelInstruction: item.labelInstruction || undefined,
      })),
    })),
    chatMessages: (raw.chatMessages ?? empty.chatMessages).map((message) => ({
      ...message,
      channel: message.channel === 'direct' ? 'direct' : 'group',
      recipientUserId: message.recipientUserId || '',
    })),
    passwordResetRequests: (raw.passwordResetRequests ?? empty.passwordResetRequests).map((request) => {
      const status = String(request.status)
      return {
        ...request,
        status: status === 'approved' || status === 'rejected' ? 'expired' : request.status,
        expiresAt: request.expiresAt ?? new Date(Date.now() - 1).toISOString(),
      }
    }),
    securityEvents: raw.securityEvents ?? empty.securityEvents,
    requisitions: (raw.requisitions ?? empty.requisitions).map((request) => ({
      ...request,
      items: (request.items ?? []).map((item) => ({
        ...item,
        releasedQuantity: item.releasedQuantity ?? item.fulfilledQuantity,
      })),
    })),
    branchAccessRequests: raw.branchAccessRequests ?? empty.branchAccessRequests,
    auditLogs: raw.auditLogs ?? empty.auditLogs,
    settings: {
      ...empty.settings,
      ...rawSettings,
      softwareName: rawSettings.softwareName || 'RxLedger',
      accountName,
      pharmacyName: rawSettings.pharmacyName || accountName,
      branchName,
      companySlug: normalizeCompanySlug(rawSettings.companySlug || accountName),
      companyCode: rawSettings.companyCode || '',
      businessLicense: rawSettings.businessLicense || '',
      mainBranchAddress: rawSettings.mainBranchAddress || '',
      logoDataUrl: rawSettings.logoDataUrl || '',
      primaryAdminId,
      subscriptionPlanId: rawSettings.subscriptionPlanId === 'single-branch' || rawSettings.subscriptionPlanId === 'enterprise' ? rawSettings.subscriptionPlanId : 'smart-pharmacy',
      trialStartedAt: rawSettings.trialStartedAt || empty.settings.trialStartedAt,
      trialEndsAt: rawSettings.trialEndsAt || empty.settings.trialEndsAt,
    },
  }
}

export function sanitizeDatabase(db: Database) {
  return {
    ...db,
    users: db.users.map((user) => {
      const clean = { ...user }
      delete clean.passwordHash
      delete clean.passwordSalt
      return clean
    }),
    passwordResetRequests: db.passwordResetRequests.map((request) => {
      const clean = { ...request }
      delete clean.codeHash
      return clean
    }),
  }
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex')
  return { salt, hash }
}

export function verifyPassword(password: string, user: User) {
  if (!user.passwordHash || !user.passwordSalt) return false
  const attempted = hashPassword(password, user.passwordSalt).hash
  const actualBuffer = Buffer.from(user.passwordHash, 'hex')
  const attemptedBuffer = Buffer.from(attempted, 'hex')
  return actualBuffer.length === attemptedBuffer.length && timingSafeEqual(actualBuffer, attemptedBuffer)
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function getRequestIp(req: HandlerRequest) {
  const forwarded = req.headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || ''
}

export function getRequestUserAgent(req: HandlerRequest) {
  const raw = req.headers['user-agent']
  return (Array.isArray(raw) ? raw[0] : raw) || ''
}

export function getDeviceId(req: HandlerRequest) {
  const userAgent = getRequestUserAgent(req)
  const ip = getRequestIp(req)
  return hashToken(`${userAgent}|${ip}`).slice(0, 16)
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  const sql = getSql()
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at) VALUES (${tokenHash}, ${userId}, ${expiresAt}, now())`
  return { token, expiresAt }
}

export async function deleteOtherSessions(userId: string, currentToken = '') {
  const sql = getSql()
  if (currentToken) {
    await sql`DELETE FROM sessions WHERE user_id = ${userId} AND token_hash <> ${hashToken(currentToken)}`
    return
  }
  await sql`DELETE FROM sessions WHERE user_id = ${userId}`
}

export async function deleteSession(token: string) {
  const sql = getSql()
  await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`
}

export function getBearerToken(req: HandlerRequest) {
  const raw = req.headers.authorization
  const header = Array.isArray(raw) ? raw[0] : raw
  if (!header?.startsWith('Bearer ')) return ''
  return header.slice('Bearer '.length)
}

export async function getAuthenticatedUser(req: HandlerRequest, db: Database) {
  const token = getBearerToken(req)
  if (!token) return null
  const sql = getSql()
  const tokenHash = hashToken(token)
  const idleCutoff = new Date(Date.now() - SESSION_IDLE_MINUTES * 60_000).toISOString()
  const rows = await sql`
    SELECT user_id
    FROM sessions
    WHERE token_hash = ${tokenHash}
      AND expires_at > now()
      AND last_seen_at > ${idleCutoff}
    LIMIT 1
  `
  const userId = rows[0]?.user_id as string | undefined
  if (!userId) {
    await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash}`
    return null
  }
  await sql`UPDATE sessions SET last_seen_at = now() WHERE token_hash = ${tokenHash}`
  return db.users.find((user) => user.id === userId && user.status === 'active') ?? null
}

export function addAudit(db: Database, userId: string, action: string, entity: string, entityId: string, before?: unknown, after?: unknown) {
  db.auditLogs.unshift({
    id: id('aud'),
    userId,
    action,
    entity,
    entityId,
    before,
    after,
    createdAt: nowIso(),
  })
}

export function addSecurityEvent(db: Database, event: Omit<SecurityEvent, 'id' | 'createdAt'> & { createdAt?: string }) {
  db.securityEvents.unshift({
    id: id('sec'),
    createdAt: event.createdAt ?? nowIso(),
    ...event,
  })
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_URL)
}

export async function sendSecurityEmail(to: string, subject: string, text: string) {
  if (!isEmailConfigured()) return { sent: false, reason: 'Email is not configured' }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    }),
  })
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(body || 'Unable to send security email')
  }
  return { sent: true }
}

export function canWrite(user: User) {
  return user.role === 'admin' || user.role === 'pharmacist' || user.role === 'inventory'
}

export function canAdjust(user: User) {
  return user.role === 'admin' || user.role === 'pharmacist'
}

export function canAdmin(user: User, primaryAdminId = '') {
  return user.role === 'admin' && (!primaryAdminId || user.id === primaryAdminId)
}

export function getBranchAccessExpiry(user: User, branchId: string) {
  return user.branchAccessExpiresAt?.[branchId] || ''
}

export function hasActiveBranchAssignment(user: User, branchId: string) {
  const assigned = user.branchIds.includes(branchId) || user.managedBranchIds.includes(branchId)
  if (!assigned) return false
  const expiresAt = getBranchAccessExpiry(user, branchId)
  return !expiresAt || expiresAt >= today()
}

export function canManageBranch(user: User, branchId: string, primaryAdminId = '') {
  return canAdmin(user, primaryAdminId) || (user.managedBranchIds.includes(branchId) && hasActiveBranchAssignment(user, branchId))
}

export function canWriteBranch(user: User, branchId: string, primaryAdminId = '') {
  return canAdmin(user, primaryAdminId) || (canWrite(user) && hasActiveBranchAssignment(user, branchId))
}

export function fail(res: HandlerResponse, status: number, message: string) {
  res.status(status).json({ error: message })
}
