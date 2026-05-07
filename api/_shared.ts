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
  lastChatSeenAt?: string
  passwordHash?: string
  passwordSalt?: string
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
}

type ChatMessage = {
  id: string
  userId: string
  body: string
  createdAt: string
}

type Database = {
  users: User[]
  medicines: Medicine[]
  suppliers: Supplier[]
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
    pharmacyName: string
    branchName: string
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
    batches: [],
    ledger: [],
    receipts: [],
    chatMessages: [],
    auditLogs: [],
    settings: {
      pharmacyName: 'Pharmacy Inventory',
      branchName: 'Main Branch',
      nearExpiryDays: 90,
      approvalThreshold: 25000,
    },
  }
}

export type { ChatMessage, Database, HandlerRequest, HandlerResponse, LedgerType, Medicine, Role, Supplier, User }

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
  return {
    ...empty,
    ...raw,
    users: raw.users ?? empty.users,
    medicines: raw.medicines ?? empty.medicines,
    suppliers: raw.suppliers ?? empty.suppliers,
    batches: raw.batches ?? empty.batches,
    ledger: raw.ledger ?? empty.ledger,
    receipts: raw.receipts ?? empty.receipts,
    chatMessages: raw.chatMessages ?? empty.chatMessages,
    auditLogs: raw.auditLogs ?? empty.auditLogs,
    settings: {
      ...empty.settings,
      ...(raw.settings ?? {}),
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

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  const sql = getSql()
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at, last_seen_at) VALUES (${tokenHash}, ${userId}, ${expiresAt}, now())`
  return { token, expiresAt }
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

export function canWrite(user: User) {
  return user.role !== 'viewer'
}

export function canAdjust(user: User) {
  return user.role === 'admin' || user.role === 'pharmacist'
}

export function canAdmin(user: User) {
  return user.role === 'admin'
}

export function fail(res: HandlerResponse, status: number, message: string) {
  res.status(status).json({ error: message })
}
