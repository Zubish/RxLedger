/// <reference types="node" />

import { neon } from '@neondatabase/serverless'
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

type Role = 'admin' | 'pharmacist' | 'inventory' | 'viewer'
type UserStatus = 'pending' | 'active' | 'suspended'
type LedgerType = 'stock-in' | 'stock-out' | 'adjustment' | 'write-off' | 'supplier-return' | 'customer-return'

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
  category: string
  manufacturer: string
  nafdacNumber: string
  barcodes: string[]
  reorderLevel: number
  active: boolean
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
  medicineId: string
  batchId: string
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

type RequisitionStatus = 'pending' | 'fulfilled' | 'rejected' | 'cancelled'

type RequisitionItem = {
  id: string
  medicineId: string
  batchId: string
  quantity: number
  fulfilledQuantity?: number
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
  handledBy?: string
  handledAt?: string
  note?: string
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
    items: Array<{ medicineId: string; batchId: string; quantity: number; unitCost: number }>
  }>
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
    primaryAdminId?: string
    nearExpiryDays: number
    approvalThreshold: number
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
      nearExpiryDays: 90,
      approvalThreshold: 25000,
    },
  }
}

export type { Branch, BranchAccessRequest, BranchAccessRequestStatus, ChatMessage, Database, HandlerRequest, HandlerResponse, LedgerType, Medicine, PasswordResetRequest, Requisition, RequisitionItem, Role, SecurityEvent, SecurityEventType, Supplier, User }

export function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function today() {
  return nowIso().slice(0, 10)
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
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`SELECT data FROM app_state WHERE id = 1`
  return normalizeDatabase(rows[0].data as Partial<Database>)
}

export async function saveDatabase(db: Database) {
  const sql = getSql()
  await sql`
    UPDATE app_state
    SET data = ${JSON.stringify(db)}::jsonb,
        updated_at = now()
    WHERE id = 1
  `
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
  return {
    ...empty,
    ...raw,
    users,
    medicines: raw.medicines ?? empty.medicines,
    suppliers: raw.suppliers ?? empty.suppliers,
    branches,
    batches: raw.batches ?? empty.batches,
    ledger: raw.ledger ?? empty.ledger,
    receipts: raw.receipts ?? empty.receipts,
    chatMessages: raw.chatMessages ?? empty.chatMessages,
    passwordResetRequests: (raw.passwordResetRequests ?? empty.passwordResetRequests).map((request) => {
      const status = String(request.status)
      return {
        ...request,
        status: status === 'approved' || status === 'rejected' ? 'expired' : request.status,
        expiresAt: request.expiresAt ?? new Date(Date.now() - 1).toISOString(),
      }
    }),
    securityEvents: raw.securityEvents ?? empty.securityEvents,
    requisitions: raw.requisitions ?? empty.requisitions,
    branchAccessRequests: raw.branchAccessRequests ?? empty.branchAccessRequests,
    auditLogs: raw.auditLogs ?? empty.auditLogs,
    settings: {
      ...empty.settings,
      ...rawSettings,
      softwareName: rawSettings.softwareName || 'RxLedger',
      accountName,
      pharmacyName: rawSettings.pharmacyName || accountName,
      branchName,
      primaryAdminId,
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
  return user.role !== 'viewer'
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
