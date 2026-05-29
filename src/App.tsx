import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { readSheet } from 'read-excel-file/browser'
import {
  Activity,
  AlertTriangle,
  Archive,
  Barcode,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Minus,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Pill,
  Plus,
  Printer,
  RotateCcw,
  Save,
  ScanLine,
  Search,
  Send,
  Settings,
  Sparkles,
  ShoppingCart,
  ShieldCheck,
  Smartphone,
  StickyNote,
  Trash2,
  Truck,
  Trophy,
  Upload,
  UserCheck,
  UserPlus,
  User2,
  Users,
  Wallet,
  X,
  XCircle,
  Percent,
  Phone,
  CreditCard,
  Clock3,
} from 'lucide-react'
import {
  bootstrap,
  clearStoredToken,
  checkCompanySlug,
  getStoredToken,
  getStoredCompanySlug,
  loadState,
  login as apiLogin,
  logout as apiLogout,
  completePasswordReset as apiCompletePasswordReset,
  registerUser as apiRegisterUser,
  requestPasswordReset as apiRequestPasswordReset,
  resolveCompany,
  runAction,
  setupWorkspace,
  storeCompanySlug,
} from './api'
import RxLedgerLanding from './RxLedgerLanding'
import { planById, planChangeBlockers, subscriptionPlans, trialPolicy, type SubscriptionPlanId } from './subscriptionPlans'
import './App.css'

const SIDEBAR_WIDTH = 280

type Role = 'admin' | 'pharmacist' | 'inventory' | 'cashier' | 'viewer'
type UserStatus = 'pending' | 'active' | 'suspended'
type View =
  | 'dashboard'
  | 'medicines'
  | 'products'
  | 'suppliers'
  | 'receive'
  | 'pos'
  | 'patients'
  | 'issue'
  | 'adjust'
  | 'reports'
  | 'chat'
  | 'notifications'
  | 'audit'
  | 'users'
  | 'branches'
  | 'guide'
  | 'settings'

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

type LedgerType =
  | 'stock-in'
  | 'stock-out'
  | 'adjustment'
  | 'write-off'
  | 'supplier-return'
  | 'customer-return'
type PricingRoundingRule = 0 | 1 | 5 | 10 | 50 | 100

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

type Receipt = {
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

type AuditLog = {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string
  before?: unknown
  after?: unknown
  createdAt: string
}

type ChatMessage = {
  id: string
  userId: string
  channel?: 'group' | 'direct'
  recipientUserId?: string
  body: string
  createdAt: string
}

type QuestStep = {
  id: string
  title: string
  body: string
  view: View
  action: string
  roles?: Role[]
  superAdminOnly?: boolean
  branchManagerOnly?: boolean
}

type PasswordResetRequest = {
  id: string
  userId: string
  email: string
  status: 'pending' | 'completed' | 'expired'
  requestedAt: string
  expiresAt: string
  emailSent?: boolean
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

type AppSettings = {
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

type Database = {
  users: User[]
  medicines: Medicine[]
  products: Product[]
  suppliers: Supplier[]
  branches: Branch[]
  batches: Batch[]
  ledger: LedgerEntry[]
  receipts: Receipt[]
  sales: Sale[]
  posDrafts: PosDraft[]
  chatMessages: ChatMessage[]
  auditLogs: AuditLog[]
  passwordResetRequests: PasswordResetRequest[]
  securityEvents: SecurityEvent[]
  requisitions: Requisition[]
  branchAccessRequests: BranchAccessRequest[]
  settings: AppSettings
}

type StockRow = {
  batch: Batch
  medicine: Medicine
  supplier: Supplier | undefined
  branch: Branch | undefined
  quantity: number
  costValue: number
  daysToExpiry: number
  status: 'expired' | 'near-expiry' | 'ok'
}

type ReportRow = Record<string, string | number>
type AuthMode = 'login' | 'register' | 'reset' | 'setup'
type NotificationTone = 'danger' | 'warning' | 'info' | 'good'
type AppNotification = {
  id: string
  tone: NotificationTone
  title: string
  detail: string
  view: View
  branchId?: string
  audience?: 'branch' | 'super-admin'
  requiredPermission?: 'manage-branch'
  createdAt?: string
}

const views: Array<{ id: View; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'medicines', label: 'Pharmacy', icon: Pill },
  { id: 'products', label: 'Mart', icon: Boxes },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'receive', label: 'Receive', icon: PackagePlus },
  { id: 'pos', label: 'POS', icon: Calculator },
  { id: 'patients', label: 'Patients', icon: User2 },
  { id: 'issue', label: 'Issue Stock', icon: PackageMinus },
  { id: 'adjust', label: 'Adjust/Returns', icon: RotateCcw },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'chat', label: 'Team Chat', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit', label: 'Audit', icon: ShieldCheck },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  { id: 'branches', label: 'Branches', icon: Building2 },
  { id: 'guide', label: 'Guide', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
]

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  pharmacist: 'Pharmacist',
  inventory: 'Inventory Officer',
  cashier: 'Cashier',
  viewer: 'Viewer/Auditor',
}

const statusLabels: Record<UserStatus, string> = {
  pending: 'Pending approval',
  active: 'Active',
  suspended: 'Suspended',
}

const securityEventLabels: Record<SecurityEventType, string> = {
  'password-reset-requested': 'Password reset requested',
  'password-reset-completed': 'Password reset completed',
  'new-device-login': 'New device sign-in',
  'panic-triggered': 'Secure account triggered',
  'security-email-failed': 'Security email failed',
}

const movementLabels: Record<LedgerType, string> = {
  'stock-in': 'Stock In',
  'stock-out': 'Stock Out',
  adjustment: 'Adjustment',
  'write-off': 'Write-off',
  'supplier-return': 'Supplier Return',
  'customer-return': 'Customer Return',
}

const movementFilterOptions = [
  ...Object.entries(movementLabels).map(([value, label]) => ({ value, label })),
  { value: 'pos', label: 'POS' },
  { value: 'internal-transfer', label: 'Internal Transfer' },
]
const pricingRoundingRules: PricingRoundingRule[] = [0, 1, 5, 10, 50, 100]

const today = () => new Date().toISOString().slice(0, 10)
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
const number = new Intl.NumberFormat('en-NG')
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function slugifyCompany(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function getWorkspaceSlugFromLocation() {
  if (typeof window === 'undefined') return ''
  const [segment = ''] = window.location.pathname.split('/').filter(Boolean)
  if (!segment || segment === 'api') return ''
  return slugifyCompany(segment)
}

function daysUntil(date: string) {
  const todayDate = new Date(`${today()}T00:00:00`)
  const target = new Date(`${date}T00:00:00`)
  return Math.ceil((target.getTime() - todayDate.getTime()) / 86_400_000)
}

function compactNumber(value: number) {
  const absolute = Math.abs(value)
  const truncate = (amount: number, divisor: number) => (Math.trunc((amount / divisor) * 100) / 100).toFixed(2)
  if (absolute >= 1_000_000_000) return `${truncate(value, 1_000_000_000)}B`
  if (absolute >= 1_000_000) return `${truncate(value, 1_000_000)}M`
  if (absolute >= 100_000) return `${truncate(value, 1_000)}K`
  return number.format(value)
}

function compactMoney(value: number) {
  return `₦${compactNumber(value)}`
}

function numberInputValue(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric !== 0 ? numeric : ''
}

function safeStorageKey(db: Database, currentUser: User, suffix: string) {
  return `rxledger:${db.settings.companySlug || db.settings.companyCode || 'workspace'}:${currentUser.id}:${suffix}`
}

function getStoredNumber(key: string, fallback = 0) {
  if (typeof window === 'undefined') return fallback
  const value = Number(window.localStorage.getItem(key))
  return Number.isFinite(value) ? value : fallback
}

function getStoredBoolean(key: string) {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(key) === 'true'
}

function setStoredValue(key: string, value: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
}

function medicineMeta(medicine: Medicine) {
  return [medicine.genericName, medicine.form, medicine.strength].filter(Boolean).join(' / ') || 'No generic, form, or strength recorded'
}

function medicineOptionLabel(medicine: Medicine) {
  return [medicine.brandName, medicine.genericName, medicine.form, medicine.strength].filter(Boolean).join(' / ')
}

function medicineReportName(medicine?: Medicine) {
  return medicine ? medicine.brandName : 'Unknown'
}

function sellableUnitLabel(medicine: Medicine) {
  const unit = medicine.sellableUnit || medicine.unit || 'unit'
  const packSize = Number(medicine.packSize) || 1
  return packSize > 1 ? `${packSize} ${unit} per ${medicine.unit || 'pack'}` : unit
}

function medicineSellableUnit(medicine?: Medicine) {
  return medicine?.sellableUnit || medicine?.unit || 'unit'
}

function medicineContainerPackage(medicine?: Medicine) {
  return medicine?.unit || 'container'
}

function medicineUnitsPerContainer(medicine?: Medicine) {
  return Math.max(1, Number(medicine?.packSize) || 1)
}

function medicineStockLabel(medicine: Medicine, quantity: number) {
  return `${number.format(quantity)} ${medicineSellableUnit(medicine)}`
}

function medicineUnitCostFromContainerCost(medicine: Medicine | undefined, containerCost: number) {
  if (!medicine) return Math.max(0, Number(containerCost) || 0)
  const cost = Math.max(0, Number(containerCost) || 0)
  return cost > 0 ? cost / medicineUnitsPerContainer(medicine) : medicine.costPrice || 0
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

function normalizeMarkupMap(value: unknown) {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .map(([key, amount]) => [key.trim().toLowerCase(), Math.max(0, Number(amount) || 0)])
    .filter(([key]) => key))
}

function pricingPolicy(settings: AppSettings) {
  const roundingRule = pricingRoundingRules.includes(settings.pricingRoundingRule ?? 10) ? settings.pricingRoundingRule ?? 10 : 10
  return {
    enabled: Boolean(settings.autoPricingEnabled),
    globalMarkupPercent: Math.max(0, Number(settings.globalMarkupPercent) || 0),
    roundingRule,
    categoryMarkupPercentages: normalizeMarkupMap(settings.categoryMarkupPercentages),
    productMarkupPercentages: normalizeMarkupMap(settings.productMarkupPercentages),
    cashierDiscountLimitPercent: Math.max(0, Number(settings.cashierDiscountLimitPercent ?? 5) || 0),
    managerDiscountLimitPercent: Math.max(0, Number(settings.managerDiscountLimitPercent ?? 10) || 0),
    unusualMarkupPercent: Math.max(0, Number(settings.unusualMarkupPercent ?? 80) || 0),
    costChangeWarningPercent: Math.max(0, Number(settings.costChangeWarningPercent ?? 30) || 0),
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
  if (!item) return { percent: policy.globalMarkupPercent, source: 'Global markup' }
  for (const key of productSpecificKeys(itemType, item)) {
    const value = policy.productMarkupPercentages[key]
    if (value !== undefined) return { percent: value, source: 'Product override' }
  }
  const category = item.category.trim().toLowerCase()
  if (category && policy.categoryMarkupPercentages[category] !== undefined) {
    return { percent: policy.categoryMarkupPercentages[category], source: 'Category markup' }
  }
  return { percent: policy.globalMarkupPercent, source: 'Global markup' }
}

function calculatedSellingPrice(db: Database, itemType: 'medicine' | 'product', itemId: string, unitCost: number) {
  const policy = pricingPolicy(db.settings)
  const markup = markupForItem(db, itemType, itemId)
  const raw = Math.max(0, unitCost) * (1 + markup.percent / 100)
  return {
    price: roundSellingPrice(raw, policy.roundingRule),
    rawPrice: raw,
    markupPercent: markup.percent,
    source: markup.source,
  }
}

function discountLimitPercent(db: Database, user: User) {
  if (isSuperAdmin(db, user) || user.role === 'admin') return 100
  const policy = pricingPolicy(db.settings)
  if (db.branches.some((branch) => canManageBranch(db, user, branch.id))) return policy.managerDiscountLimitPercent
  if (user.role === 'pharmacist' || user.role === 'inventory') return policy.managerDiscountLimitPercent
  if (user.role === 'cashier') return policy.cashierDiscountLimitPercent
  return 0
}

function markupMapToText(map?: Record<string, number>) {
  return Object.entries(map ?? {}).map(([key, value]) => `${key} = ${value}`).join('\n')
}

function textToMarkupMap(value: string) {
  return Object.fromEntries(value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [key = '', amount = ''] = line.split(/[=:,]/)
      return [key.trim().toLowerCase(), Math.max(0, Number(amount.trim()) || 0)] as const
    })
    .filter(([key]) => key))
}

function MedicineIdentity({ medicine }: { medicine: Medicine }) {
  return (
    <span className="medicine-identity">
      <strong>{medicine.brandName}</strong>
      <span>{medicineMeta(medicine)}</span>
    </span>
  )
}

function BrandMark({ settings, size = 'normal' }: { settings: AppSettings; size?: 'normal' | 'large' }) {
  return (
    <div className={size === 'large' ? 'brand-mark large' : 'brand-mark'}>
      {settings.logoDataUrl ? <img src={settings.logoDataUrl} alt={`${settings.accountName} logo`} /> : <Pill size={size === 'large' ? 30 : 22} />}
    </div>
  )
}

function createEmptyDatabase(): Database {
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
      createdAt: new Date().toISOString(),
    }],
    batches: [],
    ledger: [],
    receipts: [],
    sales: [],
    posDrafts: [],
    chatMessages: [],
    auditLogs: [],
    passwordResetRequests: [],
    securityEvents: [],
    requisitions: [],
    branchAccessRequests: [],
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
      approvalThreshold: 25_000,
      autoPricingEnabled: false,
      globalMarkupPercent: 30,
      pricingRoundingRule: 10,
      categoryMarkupPercentages: {},
      productMarkupPercentages: {},
      cashierDiscountLimitPercent: 5,
      managerDiscountLimitPercent: 10,
      unusualMarkupPercent: 80,
      costChangeWarningPercent: 30,
      subscriptionPlanId: trialPolicy.includedPlan,
      trialStartedAt: new Date().toISOString(),
      trialEndsAt: new Date(Date.now() + trialPolicy.durationDays * 24 * 60 * 60 * 1000).toISOString(),
    },
  }
}

function getStockRows(db: Database): StockRow[] {
  return db.batches
    .map((batch) => {
      const medicine = db.medicines.find((item) => item.id === batch.medicineId)
      if (!medicine) return null
      const quantity = db.ledger
        .filter((entry) => entry.batchId === batch.id)
        .reduce((sum, entry) => sum + entry.quantity, 0)
      const days = daysUntil(batch.expiryDate)
      return {
        batch,
        medicine,
        supplier: db.suppliers.find((supplier) => supplier.id === batch.supplierId),
        branch: db.branches.find((branch) => branch.id === batch.branchId),
        quantity,
        costValue: quantity * batch.unitCost,
        daysToExpiry: days,
        status: days < 0 ? 'expired' : days <= db.settings.nearExpiryDays ? 'near-expiry' : 'ok',
      } satisfies StockRow
    })
    .filter((row): row is StockRow => Boolean(row))
    .sort((a, b) => a.medicine.brandName.localeCompare(b.medicine.brandName) || a.batch.expiryDate.localeCompare(b.batch.expiryDate))
}

function aggregateMedicineStock(rows: StockRow[]) {
  const totals = new Map<string, number>()
  rows.forEach((row) => {
    totals.set(row.medicine.id, (totals.get(row.medicine.id) ?? 0) + row.quantity)
  })
  return totals
}

function getMedicineSellingPrice(rows: StockRow[], medicineId: string) {
  const row = rows
    .filter((item) => item.medicine.id === medicineId && item.quantity > 0 && item.daysToExpiry >= 0)
    .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))[0]
  return row?.batch.sellingPrice ?? 0
}

function getActiveBranches(db: Database) {
  return db.branches.filter((branch) => branch.active)
}

function getBranchName(db: Database, branchId: string) {
  return db.branches.find((branch) => branch.id === branchId)?.name ?? db.settings.branchName
}

function getUserName(db: Database, userId?: string) {
  if (!userId) return 'Not recorded'
  return db.users.find((user) => user.id === userId)?.name ?? 'Unknown user'
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function addDaysToDate(dateIso: string, days: number) {
  const date = new Date(dateIso)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDate(value?: string) {
  if (!value) return 'Not set'
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString()
}

function patientDisplayName(sale: Sale) {
  return sale.customerName.trim() || (sale.customerPhone.trim() ? sale.customerPhone.trim() : 'Walk-in patient')
}

function getSaleItemLabel(db: Database, item: Sale['items'][number]) {
  if (item.itemName) return item.itemName
  if (item.itemType === 'product') return db.products.find((product) => product.id === item.productId)?.name || 'Retail item'
  return db.medicines.find((medicine) => medicine.id === item.medicineId)?.brandName || 'Medicine'
}

type MedicineCounselingRule = {
  keys: string[]
  label: string
  followUp: string
}

const medicineCounselingRules: MedicineCounselingRule[] = [
  {
    keys: ['cataflam', 'diclofenac', 'nsaid'],
    label: 'Take as prescribed, preferably with or after food. Avoid if you have stomach ulcer/bleeding, NSAID allergy, or were told to avoid painkillers after surgery. Contact the pharmacist if stomach pain, black stool, chest pain, swelling, or breathing trouble occurs.',
    followUp: 'Take Cataflam or diclofenac only as prescribed. Do not combine with other painkillers unless advised, and contact the pharmacy or your prescriber if you have ulcer symptoms, unusual bleeding, swelling, chest pain, or breathing difficulty.',
  },
  {
    keys: ['amoxicillin', 'augmentin', 'ciprofloxacin', 'azithromycin', 'antibiotic'],
    label: 'Take exactly as prescribed and complete the full course. Do not skip doses. Report rash, severe diarrhea, breathing difficulty, or swelling immediately.',
    followUp: 'Please complete the antibiotic course exactly as directed, even if you feel better. Contact the pharmacy if you develop rash, severe diarrhea, swelling, or breathing difficulty.',
  },
  {
    keys: ['metformin', 'diabet'],
    label: 'Take with meals unless otherwise directed. Do not skip meals. Monitor blood sugar as advised and report severe weakness, vomiting, or unusual breathing.',
    followUp: 'Remember to take your diabetes medicine with meals unless your prescriber advised differently. Keep monitoring your blood sugar and contact the pharmacy if you feel unwell.',
  },
  {
    keys: ['amlodipine', 'hypertension', 'blood pressure', 'bp'],
    label: 'Take at the same time daily. Do not stop suddenly unless your prescriber advises. Monitor blood pressure and report severe dizziness or swelling.',
    followUp: 'Please take your blood pressure medicine at the same time daily and keep monitoring your readings. Contact the pharmacy if you notice severe dizziness or swelling.',
  },
  {
    keys: ['paracetamol', 'acetaminophen', 'pcm'],
    label: 'Take only as directed. Do not exceed the recommended daily dose. Avoid combining with other paracetamol-containing products.',
    followUp: 'Use paracetamol only as directed and avoid taking it with other products that also contain paracetamol.',
  },
]

function medicineInstructionSource(medicine: Medicine) {
  return `${medicine.brandName} ${medicine.genericName} ${medicine.category} ${medicine.form}`.toLowerCase()
}

function medicineCounselingRule(medicine: Medicine) {
  const source = medicineInstructionSource(medicine)
  return medicineCounselingRules.find((rule) => rule.keys.some((key) => source.includes(key)))
}

function defaultLabelInstruction(db: Database, itemType: 'medicine' | 'product', itemId: string) {
  if (itemType === 'product') return ''
  const medicine = db.medicines.find((item) => item.id === itemId)
  if (!medicine) return ''
  const medicineName = [medicine.brandName, medicine.strength].filter(Boolean).join(' ')
  return medicineCounselingRule(medicine)?.label || `Take ${medicineName} exactly as prescribed. Contact the pharmacy if you notice unusual side effects.`
}

function medicineFollowUpInstruction(medicine: Medicine) {
  return medicineCounselingRule(medicine)?.followUp || `Take ${medicine.brandName} exactly as prescribed and contact the pharmacy if you notice unusual side effects.`
}

function buildPurchaseFollowUpMessage(db: Database, items: Array<{ itemType: 'medicine' | 'product'; itemId: string }>) {
  const medicineMessages = items
    .filter((item) => item.itemType === 'medicine')
    .map((item) => db.medicines.find((medicine) => medicine.id === item.itemId))
    .filter((medicine): medicine is Medicine => Boolean(medicine))
    .map((medicine) => medicineFollowUpInstruction(medicine))
  const uniqueMessages = Array.from(new Set(medicineMessages)).slice(0, 3)
  if (!uniqueMessages.length) return ''
  return `${uniqueMessages.join(' ')} Please follow the medication label and contact the pharmacy if you need clarification.`
}

function buildPatientProfiles(db: Database, branchId?: string) {
  const map = new Map<string, {
    key: string
    name: string
    phone: string
    sales: Sale[]
    totalSpent: number
    lastVisit: string
  }>()
  db.sales
    .filter((sale) => !branchId || sale.branchId === branchId)
    .forEach((sale) => {
      const phone = normalizePhone(sale.customerPhone)
      if (!phone) return
      const key = `phone:${phone}`
      const existing = map.get(key)
      const total = sale.total ?? sale.subtotal
      if (existing) {
        existing.sales.push(sale)
        existing.totalSpent += total
        if (sale.soldAt > existing.lastVisit) {
          existing.lastVisit = sale.soldAt
          existing.name = patientDisplayName(sale)
          existing.phone = sale.customerPhone || existing.phone
        }
        return
      }
      map.set(key, {
        key,
        name: patientDisplayName(sale),
        phone: sale.customerPhone,
        sales: [sale],
        totalSpent: total,
        lastVisit: sale.soldAt,
      })
    })
  return [...map.values()].map((profile) => ({
    ...profile,
    sales: profile.sales.sort((a, b) => b.soldAt.localeCompare(a.soldAt)),
  })).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit))
}

function buildRefillRows(db: Database, branchId?: string) {
  const latestByPatientMedicine = new Map<string, {
    profileKey: string
    patientName: string
    phone: string
    sale: Sale
    item: Sale['items'][number]
    medicineName: string
    refillDueAt: string
    daysUntilDue: number
  }>()
  const profiles = buildPatientProfiles(db, branchId)
  profiles.forEach((profile) => {
    profile.sales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (item.itemType !== 'medicine' || !item.medicineId || !item.daysSupply) return
        const refillDueAt = item.refillDueAt || addDaysToDate(sale.soldAt, item.daysSupply)
        const key = `${profile.key}:${item.medicineId}`
        const existing = latestByPatientMedicine.get(key)
        if (existing && existing.sale.soldAt >= sale.soldAt) return
        latestByPatientMedicine.set(key, {
          profileKey: profile.key,
          patientName: profile.name,
          phone: profile.phone,
          sale,
          item,
          medicineName: getSaleItemLabel(db, item),
          refillDueAt,
          daysUntilDue: daysUntil(refillDueAt),
        })
      })
    })
  })
  return [...latestByPatientMedicine.values()].sort((a, b) => a.refillDueAt.localeCompare(b.refillDueAt))
}

function patientCareMessage(pharmacyName: string, patientName: string, body: string) {
  const greeting = patientName && patientName !== 'Walk-in patient' ? `Hello ${patientName}, ` : 'Hello, '
  return `${greeting}${body} - ${pharmacyName}`
}

function refillMessage(pharmacyName: string, row: ReturnType<typeof buildRefillRows>[number]) {
  return patientCareMessage(
    pharmacyName,
    row.patientName,
    `your ${row.medicineName} may be due for refill ${row.daysUntilDue < 0 ? 'now' : row.daysUntilDue === 0 ? 'today' : `on ${formatDate(row.refillDueAt)}`}. Kindly visit or contact the pharmacy.`,
  )
}

function saleFollowUpBody(db: Database, sale: Sale) {
  if (sale.followUpMessage?.trim()) return sale.followUpMessage.trim()
  const legacyNotes = sale.items
    .filter((item) => item.itemType === 'medicine' && (item.followUpMessage || item.counselingNote))
    .map((item) => `${getSaleItemLabel(db, item)}: ${item.followUpMessage || item.counselingNote}`)
  return legacyNotes.join(' ')
}

function whatsappHref(phone: string, message: string) {
  const digits = normalizePhone(phone)
  const normalized = digits.startsWith('0') ? `234${digits.slice(1)}` : digits
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : ''
}

function getPrimaryAdminId(db: Database) {
  return db.settings.primaryAdminId || db.users.find((user) => user.role === 'admin' && user.status === 'active')?.id || ''
}

function isSuperAdmin(db: Database, user: User | null | undefined) {
  return Boolean(user && user.role === 'admin' && user.id === getPrimaryAdminId(db))
}

function getBranchAccessExpiry(user: User, branchId: string) {
  return user.branchAccessExpiresAt?.[branchId] || ''
}

function hasActiveBranchAssignment(user: User, branchId: string) {
  const assigned = user.branchIds.includes(branchId) || user.managedBranchIds.includes(branchId)
  if (!assigned) return false
  const expiresAt = getBranchAccessExpiry(user, branchId)
  return !expiresAt || expiresAt >= today()
}

function canManageBranch(db: Database, user: User, branchId: string) {
  return isSuperAdmin(db, user) || (user.managedBranchIds.includes(branchId) && hasActiveBranchAssignment(user, branchId))
}

function canWriteBranch(db: Database, user: User, branchId: string) {
  return isSuperAdmin(db, user) || ((user.role === 'admin' || user.role === 'pharmacist' || user.role === 'inventory') && hasActiveBranchAssignment(user, branchId))
}

function canViewBranch(db: Database, user: User, branchId: string) {
  return isSuperAdmin(db, user) || hasActiveBranchAssignment(user, branchId)
}

function getUserHomeBranch(db: Database, user: User | null | undefined) {
  const activeBranches = getActiveBranches(db)
  if (!user) return activeBranches[0] ?? db.branches[0]
  if (isSuperAdmin(db, user)) return undefined
  const activeManagedBranchIds = user.managedBranchIds.filter((branchId) => hasActiveBranchAssignment(user, branchId))
  const activeBranchIds = user.branchIds.filter((branchId) => hasActiveBranchAssignment(user, branchId))
  const homeId = activeManagedBranchIds[0] || activeBranchIds[0]
  return activeBranches.find((branch) => branch.id === homeId) ?? activeBranches[0] ?? db.branches[0]
}

function prioritizeAssignedBranch(branches: Branch[], assignedBranchId?: string) {
  if (!assignedBranchId) return branches
  return [...branches].sort((a, b) => {
    if (a.id === assignedBranchId) return -1
    if (b.id === assignedBranchId) return 1
    return a.name.localeCompare(b.name)
  })
}

function getUserBranchStatus(db: Database, user: User, branchId: string) {
  if (isSuperAdmin(db, user)) return 'Super admin'
  if (user.managedBranchIds.includes(branchId) && hasActiveBranchAssignment(user, branchId)) return 'Manager'
  if (user.branchIds.includes(branchId) && hasActiveBranchAssignment(user, branchId)) return 'Assigned'
  return 'View only'
}

function getUserHomeRoleLabel(db: Database, user: User, branchId?: string) {
  if (isSuperAdmin(db, user)) return 'Super admin'
  if (branchId && user.managedBranchIds.includes(branchId) && hasActiveBranchAssignment(user, branchId)) return 'Manager'
  return roleLabels[user.role]
}

function getOtherAssignedBranch(db: Database, user: User, branchId: string) {
  const otherId = [...user.managedBranchIds, ...user.branchIds].find((id) => id !== branchId && hasActiveBranchAssignment(user, id))
  return otherId ? db.branches.find((branch) => branch.id === otherId) : undefined
}

function findMedicineByScan(db: Database, scan: string) {
  const needle = scan.trim().toLowerCase()
  return db.medicines.find(
    (medicine) =>
      medicine.sku.toLowerCase() === needle ||
      medicine.nafdacNumber.toLowerCase() === needle ||
      medicine.barcodes.some((barcode) => barcode.toLowerCase() === needle),
  )
}

function findReceivableItem(db: Database, query: string): { itemType: 'medicine' | 'product'; itemId: string; label: string } | undefined {
  const needle = query.trim().toLowerCase()
  if (!needle) return undefined
  const medicineMatches = db.medicines
    .filter((medicine) => medicine.active)
    .map((medicine) => ({
      itemType: 'medicine' as const,
      itemId: medicine.id,
      label: medicineOptionLabel(medicine),
      exact: [medicine.sku, medicine.nafdacNumber, ...medicine.barcodes].some((value) => value.toLowerCase() === needle),
      text: `${medicine.sku} ${medicine.nafdacNumber} ${medicine.brandName} ${medicine.genericName} ${medicine.form} ${medicine.strength} ${medicine.category} ${medicine.barcodes.join(' ')}`.toLowerCase(),
    }))
  const productMatches = db.products
    .filter((product) => product.active)
    .map((product) => ({
      itemType: 'product' as const,
      itemId: product.id,
      label: product.name,
      exact: [product.sku, ...product.barcodes].some((value) => value.toLowerCase() === needle),
      text: `${product.sku} ${product.name} ${product.category} ${product.unit} ${product.barcodes.join(' ')}`.toLowerCase(),
    }))
  return [...medicineMatches, ...productMatches]
    .filter((item) => item.exact || item.text.includes(needle))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || a.label.localeCompare(b.label))[0]
}

function csvEscape(value: string | number) {
  const text = String(value)
  return text.includes(',') || text.includes('"') || text.includes('\n') ? `"${text.replaceAll('"', '""')}"` : text
}

function exportCsv(filename: string, rows: ReportRow[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? '')).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isNotificationVisible(db: Database, currentUser: User, notification: AppNotification, activeBranch?: Branch) {
  if (notification.audience === 'super-admin') return isSuperAdmin(db, currentUser)
  if (!notification.branchId) return true
  if (notification.requiredPermission === 'manage-branch' && !canManageBranch(db, currentUser, notification.branchId)) return false
  return activeBranch ? notification.branchId === activeBranch.id : true
}

function isChatMessageVisible(message: ChatMessage, currentUser: User) {
  if (message.channel === 'direct') {
    return message.userId === currentUser.id || message.recipientUserId === currentUser.id
  }
  return true
}

function getQuestSteps(db: Database, currentUser: User): QuestStep[] {
  const superAdmin = isSuperAdmin(db, currentUser)
  const managesBranch = db.branches.some((branch) => canManageBranch(db, currentUser, branch.id))
  const baseSteps: QuestStep[] = [
    {
      id: 'branch-switcher',
      title: 'Choose your working branch',
      body: 'Open the branch selector at the top right and switch to a branch/site so the dashboard reflects the workspace you are testing.',
      view: 'dashboard',
      action: 'Open dashboard',
    },
    {
      id: 'chat',
      title: 'Send a message',
      body: 'Open Messages and try the group chat. If another staff account exists, switch to Direct message and send a private note.',
      view: 'chat',
      action: 'Open messages',
    },
  ]
  const roleSteps: QuestStep[] = [
    {
      id: 'pos-open',
      title: 'Run a POS test sale',
      body: 'Open POS, search for an in-stock Pharmacy or Mart item, add it to the cart, then save it as a draft or complete it if you are the cashier.',
      view: 'pos',
      action: 'Open POS',
      roles: ['cashier', 'pharmacist'],
    },
    {
      id: 'sales-history',
      title: 'Review sale history',
      body: 'Use the history button on POS to filter sales by period and print the reconciliation summary for the beta test.',
      view: 'pos',
      action: 'Open POS history',
      roles: ['cashier'],
    },
    {
      id: 'receive-stock',
      title: 'Receive stock',
      body: 'Open Receive, search by name, SKU, or barcode, then confirm that Pharmacy and Mart receiving flows work as expected.',
      view: 'receive',
      action: 'Open Receive',
      roles: ['inventory', 'pharmacist', 'admin'],
    },
    {
      id: 'pharmacy-price',
      title: 'Check Pharmacy prices',
      body: 'Open Pharmacy and confirm cost price, selling price, barcode, and stock display look correct for medicines.',
      view: 'medicines',
      action: 'Open Pharmacy',
      roles: ['inventory', 'pharmacist', 'admin'],
    },
    {
      id: 'mart-products',
      title: 'Check Mart products',
      body: 'Open Mart and confirm non-medicinal products, quantities, prices, and barcode/SKU records are beta-ready.',
      view: 'products',
      action: 'Open Mart',
      roles: ['inventory', 'cashier', 'admin'],
    },
    {
      id: 'requisition',
      title: 'Test internal requisition',
      body: 'From Pharmacy, review requisitions and confirm requesting, fulfilling, and receiving between branches is clear.',
      view: 'medicines',
      action: 'Open Pharmacy',
      roles: ['inventory', 'pharmacist', 'admin'],
    },
    {
      id: 'branch-access',
      title: 'Review branch staff access',
      body: 'Open Branches and Sites, select a branch, then review the staff access section underneath the branch cards.',
      view: 'branches',
      action: 'Open branches',
      branchManagerOnly: true,
    },
    {
      id: 'reports',
      title: 'Export a report',
      body: 'Open Reports, switch between Pharmacy and Mart, filter stock or movement, then export CSV or Print/PDF.',
      view: 'reports',
      action: 'Open Reports',
    },
    {
      id: 'settings-logo',
      title: 'Confirm workspace identity',
      body: 'Open Settings and verify the company logo, account name, and operational thresholds are correct.',
      view: 'settings',
      action: 'Open Settings',
      superAdminOnly: true,
    },
    {
      id: 'users',
      title: 'Review user access',
      body: 'Open Users and confirm pending users, active roles, and security events are ready for beta oversight.',
      view: 'users',
      action: 'Open Users',
      superAdminOnly: true,
    },
    {
      id: 'audit',
      title: 'Inspect the audit trail',
      body: 'Open Audit to confirm the app is recording important changes with actor, entity, and timestamp.',
      view: 'audit',
      action: 'Open Audit',
      roles: ['viewer', 'admin'],
    },
  ]
  return [...baseSteps, ...roleSteps].filter((step) => {
    if (step.superAdminOnly && !superAdmin) return false
    if (step.branchManagerOnly && !managesBranch && !superAdmin) return false
    if (step.roles && !step.roles.includes(currentUser.role) && !superAdmin) return false
    return true
  })
}

function buildNotifications(db: Database, stockRows: StockRow[], stockTotals: Map<string, number>, currentUser: User, activeBranch?: Branch): AppNotification[] {
  const notifications: AppNotification[] = []
  const lastChatSeen = currentUser.lastChatSeenAt ? new Date(currentUser.lastChatSeenAt).getTime() : 0
  const unreadChat = db.chatMessages.filter((message) => isChatMessageVisible(message, currentUser) && message.userId !== currentUser.id && new Date(message.createdAt).getTime() > lastChatSeen)
  const pendingUsers = db.users.filter((user) => user.status === 'pending')
  const relevantRequisitions = db.requisitions.filter((request) => (
    isSuperAdmin(db, currentUser) ||
    request.requesterUserId === currentUser.id ||
    canViewBranch(db, currentUser, request.sourceBranchId) ||
    canViewBranch(db, currentUser, request.requestingBranchId)
  ))
  const incomingRequisitions = relevantRequisitions.filter((request) => request.status === 'pending')
  const releasedRequisitions = relevantRequisitions.filter((request) => request.status === 'released' && canViewBranch(db, currentUser, request.requestingBranchId))
  const handledRequisitions = relevantRequisitions.filter((request) => request.requesterUserId === currentUser.id && request.status !== 'pending')
  const branchAccessRequests = db.branchAccessRequests.filter((request) => request.status === 'pending' && canViewBranch(db, currentUser, request.branchId))
  const scopedMedicineIds = new Set(stockRows.map((row) => row.medicine.id))
  const expired = stockRows.filter((row) => row.quantity > 0 && row.status === 'expired')
  const nearExpiry = stockRows.filter((row) => row.quantity > 0 && row.status === 'near-expiry')
  const lowStock = db.medicines.filter((medicine) => scopedMedicineIds.has(medicine.id) && (stockTotals.get(medicine.id) ?? 0) > 0 && (stockTotals.get(medicine.id) ?? 0) <= medicine.reorderLevel)
  const outOfStock = db.medicines.filter((medicine) => scopedMedicineIds.has(medicine.id) && (stockTotals.get(medicine.id) ?? 0) <= 0)

  if (unreadChat.length) {
    notifications.push({
      id: 'chat-unread',
      tone: 'info',
      title: `${unreadChat.length} unread team message${unreadChat.length > 1 ? 's' : ''}`,
      detail: `Latest from ${db.users.find((user) => user.id === unreadChat[0].userId)?.name ?? 'a team member'}.`,
      view: 'chat',
      createdAt: unreadChat[0].createdAt,
    })
  }

  if (isSuperAdmin(db, currentUser)) {
    pendingUsers.forEach((user) => {
      notifications.push({
        id: `pending-${user.id}`,
        tone: 'warning',
        title: `${user.name} is waiting for access`,
        detail: 'Admin should assign the correct role and activate the account.',
        view: 'users',
        audience: 'super-admin',
        createdAt: user.createdAt,
      })
    })
  }

  incomingRequisitions.forEach((request) => {
    const viewingSourceBranch = activeBranch?.id === request.sourceBranchId
    const sourceBranch = getBranchName(db, request.sourceBranchId)
    const requestingBranch = getBranchName(db, request.requestingBranchId)
    notifications.push({
      id: `incoming-requisition-${request.id}`,
      tone: 'info',
      title: viewingSourceBranch ? `Medicine request from ${requestingBranch}` : `Medicine request to ${sourceBranch}`,
      detail: viewingSourceBranch
        ? `${request.items.length} item${request.items.length === 1 ? '' : 's'} requested from this branch.`
        : `${request.items.length} item${request.items.length === 1 ? '' : 's'} awaiting ${sourceBranch}.`,
      view: 'medicines',
      branchId: activeBranch?.id === request.requestingBranchId ? request.requestingBranchId : request.sourceBranchId,
      createdAt: request.createdAt,
    })
  })

  releasedRequisitions.forEach((request) => {
    notifications.push({
      id: `released-requisition-${request.id}`,
      tone: 'info',
      title: `Stock released by ${getBranchName(db, request.sourceBranchId)}`,
      detail: `${request.items.length} item${request.items.length === 1 ? '' : 's'} awaiting receipt confirmation.`,
      view: 'medicines',
      branchId: request.requestingBranchId,
      createdAt: request.updatedAt,
    })
  })

  branchAccessRequests.forEach((request) => {
    const user = db.users.find((item) => item.id === request.userId)
    notifications.push({
      id: `branch-access-${request.id}`,
      tone: 'info',
      title: `${user?.name ?? 'Staff member'} requested branch access`,
      detail: `${getBranchName(db, request.branchId)} access can be granted when the staff member is free.`,
      view: 'branches',
      branchId: request.branchId,
      requiredPermission: 'manage-branch',
      createdAt: request.requestedAt,
    })
  })

  handledRequisitions.forEach((request) => {
    notifications.push({
      id: `handled-requisition-${request.id}`,
      tone: request.status === 'received' || request.status === 'fulfilled' ? 'good' : request.status === 'released' ? 'info' : 'warning',
      title: `Your requisition is ${request.status === 'released' ? 'awaiting receipt' : request.status}`,
      detail: `${getBranchName(db, request.sourceBranchId)} responded to your request.`,
      view: 'medicines',
      branchId: request.requestingBranchId,
      createdAt: request.updatedAt,
    })
  })

  expired.forEach((row) => {
    notifications.push({
      id: `expired-${row.batch.id}`,
      tone: 'danger',
      title: `${medicineOptionLabel(row.medicine)} has expired stock`,
      detail: `${getBranchName(db, row.batch.branchId)} / ${row.batch.batchNumber} has ${medicineStockLabel(row.medicine, row.quantity)} in ${row.batch.location}.`,
      view: 'reports',
      branchId: row.batch.branchId,
    })
  })

  nearExpiry.slice(0, 12).forEach((row) => {
    notifications.push({
      id: `near-${row.batch.id}`,
      tone: 'warning',
      title: `${medicineOptionLabel(row.medicine)} expires in ${row.daysToExpiry} days`,
      detail: `${getBranchName(db, row.batch.branchId)} / ${row.batch.batchNumber}, ${medicineStockLabel(row.medicine, row.quantity)} available.`,
      view: 'reports',
      branchId: row.batch.branchId,
    })
  })

  outOfStock.forEach((medicine) => {
    notifications.push({
      id: `out-${medicine.id}`,
      tone: 'danger',
      title: `${medicineOptionLabel(medicine)} is out of stock`,
      detail: `${activeBranch?.name ?? 'Current branch'} / reorder level is ${medicineStockLabel(medicine, medicine.reorderLevel)}.`,
      view: 'medicines',
      branchId: activeBranch?.id,
    })
  })

  lowStock
    .filter((medicine) => (stockTotals.get(medicine.id) ?? 0) > 0)
    .forEach((medicine) => {
      notifications.push({
        id: `low-${medicine.id}`,
        tone: 'info',
        title: `${medicineOptionLabel(medicine)} is low on stock`,
        detail: `${activeBranch?.name ?? 'Current branch'} / available: ${medicineStockLabel(medicine, stockTotals.get(medicine.id) ?? 0)}. Reorder level: ${medicineStockLabel(medicine, medicine.reorderLevel)}.`,
        view: 'medicines',
        branchId: activeBranch?.id,
      })
    })

  return notifications
    .filter((notification) => isNotificationVisible(db, currentUser, notification, activeBranch))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

type ExecuteAction = (action: string, payload: Record<string, unknown>, successMessage?: string) => Promise<boolean>

function App() {
  const [db, setDb] = useState<Database>(createEmptyDatabase)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [hasUsers, setHasUsers] = useState(false)
  const [tenantExists, setTenantExists] = useState(false)
  const [companySlug, setCompanySlug] = useState(() => getWorkspaceSlugFromLocation() || getStoredCompanySlug())
  const [authIntent, setAuthIntent] = useState<'landing' | 'setup' | 'signin'>('landing')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [drawerHandleTop, setDrawerHandleTop] = useState(() => typeof window === 'undefined' ? 360 : Math.round(window.innerHeight / 2))
  const [drawerHandleDragging, setDrawerHandleDragging] = useState(false)
  const [activeBranchId, setActiveBranchId] = useState('main')
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  const [branchSwitching, setBranchSwitching] = useState(false)
  const [branchSwitchLabel, setBranchSwitchLabel] = useState('')
  const drawerDragRef = useRef({ active: false, moved: false, startY: 0, startTop: drawerHandleTop })
  const branchSwitchTimerRef = useRef<number | undefined>(undefined)

  const currentUser = db.users.find((user) => user.id === sessionUserId && user.status === 'active') ?? null
  const activeBranches = useMemo(() => getActiveBranches(db), [db])
  const assignedBranch = useMemo(() => getUserHomeBranch(db, currentUser), [currentUser, db])
  const branchMenuBranches = useMemo(() => prioritizeAssignedBranch(activeBranches, assignedBranch?.id), [activeBranches, assignedBranch?.id])
  const activeBranch = activeBranches.find((branch) => branch.id === activeBranchId) ?? assignedBranch ?? activeBranches[0] ?? db.branches[0]
  const stockRows = useMemo(() => getStockRows(db), [db])
  const activeBranchStockRows = useMemo(() => activeBranch ? stockRows.filter((row) => row.batch.branchId === activeBranch.id) : stockRows, [activeBranch, stockRows])
  const permittedStockRows = useMemo(() => currentUser ? stockRows.filter((row) => canViewBranch(db, currentUser, row.batch.branchId)) : [], [currentUser, db, stockRows])
  const canWrite = currentUser ? currentUser.role === 'admin' || currentUser.role === 'pharmacist' || currentUser.role === 'inventory' : false
  const canSell = currentUser && activeBranch ? isSuperAdmin(db, currentUser) || canManageBranch(db, currentUser, activeBranch.id) || ((currentUser.role === 'pharmacist' || currentUser.role === 'cashier') && hasActiveBranchAssignment(currentUser, activeBranch.id)) : false
  const canManagePrices = currentUser && activeBranch ? isSuperAdmin(db, currentUser) || canManageBranch(db, currentUser, activeBranch.id) || (currentUser.role === 'inventory' && hasActiveBranchAssignment(currentUser, activeBranch.id)) : false
  const canAdjust = currentUser ? currentUser.role === 'admin' || currentUser.role === 'pharmacist' : false
  const canAdmin = isSuperAdmin(db, currentUser)
  const dashboardStockRows = useMemo(() => canAdmin ? stockRows : activeBranchStockRows, [activeBranchStockRows, canAdmin, stockRows])
  const dashboardStockTotals = useMemo(() => aggregateMedicineStock(dashboardStockRows), [dashboardStockRows])
  const medicinePageStockRows = activeBranchStockRows
  const medicinePageStockTotals = useMemo(() => aggregateMedicineStock(medicinePageStockRows), [medicinePageStockRows])
  const notificationStockRows = activeBranch ? activeBranchStockRows : permittedStockRows
  const notificationStockTotals = useMemo(() => aggregateMedicineStock(notificationStockRows), [notificationStockRows])
  const canWriteActiveBranch = currentUser && activeBranch ? canWriteBranch(db, currentUser, activeBranch.id) : false
  const notifications = useMemo(() => currentUser ? buildNotifications(db, notificationStockRows, notificationStockTotals, currentUser, activeBranch) : [], [activeBranch, currentUser, db, notificationStockRows, notificationStockTotals])

  useEffect(() => {
    async function load() {
      try {
        setConnectionError('')
        const workspaceSlug = getWorkspaceSlugFromLocation() || getStoredCompanySlug()
        if (workspaceSlug) {
          storeCompanySlug(workspaceSlug)
          setCompanySlug(workspaceSlug)
        }
        const boot = await bootstrap()
        if (!boot.settings) {
          throw new Error('Backend API is not available. Run npx vercel dev with DATABASE_URL for API-backed flows.')
        }
        setHasUsers(boot.hasUsers)
        setTenantExists(boot.tenantExists)
        if (workspaceSlug && boot.settings.companySlug) {
          storeCompanySlug(boot.settings.companySlug)
          setCompanySlug(boot.settings.companySlug)
        }
        setDb((previous) => ({ ...previous, settings: boot.settings }))
        if (getStoredToken()) {
          const state = await loadState()
          setDb(state.db)
          setSessionUserId(state.currentUser.id)
          setActiveBranchId(getUserHomeBranch(state.db, state.currentUser)?.id ?? state.db.branches.find((branch) => branch.active)?.id ?? 'main')
        }
      } catch (error) {
        clearStoredToken()
        setSessionUserId(null)
        setConnectionError(error instanceof Error ? error.message : 'Unable to connect to the pharmacy backend')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2800)
  }

  const forgetBrowserUser = useCallback((userId?: string | null) => {
    clearStoredToken()
    if (typeof window === 'undefined') return
    window.sessionStorage.clear()
    if (!userId) return
    const workspaceKey = db.settings.companySlug || db.settings.companyCode || 'workspace'
    const userStoragePrefix = `rxledger:${workspaceKey}:${userId}:`
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(userStoragePrefix) || key.includes(`:${userId}:`)) {
        window.localStorage.removeItem(key)
      }
    })
  }, [db.settings.companyCode, db.settings.companySlug])

  const returnToSignIn = useCallback((message?: string) => {
    setSessionUserId(null)
    setActiveView('dashboard')
    setSidebarOpen(false)
    setSidebarCollapsed(true)
    setBranchMenuOpen(false)
    setAuthIntent('signin')
    setNotice('')
    setConnectionError(message ?? '')
  }, [])

  const forceSignOut = useCallback(async (message?: string) => {
    const userId = sessionUserId
    try {
      await apiLogout()
    } catch {
      // Local browser state is still cleared below even if the server session is already gone.
    }
    forgetBrowserUser(userId)
    returnToSignIn(message)
  }, [forgetBrowserUser, returnToSignIn, sessionUserId])

  async function executeAction(action: string, payload: Record<string, unknown>, successMessage?: string) {
    try {
      const result = await runAction(action, payload)
      setDb(result.db)
      setSessionUserId(result.currentUser.id)
      setConnectionError('')
      if (successMessage) flash(successMessage)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete action'
      if (message.toLowerCase().includes('authentication')) {
        await forceSignOut('Session expired. Please sign in again.')
        return false
      }
      flash(message)
      return false
    }
  }

  async function createFirstAdmin(input: SetupInput) {
    setSigningIn(true)
    try {
      const result = await setupWorkspace(input)
      setDb(result.db)
      setSessionUserId(result.currentUser.id)
      setHasUsers(true)
      setTenantExists(true)
      setCompanySlug(result.db.settings.companySlug)
      storeCompanySlug(result.db.settings.companySlug)
      if (result.db.settings.companySlug && getWorkspaceSlugFromLocation() !== result.db.settings.companySlug) {
        window.history.replaceState(null, '', `/${result.db.settings.companySlug}`)
      }
      setActiveBranchId(getUserHomeBranch(result.db, result.currentUser)?.id ?? result.db.branches.find((branch) => branch.active)?.id ?? 'main')
      setActiveView('dashboard')
    } finally {
      setSigningIn(false)
    }
  }

  async function registerUser(input: RegisterInput) {
    await apiRegisterUser(input)
  }

  async function requestPasswordReset(input: PasswordResetInput) {
    return apiRequestPasswordReset(input)
  }

  async function completePasswordReset(input: PasswordResetCompleteInput) {
    await apiCompletePasswordReset(input)
  }

  async function triggerSecurityPanic() {
    const userId = currentUser?.id
    if (!userId) return
    if (!window.confirm('Secure this account now? Every active session, including this browser, will be signed out and remembered browsers will be cleared.')) return
    try {
      await runAction('triggerSecurityPanic', {})
      forgetBrowserUser(userId)
      returnToSignIn()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to secure this account'
      forgetBrowserUser(userId)
      returnToSignIn(message.toLowerCase().includes('authentication') ? 'Session expired. Please sign in again.' : message)
    }
  }

  async function signIn(email: string, password: string) {
    setSigningIn(true)
    try {
      const result = await apiLogin(email, password)
      setDb(result.db)
      setSessionUserId(result.currentUser.id)
      setConnectionError('')
      setActiveBranchId(getUserHomeBranch(result.db, result.currentUser)?.id ?? result.db.branches.find((branch) => branch.active)?.id ?? 'main')
      setActiveView('dashboard')
    } finally {
      setSigningIn(false)
    }
  }

  async function selectWorkspace(value: string) {
    const result = await resolveCompany(value)
    storeCompanySlug(result.slug)
    setCompanySlug(result.slug)
    window.history.replaceState(null, '', `/${result.slug}`)
    const boot = await bootstrap()
    setHasUsers(boot.hasUsers)
    setTenantExists(boot.tenantExists)
    setDb((previous) => ({ ...previous, settings: boot.settings }))
    setConnectionError('')
    setAuthIntent('signin')
  }

  async function signOut() {
    await forceSignOut()
  }

  function shouldAutoCollapseSidebar() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  }

  function navigate(view: View) {
    setActiveView(view)
    if (shouldAutoCollapseSidebar()) {
      setSidebarOpen(false)
      setSidebarCollapsed(true)
    }
  }

  function switchActiveBranch(branchId: string) {
    const nextBranch = activeBranches.find((branch) => branch.id === branchId) ?? db.branches.find((branch) => branch.id === branchId)
    setBranchMenuOpen(false)
    if (!nextBranch || branchId === activeBranchId) return
    window.clearTimeout(branchSwitchTimerRef.current)
    setBranchSwitchLabel(nextBranch.name)
    setBranchSwitching(true)
    branchSwitchTimerRef.current = window.setTimeout(() => {
      setActiveBranchId(branchId)
      branchSwitchTimerRef.current = window.setTimeout(() => {
        setBranchSwitching(false)
      }, 260)
    }, 260)
  }

  function collapseSidebar() {
    setSidebarCollapsed(true)
    setSidebarOpen(false)
  }

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      const opening = collapsed
      setSidebarOpen(opening)
      return !collapsed
    })
  }

  function clampDrawerHandleTop(value: number) {
    const minimum = 76
    const maximum = typeof window === 'undefined' ? Math.max(minimum, value) : Math.max(minimum, window.innerHeight - 76)
    return Math.min(Math.max(value, minimum), maximum)
  }

  function startDrawerHandleDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    drawerDragRef.current = {
      active: true,
      moved: false,
      startY: event.clientY,
      startTop: drawerHandleTop,
    }
    setDrawerHandleDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrawerHandle(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drawerDragRef.current.active) return
    const nextTop = drawerDragRef.current.startTop + event.clientY - drawerDragRef.current.startY
    if (Math.abs(event.clientY - drawerDragRef.current.startY) > 5) {
      drawerDragRef.current.moved = true
    }
    setDrawerHandleTop(clampDrawerHandleTop(nextTop))
  }

  function stopDrawerHandleDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drawerDragRef.current.active) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released when the pointer is cancelled.
    }
    drawerDragRef.current.active = false
    setDrawerHandleDragging(false)
    if (!drawerDragRef.current.moved) {
      toggleSidebar()
    }
  }

  function handleDrawerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    toggleSidebar()
  }

  useEffect(() => {
    if (!currentUser) return undefined
    let timeoutId = window.setTimeout(() => {
      void forceSignOut('Session timed out after 30 minutes of inactivity. Please sign in again.')
    }, IDLE_TIMEOUT_MS)

    function resetTimer() {
      window.clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        void forceSignOut('Session timed out after 30 minutes of inactivity. Please sign in again.')
      }, IDLE_TIMEOUT_MS)
    }

    const activityEvents = ['click', 'keydown', 'mousemove', 'mousedown', 'scroll', 'touchstart']
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }))

    return () => {
      window.clearTimeout(timeoutId)
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer))
    }
  }, [currentUser, forceSignOut])

  useEffect(() => {
    return () => window.clearTimeout(branchSwitchTimerRef.current)
  }, [])

  const isWorkspaceRoute = Boolean(getWorkspaceSlugFromLocation())

  if (!currentUser && loading && !isWorkspaceRoute && authIntent === 'landing' && !getStoredToken()) {
    return (
      <RxLedgerLanding
        onCreateWorkspace={() => setAuthIntent('setup')}
        onSignIn={() => setAuthIntent('signin')}
      />
    )
  }

  if (signingIn) return <WorkspaceLoadingScreen settings={db.settings} />
  if (loading) return <AppLoadingScreen />

  if (!currentUser) {
    if (!isWorkspaceRoute && authIntent === 'landing') {
      return (
        <RxLedgerLanding
          onCreateWorkspace={() => setAuthIntent('setup')}
          onSignIn={() => setAuthIntent('signin')}
        />
      )
    }
    return (
      <AuthScreen
        hasUsers={authIntent === 'setup' && !isWorkspaceRoute ? false : hasUsers}
        tenantExists={authIntent === 'setup' && !isWorkspaceRoute ? false : tenantExists}
        companySlug={authIntent === 'setup' && !isWorkspaceRoute ? '' : companySlug}
        settings={db.settings}
        connectionError={connectionError}
        createFirstAdmin={createFirstAdmin}
        login={signIn}
        registerUser={registerUser}
        requestPasswordReset={requestPasswordReset}
        completePasswordReset={completePasswordReset}
        selectWorkspace={selectWorkspace}
        backToLanding={!isWorkspaceRoute ? () => setAuthIntent('landing') : undefined}
      />
    )
  }

  const pendingUsers = canAdmin ? db.users.filter((user) => user.status === 'pending').length : 0
  const pendingAdminTasks = pendingUsers
  const unreadChat = notifications.some((notification) => notification.id === 'chat-unread') ? db.chatMessages.filter((message) => isChatMessageVisible(message, currentUser) && message.userId !== currentUser.id && new Date(message.createdAt).getTime() > (currentUser.lastChatSeenAt ? new Date(currentUser.lastChatSeenAt).getTime() : 0)).length : 0

  return (
    <div className={`${sidebarOpen ? 'app-shell sidebar-open' : 'app-shell'}${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <button className="sidebar-backdrop" type="button" aria-label="Close menu" onClick={collapseSidebar} />
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-identity">
            <BrandMark settings={db.settings} />
            <div>
              <strong>{db.settings.softwareName}</strong>
              <span>{db.settings.accountName}</span>
            </div>
          </div>
          <button className="sidebar-close-button" type="button" onClick={collapseSidebar} aria-label="Close control panel" title="Close control panel">
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {views.map(({ id: viewId, label, icon: Icon, adminOnly }) => {
            const disabled = adminOnly && !canAdmin
            return (
              <button
                key={viewId}
                className={activeView === viewId ? 'nav-item active' : 'nav-item'}
                type="button"
                onClick={() => !disabled && navigate(viewId)}
                disabled={disabled}
                title={label}
              >
                <Icon size={18} />
                <span>{label}</span>
                {viewId === 'users' && pendingAdminTasks > 0 && <b className="nav-badge">{pendingAdminTasks}</b>}
                {viewId === 'chat' && unreadChat > 0 && <b className="nav-badge">{unreadChat}</b>}
                {viewId === 'notifications' && notifications.length > 0 && <b className="nav-badge">{notifications.length}</b>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="sidebar-security-button" type="button" onClick={triggerSecurityPanic} title="Sign out other sessions and record a security alert">
            <ShieldCheck size={17} />
            <span>Secure account</span>
          </button>
          <div className="user-panel">
            <div>
              <strong>{currentUser.name}</strong>
              <span>{canAdmin ? 'Global access' : assignedBranch?.name ?? 'No assigned branch'}</span>
              <span>{getUserHomeRoleLabel(db, currentUser, assignedBranch?.id)}</span>
            </div>
            <button className="icon-button" type="button" onClick={() => { void signOut() }} title="Log out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <button
        className={`drawer-handle${sidebarCollapsed ? ' is-closed' : ' is-open'}${drawerHandleDragging ? ' is-dragging' : ''}`}
        type="button"
        style={{
          left: sidebarCollapsed ? 0 : SIDEBAR_WIDTH - 26,
          top: drawerHandleTop,
        }}
        aria-label={sidebarCollapsed ? 'Open control panel' : 'Collapse control panel'}
        aria-expanded={!sidebarCollapsed}
        onKeyDown={handleDrawerKeyDown}
        onPointerDown={startDrawerHandleDrag}
        onPointerMove={moveDrawerHandle}
        onPointerUp={stopDrawerHandleDrag}
        onPointerCancel={stopDrawerHandleDrag}
      >
        {sidebarCollapsed ? <ChevronRight size={30} strokeWidth={3.2} /> : <ChevronLeft size={30} strokeWidth={3.2} />}
      </button>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <div>
              <span className="eyebrow">{db.settings.accountName}</span>
              <h1>{views.find((view) => view.id === activeView)?.label}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {notice && <span className="notice">{notice}</span>}
            {activeBranch && (
              <div className="branch-switcher">
                <button className="branch-switcher-trigger" type="button" onClick={() => setBranchMenuOpen((open) => !open)} aria-expanded={branchMenuOpen}>
                  <Building2 size={16} />
                  <span className="branch-trigger-text">
                    <strong>{activeBranch.name}</strong>
                    <small>{canAdmin ? 'Global super admin' : assignedBranch?.id === activeBranch.id ? 'Assigned branch' : `Assigned: ${assignedBranch?.name ?? 'None'}`}</small>
                  </span>
                </button>
                {branchMenuOpen && (
                  <div className="branch-menu">
                    {branchMenuBranches.map((branch) => (
                      <button
                        className={branch.id === activeBranch.id ? 'active' : ''}
                        key={branch.id}
                        type="button"
                        onClick={() => switchActiveBranch(branch.id)}
                      >
                        <span>{branch.name}</span>
                        {!canAdmin && branch.id === assignedBranch?.id && <b><CheckCircle2 size={13} /> Assigned</b>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {canAdmin && pendingAdminTasks > 0 && (
              <button className="ghost-button" type="button" onClick={() => navigate('users')}>
                <UserCheck size={16} />
                {pendingAdminTasks} pending
              </button>
            )}
            {notifications.length > 0 && (
              <button className="ghost-button" type="button" onClick={() => navigate('notifications')}>
                <Bell size={16} />
                {notifications.length} notification{notifications.length > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </header>

        <div className={branchSwitching ? 'branch-workspace is-loading' : 'branch-workspace'}>
          {branchSwitching && (
            <div className="branch-loading-panel" role="status" aria-live="polite">
              <span className="loading-spinner" />
              <strong>Switching branch</strong>
              <span>Loading {branchSwitchLabel} workspace...</span>
            </div>
          )}
          {activeView === 'dashboard' && <Dashboard db={db} currentUser={currentUser} stockRows={dashboardStockRows} alertStockRows={notificationStockRows} alertStockTotals={notificationStockTotals} canAdmin={canAdmin} activeBranch={activeBranch} assignedBranch={assignedBranch} setActiveView={setActiveView} />}
          {activeView === 'medicines' && <Medicines db={db} currentUser={currentUser} stockRows={medicinePageStockRows} stockTotals={medicinePageStockTotals} activeBranch={activeBranch} canWrite={Boolean(canWriteActiveBranch)} canManagePrices={Boolean(canManagePrices)} canFulfillActiveBranch={Boolean(canWriteActiveBranch)} executeAction={executeAction} flash={flash} />}
          {activeView === 'products' && activeBranch && <ProductsView db={db} canWrite={Boolean(canManagePrices)} executeAction={executeAction} flash={flash} />}
          {activeView === 'suppliers' && <Suppliers db={db} canWrite={canWrite} executeAction={executeAction} />}
          {activeView === 'receive' && activeBranch && <ReceiveStock db={db} activeBranch={activeBranch} canWrite={Boolean(canWriteActiveBranch)} executeAction={executeAction} flash={flash} />}
          {activeView === 'pos' && activeBranch && <POSView key={`${currentUser.id}-${activeBranch.id}`} db={db} currentUser={currentUser} activeBranch={activeBranch} stockRows={activeBranchStockRows} canSell={Boolean(canSell)} executeAction={executeAction} flash={flash} />}
          {activeView === 'patients' && <PatientsView db={db} activeBranch={activeBranch} flash={flash} />}
          {activeView === 'issue' && activeBranch && <IssueStock db={db} activeBranch={activeBranch} stockRows={activeBranchStockRows} canWrite={Boolean(canWriteActiveBranch)} executeAction={executeAction} flash={flash} />}
          {activeView === 'adjust' && activeBranch && <Adjustments activeBranch={activeBranch} stockRows={activeBranchStockRows} canAdjust={canAdjust && Boolean(canWriteActiveBranch)} executeAction={executeAction} flash={flash} />}
          {activeView === 'reports' && <Reports db={db} stockRows={dashboardStockRows} stockTotals={dashboardStockTotals} activeBranch={canAdmin ? undefined : activeBranch} />}
          {activeView === 'chat' && <ChatView db={db} currentUser={currentUser} executeAction={executeAction} />}
          {activeView === 'notifications' && <NotificationsView notifications={notifications} setActiveView={setActiveView} />}
          {activeView === 'audit' && <Audit db={db} />}
          {activeView === 'users' && <UserManagement db={db} currentUser={currentUser} executeAction={executeAction} flash={flash} />}
          {activeView === 'branches' && activeBranch && <BranchesView db={db} currentUser={currentUser} activeBranchId={activeBranch.id} setActiveBranchId={switchActiveBranch} executeAction={executeAction} />}
          {activeView === 'guide' && <GuideView db={db} currentUser={currentUser} setActiveView={setActiveView} />}
          {activeView === 'settings' && <SettingsView db={db} canAdmin={canAdmin} executeAction={executeAction} />}
        </div>
        <QuestCoach db={db} currentUser={currentUser} activeView={activeView} activeBranchId={activeBranch?.id} setActiveView={setActiveView} />
      </main>
    </div>
  )
}

type SetupInput = {
  pharmacyName: string
  companySlug: string
  businessLicense: string
  mainBranchAddress: string
  branchName: string
  name: string
  email: string
  phone: string
  password: string
}

type RegisterInput = {
  name: string
  email: string
  phone: string
  password: string
}

type PasswordResetInput = {
  email: string
  phone: string
}

type PasswordResetCompleteInput = {
  email: string
  code: string
  password: string
}

function RxLedgerLogo({ size = 'normal' }: { size?: 'normal' | 'large' }) {
  return (
    <span className={size === 'large' ? 'rxledger-logo large' : 'rxledger-logo'}>
      <img src="/favicon.svg" alt="RxLedger logo" />
    </span>
  )
}

function AppLoadingScreen() {
  return (
    <main className="login-screen">
      <section className="login-panel auth-panel">
        <RxLedgerLogo size="large" />
        <div>
          <span className="eyebrow">RxLedger</span>
          <h1>Opening secure sign in</h1>
          <p>Preparing the app for your workspace.</p>
        </div>
      </section>
    </main>
  )
}

function WorkspaceLoadingScreen({ settings }: { settings: AppSettings }) {
  const companyName = settings.accountName || settings.pharmacyName || 'Your pharmacy'
  return (
    <main className="login-screen">
      <section className="login-panel auth-panel workspace-loading-panel">
        <div className="workspace-loading-rxledger">
          <RxLedgerLogo />
          <span>RxLedger</span>
        </div>
        <div className="workspace-loading-company">
          <BrandMark settings={settings} size="large" />
          <div>
            <span className="eyebrow">Connecting</span>
            <h1>{companyName} workspace</h1>
            <p>Loading your company workspace and preparing your dashboard.</p>
          </div>
        </div>
      </section>
    </main>
  )
}

function PasswordInput({
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  minLength,
  full = false,
  required = true,
  showToggle = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  visible: boolean
  onToggle?: () => void
  autoComplete?: string
  minLength?: number
  full?: boolean
  required?: boolean
  showToggle?: boolean
}) {
  return (
    <label className={full ? 'password-field full' : 'password-field'}>
      {label}
      <span className="password-control">
        <input required={required} type={visible ? 'text' : 'password'} minLength={minLength} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} />
        {showToggle && onToggle && (
          <button type="button" onClick={onToggle} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}>
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </span>
    </label>
  )
}

function AuthScreen({
  hasUsers,
  tenantExists,
  companySlug,
  settings,
  connectionError,
  createFirstAdmin,
  login,
  registerUser,
  requestPasswordReset,
  completePasswordReset,
  selectWorkspace,
  backToLanding,
}: {
  hasUsers: boolean
  tenantExists: boolean
  companySlug: string
  settings: AppSettings
  connectionError: string
  createFirstAdmin: (input: SetupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  registerUser: (input: RegisterInput) => Promise<void>
  requestPasswordReset: (input: PasswordResetInput) => Promise<{ ok: boolean; emailConfigured: boolean }>
  completePasswordReset: (input: PasswordResetCompleteInput) => Promise<void>
  selectWorkspace: (value: string) => Promise<void>
  backToLanding?: () => void
}) {
  const [mode, setMode] = useState<AuthMode>(hasUsers ? 'login' : 'setup')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const workspaceSelected = Boolean(companySlug && tenantExists)
  const activeMode: AuthMode = tenantExists && hasUsers ? mode : 'setup'
  const companyName = settings.accountName || settings.pharmacyName || 'Your pharmacy'
  const authTitle = activeMode === 'setup'
    ? 'Create your pharmacy workspace'
    : activeMode === 'register'
      ? workspaceSelected ? `Request access to ${companyName}` : 'Request workspace access'
      : activeMode === 'reset'
        ? 'Reset your password'
        : workspaceSelected ? `Sign in to ${companyName}` : 'Sign in to RxLedger'
  const authCopy = activeMode === 'setup'
    ? 'Create the company workspace, first branch, and permanent administrator.'
    : activeMode === 'register'
      ? workspaceSelected ? 'Submit your staff details for admin review.' : 'Find your company workspace before requesting access.'
      : activeMode === 'reset'
        ? workspaceSelected ? 'Confirm your staff email and phone number before changing your password.' : 'Find your company workspace before resetting your password.'
        : workspaceSelected ? 'Use your approved staff credentials to continue.' : 'Find your company workspace before entering your staff credentials.'

  return (
    <main className="login-screen">
      <section className="login-panel auth-panel">
        {activeMode === 'setup' || !workspaceSelected ? <RxLedgerLogo size="large" /> : <BrandMark settings={settings} size="large" />}
        <div>
          <span className="eyebrow">{activeMode === 'setup' || !workspaceSelected ? 'RxLedger' : companyName}</span>
          <h1>{authTitle}</h1>
          <p>{authCopy}</p>
        </div>
        {backToLanding && (
          <button className="ghost-button" type="button" onClick={backToLanding}>
            <ChevronLeft size={16} />
            Back to RxLedger
          </button>
        )}

        {activeMode !== 'setup' && (
          <div className="tabs auth-tabs">
            <button className={activeMode === 'login' ? 'active' : ''} type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Sign in</button>
            <button className={activeMode === 'register' ? 'active' : ''} type="button" onClick={() => { setMode('register'); setError(''); setSuccess('') }}>Request access</button>
            <button className={activeMode === 'reset' ? 'active' : ''} type="button" onClick={() => { setMode('reset'); setError(''); setSuccess('') }}>Forgot password</button>
          </div>
        )}

        {activeMode === 'setup' && <SetupForm createFirstAdmin={createFirstAdmin} setError={setError} initialSlug={companySlug} />}
        {activeMode !== 'setup' && (
          <WorkspaceFinder
            companySlug={companySlug}
            settings={settings}
            workspaceSelected={workspaceSelected}
            selectWorkspace={selectWorkspace}
            setError={setError}
            setSuccess={setSuccess}
          />
        )}
        {activeMode === 'login' && workspaceSelected && <LoginForm login={login} setError={setError} setSuccess={setSuccess} />}
        {activeMode === 'register' && workspaceSelected && <RegisterForm registerUser={registerUser} setError={setError} setSuccess={setSuccess} />}
        {activeMode === 'reset' && workspaceSelected && <PasswordResetForm requestPasswordReset={requestPasswordReset} completePasswordReset={completePasswordReset} setError={setError} setSuccess={setSuccess} />}

        {connectionError && <div className="form-error">{connectionError}</div>}
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
      </section>
    </main>
  )
}

function WorkspaceFinder({
  companySlug,
  settings,
  workspaceSelected,
  selectWorkspace,
  setError,
  setSuccess,
}: {
  companySlug: string
  settings: AppSettings
  workspaceSelected: boolean
  selectWorkspace: (value: string) => Promise<void>
  setError: (message: string) => void
  setSuccess: (message: string) => void
}) {
  const [workspaceQuery, setWorkspaceQuery] = useState('')
  const [checking, setChecking] = useState(false)
  const companyName = settings.accountName || settings.pharmacyName || 'Your pharmacy'

  async function submit(event: FormEvent) {
    event.preventDefault()
    const value = workspaceQuery.trim()
    setError('')
    setSuccess('')
    if (!value) {
      setError('Enter your company access code or unique URL.')
      return
    }
    setChecking(true)
    try {
      await selectWorkspace(value)
      setSuccess('Workspace found. Enter your login details to continue.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to find that company workspace.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="workspace-finder" aria-label="Find your company">
      <form className="workspace-finder-form" onSubmit={submit}>
        <h2>Find your company</h2>
        <p>Enter your company's unique url or code, provided by your admin to find your company's workspace.</p>
        <label className="sr-only" htmlFor="workspace-access-code">Company access code</label>
        <input
          id="workspace-access-code"
          required
          value={workspaceQuery}
          onChange={(event) => setWorkspaceQuery(event.target.value)}
          placeholder="Company access code"
          autoComplete="organization"
        />
        <button className="primary-button" type="submit" disabled={checking}>
          {checking ? 'Checking...' : 'Continue'}
        </button>
      </form>
      {workspaceSelected && (
        <div className="workspace-confirmation" aria-live="polite">
          <BrandMark settings={settings} />
          <div>
            <span>Workspace confirmed</span>
            <strong>{companyName}</strong>
            <small>{settings.companyCode ? `Code: ${settings.companyCode}` : `URL: /${companySlug}`}</small>
          </div>
        </div>
      )}
    </section>
  )
}

function SetupForm({
  createFirstAdmin,
  setError,
  initialSlug,
}: {
  createFirstAdmin: (input: SetupInput) => Promise<void>
  setError: (message: string) => void
  initialSlug: string
}) {
  const [form, setForm] = useState<SetupInput>({
    pharmacyName: '',
    companySlug: initialSlug,
    businessLicense: '',
    mainBranchAddress: '',
    branchName: 'Main Branch',
    name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [slugStatus, setSlugStatus] = useState<{ state: 'idle' | 'checking' | 'available' | 'taken'; message: string }>({ state: 'idle', message: '' })

  useEffect(() => {
    const slug = slugifyCompany(form.companySlug || form.pharmacyName)
    const timeoutId = window.setTimeout(() => {
      if (!slug) {
        setSlugStatus({ state: 'idle', message: '' })
        return
      }
      setSlugStatus({ state: 'checking', message: 'Checking workspace name...' })
      void checkCompanySlug(slug)
        .then((result) => {
          setSlugStatus(result.available
            ? { state: 'available', message: 'This workspace name is available' }
            : { state: 'taken', message: `This workspace name has already been claimed${result.claimedBy ? ` by ${result.claimedBy}` : ''}` })
        })
        .catch((error) => setSlugStatus({ state: 'taken', message: error instanceof Error ? error.message : 'Unable to check workspace name' }))
    }, 350)
    return () => window.clearTimeout(timeoutId)
  }, [form.companySlug, form.pharmacyName])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    const companySlug = slugifyCompany(form.companySlug || form.pharmacyName)
    if (!companySlug) {
      setError('Enter a pharmacy/company name.')
      return
    }
    if (slugStatus.state === 'taken') {
      setError(slugStatus.message)
      return
    }
    await createFirstAdmin({ ...form, companySlug })
  }

  return (
    <form className="form-grid" onSubmit={submit} autoComplete="off">
      <label className="full">Pharmacy/company name<input required value={form.pharmacyName} onChange={(event) => setForm({ ...form, pharmacyName: event.target.value, companySlug: form.companySlug || slugifyCompany(event.target.value) })} placeholder="Enter your company name" autoFocus /></label>
      {slugStatus.message && <div className={`form-note full slug-${slugStatus.state}`}>{slugStatus.message}</div>}
      <label className="full">Business registration/licence details<input required value={form.businessLicense} onChange={(event) => setForm({ ...form, businessLicense: event.target.value })} placeholder="Enter licence or registration reference" /></label>
      <label className="full">Main branch address<input required value={form.mainBranchAddress} onChange={(event) => setForm({ ...form, mainBranchAddress: event.target.value })} placeholder="Enter main branch address" /></label>
      <label className="full">First branch/site<input required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} placeholder="Enter first branch or site name" /></label>
      <label className="full">Permanent admin full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter admin full name" /></label>
      <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Enter admin email address" /></label>
      <label>Phone<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Enter admin phone number" /></label>
      <PasswordInput label="New password" value={form.password} onChange={(password) => setForm({ ...form, password })} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} autoComplete="new-password" minLength={8} full />
      <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} autoComplete="new-password" minLength={8} full showToggle={false} />
      <div className="form-actions full">
        <button className="primary-button" type="submit">
          <ShieldCheck size={17} />
          Create RxLedger account
        </button>
      </div>
    </form>
  )
}

function LoginForm({
  login,
  setError,
  setSuccess,
}: {
  login: (email: string, password: string) => Promise<void>
  setError: (message: string) => void
  setSuccess: (message: string) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    try {
      await login(email, password)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to log in.')
    }
  }

  return (
    <form className="stack" onSubmit={submit} autoComplete="off">
      <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" /></label>
      <PasswordInput label="Password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} autoComplete="off" />
      <button className="primary-button" type="submit">
        <Lock size={17} />
        Log in
      </button>
    </form>
  )
}

function RegisterForm({
  registerUser,
  setError,
  setSuccess,
}: {
  registerUser: (input: RegisterInput) => Promise<void>
  setError: (message: string) => void
  setSuccess: (message: string) => void
}) {
  const [form, setForm] = useState<RegisterInput>({ name: '', email: '', phone: '', password: '' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    try {
      await registerUser(form)
      setForm({ name: '', email: '', phone: '', password: '' })
      setConfirmPassword('')
      setSuccess('Access request submitted. An admin must approve and assign your role before you can sign in.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to submit access request.')
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="full">Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Phone<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <PasswordInput label="New password" value={form.password} onChange={(password) => setForm({ ...form, password })} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} autoComplete="new-password" minLength={8} full />
      <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} autoComplete="new-password" minLength={8} full showToggle={false} />
      <div className="form-actions full">
        <button className="primary-button" type="submit">
          <UserPlus size={17} />
          Request access
        </button>
      </div>
    </form>
  )
}

function PasswordResetForm({
  requestPasswordReset,
  completePasswordReset,
  setError,
  setSuccess,
}: {
  requestPasswordReset: (input: PasswordResetInput) => Promise<{ ok: boolean; emailConfigured: boolean }>
  completePasswordReset: (input: PasswordResetCompleteInput) => Promise<void>
  setError: (message: string) => void
  setSuccess: (message: string) => void
}) {
  const [form, setForm] = useState<PasswordResetInput>({ email: '', phone: '' })
  const [codeRequested, setCodeRequested] = useState(false)
  const [emailConfigured, setEmailConfigured] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    try {
      const result = await requestPasswordReset(form)
      setCodeRequested(true)
      setEmailConfigured(result.emailConfigured)
      setSuccess(result.emailConfigured ? 'Reset code sent. Check your email and enter the code below.' : 'Reset request recorded, but email delivery is not configured yet. Add the email keys before live testing this flow.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to request password reset code.')
    }
  }

  async function completeReset(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    try {
      await completePasswordReset({ email: form.email, code, password })
      setForm({ email: '', phone: '' })
      setCode('')
      setPassword('')
      setConfirmPassword('')
      setCodeRequested(false)
      setEmailConfigured(false)
      setSuccess('Password changed. You can sign in with the new password now.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to complete password reset.')
    }
  }

  return (
    <form className="form-grid" onSubmit={codeRequested ? completeReset : requestCode}>
      <label className="full">Account email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="username" disabled={codeRequested} /></label>
      <label className="full">Phone number on account<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} disabled={codeRequested} /></label>
      {codeRequested && (
        <>
          <label>Reset code<input required inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} placeholder="6-digit code" autoFocus /></label>
          <PasswordInput label="New password" value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((visible) => !visible)} autoComplete="new-password" minLength={8} />
          <PasswordInput label="Confirm password" value={confirmPassword} onChange={setConfirmPassword} visible={showPassword} autoComplete="new-password" minLength={8} showToggle={false} />
          {!emailConfigured && <div className="form-note full">Email is not active yet, so no real reset code was delivered. This screen is ready for testing once Resend keys are added.</div>}
        </>
      )}
      <div className="form-actions full">
        {codeRequested && (
          <button className="ghost-button" type="button" onClick={() => { setCodeRequested(false); setCode(''); setPassword(''); setConfirmPassword(''); setError(''); setSuccess('') }}>
            Start again
          </button>
        )}
        <button className="primary-button" type="submit">
          <Lock size={17} />
          {codeRequested ? 'Change password' : 'Send reset code'}
        </button>
      </div>
    </form>
  )
}

function Dashboard({
  db,
  currentUser,
  stockRows,
  alertStockRows,
  alertStockTotals,
  canAdmin,
  activeBranch,
  assignedBranch,
  setActiveView,
}: {
  db: Database
  currentUser: User
  stockRows: StockRow[]
  alertStockRows: StockRow[]
  alertStockTotals: Map<string, number>
  canAdmin: boolean
  activeBranch?: Branch
  assignedBranch?: Branch
  setActiveView: (view: View) => void
}) {
  const scopedMedicineIds = new Set(stockRows.map((row) => row.medicine.id))
  const alertMedicineIds = new Set(alertStockRows.map((row) => row.medicine.id))
  const lowStock = db.medicines.filter((medicine) => alertMedicineIds.has(medicine.id) && (alertStockTotals.get(medicine.id) ?? 0) > 0 && (alertStockTotals.get(medicine.id) ?? 0) <= medicine.reorderLevel)
  const nearExpiry = alertStockRows.filter((row) => row.quantity > 0 && row.status === 'near-expiry')
  const expired = alertStockRows.filter((row) => row.quantity > 0 && row.status === 'expired')
  const costValue = stockRows.reduce((sum, row) => sum + Math.max(0, row.costValue), 0)
  const activeSkuCount = canAdmin ? db.medicines.filter((medicine) => medicine.active).length : scopedMedicineIds.size
  const permittedBatchIds = new Set(alertStockRows.map((row) => row.batch.id))
  const todayMovements = db.ledger.filter((entry) => entry.createdAt.slice(0, 10) === today() && permittedBatchIds.has(entry.batchId)).length
  const pendingUsers = canAdmin ? db.users.filter((user) => user.status === 'pending').length : 0
  const activeBranches = canAdmin ? getActiveBranches(db).filter((branch) => canViewBranch(db, currentUser, branch.id)) : getActiveBranches(db).filter((branch) => branch.id === activeBranch?.id)
  const branchSummaries = activeBranches.map((branch) => {
    const rows = stockRows.filter((row) => row.batch.branchId === branch.id && row.quantity > 0)
    const branchStockValue = rows.reduce((sum, row) => sum + Math.max(0, row.costValue), 0)
    const branchExpired = rows.filter((row) => row.status === 'expired').length
    const branchNearExpiry = rows.filter((row) => row.status === 'near-expiry').length
    const branchSkuCount = new Set(rows.map((row) => row.medicine.id)).size
    return { branch, branchStockValue, branchExpired, branchNearExpiry, branchSkuCount }
  })

  return (
    <div className="page-grid">
      <section className="metric-grid">
        <Metric icon={Boxes} label="Active SKUs" value={compactNumber(activeSkuCount)} />
        <Metric icon={Building2} label="Active branches" value={compactNumber(activeBranches.length)} />
        <Metric icon={Archive} label={canAdmin ? 'Global stock value at cost' : `${activeBranch?.code || 'Branch'} stock value at cost`} value={compactMoney(costValue)} />
        <Metric icon={AlertTriangle} label="Low stock items" value={compactNumber(lowStock.length)} tone={lowStock.length ? 'warning' : 'good'} />
        <Metric icon={XCircle} label="Expired batches" value={compactNumber(expired.length)} tone={expired.length ? 'danger' : 'good'} />
        <Metric icon={Activity} label="Movements today" value={compactNumber(todayMovements)} />
      </section>

      {assignedBranch && (
        <section className="content-section assignment-strip">
          <CheckCircle2 size={18} />
          <div>
            <strong>{assignedBranch.name}</strong>
            <span>{getUserHomeRoleLabel(db, currentUser, assignedBranch.id)} / assigned branch</span>
          </div>
          {activeBranch && activeBranch.id !== assignedBranch.id && <b className="pill warning">Currently viewing {activeBranch.code || activeBranch.name}</b>}
        </section>
      )}

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Main Account Overview</h2>
            <p>Company-level view across branches/sites. Stock remains held by branches.</p>
          </div>
          <span className="pill active">{db.settings.accountName}</span>
        </div>
        <div className="branch-grid dashboard-scroll-list">
          {branchSummaries.map(({ branch, branchStockValue, branchExpired, branchNearExpiry, branchSkuCount }) => (
            <article className="branch-card" key={branch.id}>
              <Building2 size={19} />
              <div>
                <strong>{branch.name}</strong>
                <span>{branch.code}</span>
                <span>{branchSkuCount} stocked SKU{branchSkuCount === 1 ? '' : 's'} / {compactMoney(branchStockValue)}</span>
                <span>{branchNearExpiry} near expiry / {branchExpired} expired</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Operational Alerts</h2>
            <p>{activeBranch ? `${activeBranch.name} alerts based on current branch scope.` : 'Low stock, expiry risk, expired inventory, and access approvals.'}</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setActiveView('reports')}>
            <FileText size={16} />
            Reports
          </button>
        </div>
        <div className="alert-list dashboard-scroll-list">
          {pendingUsers > 0 && (
            <AlertItem tone="warning" title={`${pendingUsers} staff access request${pendingUsers > 1 ? 's' : ''} pending`} detail="An admin should approve users and assign the correct role before they can sign in." />
          )}
          {expired.map((row) => (
            <AlertItem key={row.batch.id} tone="danger" title={<MedicineIdentity medicine={row.medicine} />} detail={`Expired batch ${row.batch.batchNumber} has ${medicineStockLabel(row.medicine, row.quantity)} in ${row.batch.location}`} />
          ))}
          {nearExpiry.slice(0, 5).map((row) => (
            <AlertItem key={row.batch.id} tone="warning" title={<MedicineIdentity medicine={row.medicine} />} detail={`Batch ${row.batch.batchNumber} expires in ${row.daysToExpiry} days. ${medicineStockLabel(row.medicine, row.quantity)} available`} />
          ))}
          {lowStock.map((medicine) => (
            <AlertItem key={medicine.id} tone="info" title={<MedicineIdentity medicine={medicine} />} detail={`At or below reorder level. Available: ${medicineStockLabel(medicine, alertStockTotals.get(medicine.id) ?? 0)}. Reorder level: ${medicineStockLabel(medicine, medicine.reorderLevel)}`} />
          ))}
          {!pendingUsers && !expired.length && !nearExpiry.length && !lowStock.length && (
            <AlertItem tone="good" title="No active inventory alerts" detail="Stock levels, expiry windows, and access approvals are currently clear." />
          )}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Batch Stock Snapshot</h2>
            <p>FEFO sorting keeps nearest-expiry batches visible first.</p>
          </div>
        </div>
        <div className="dashboard-scroll-table">
          <StockTable rows={stockRows.filter((row) => row.quantity > 0)} />
        </div>
      </section>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: typeof Boxes
  label: string
  value: string | number
  tone?: 'neutral' | 'warning' | 'danger' | 'good'
}) {
  return (
    <div className={`metric ${tone}`}>
      <Icon size={21} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function AlertItem({ title, detail, tone }: { title: ReactNode; detail: string; tone: 'danger' | 'warning' | 'info' | 'good' }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : tone === 'good' ? CheckCircle2 : ClipboardList
  return (
    <div className={`alert-item ${tone}`}>
      <Icon size={19} />
      <div>
        <div className="alert-title">{title}</div>
        <span>{detail}</span>
      </div>
    </div>
  )
}

async function readWorkbookFile(file: File): Promise<Array<Record<string, unknown>>> {
  const rows = await readSheet(file)
  const [headerRow, ...dataRows] = rows
  const headers = headerRow.map((cell) => String(cell ?? ''))
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

async function readCsvFile(file: File): Promise<Array<Record<string, unknown>>> {
  const text = await file.text()
  const rows = parseCsv(text)
  const [headers = [], ...dataRows] = rows
  return dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function Medicines({
  db,
  currentUser,
  stockRows,
  stockTotals,
  activeBranch,
  canWrite,
  canManagePrices,
  canFulfillActiveBranch,
  executeAction,
  flash,
}: {
  db: Database
  currentUser: User
  stockRows: StockRow[]
  stockTotals: Map<string, number>
  activeBranch?: Branch
  canWrite: boolean
  canManagePrices: boolean
  canFulfillActiveBranch: boolean
  executeAction: ExecuteAction
  flash: (message: string) => void
}) {
  type RequisitionCartItem = {
    rowId: string
    medicineId: string
    batchId: string
    quantity: number
  }
  type MedicineDraft = Omit<Medicine, 'barcodes' | 'reorderLevel'> & {
    rowId: string
    barcodes: string
    reorderLevel: number | string
  }
  const createBlank = (): MedicineDraft => ({
    rowId: id('row'),
    id: '',
    sku: '',
    brandName: '',
    genericName: '',
    form: 'Tablet',
    strength: '',
    unit: 'Pack',
    packSize: 1,
    sellableUnit: 'Unit',
    costPrice: 0,
    sellingPrice: 0,
    category: '',
    manufacturer: '',
    nafdacNumber: '',
    barcodes: '',
    reorderLevel: 20,
    active: true,
  })
  const [drafts, setDrafts] = useState<MedicineDraft[]>([createBlank()])
  const [query, setQuery] = useState('')
  const [requestMedicineId, setRequestMedicineId] = useState('')
  const [requestQuantity, setRequestQuantity] = useState(1)
  const [cartOpen, setCartOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyDate, setHistoryDate] = useState('')
  const [cartItems, setCartItems] = useState<RequisitionCartItem[]>([])
  const [releaseQuantities, setReleaseQuantities] = useState<Record<string, number>>({})
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, number>>({})
  const [selectedRequisitionId, setSelectedRequisitionId] = useState('')
  const isEditing = drafts.length === 1 && Boolean(drafts[0].id)
  const stockCostTotals = useMemo(() => {
    const totals = new Map<string, number>()
    stockRows.forEach((row) => {
      totals.set(row.medicine.id, (totals.get(row.medicine.id) ?? 0) + Math.max(0, row.costValue))
    })
    return totals
  }, [stockRows])
  const totalCatalogCost = stockRows.reduce((sum, row) => sum + Math.max(0, row.costValue), 0)

  const visible = db.medicines.filter((medicine) => {
    const text = `${medicine.sku} ${medicine.brandName} ${medicine.genericName} ${medicine.form} ${medicine.strength} ${medicine.category} ${medicine.nafdacNumber} ${medicine.barcodes.join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })
  const requestableBranches = getActiveBranches(db).filter((branch) => branch.id !== activeBranch?.id && (isSuperAdmin(db, currentUser) || currentUser.branchIds.includes(branch.id) || currentUser.managedBranchIds.includes(branch.id)))
  const requestingBranch = requestableBranches[0]
  const requestMedicine = db.medicines.find((medicine) => medicine.id === requestMedicineId)
  const requestBatches = stockRows.filter((row) => row.medicine.id === requestMedicineId && row.quantity > 0 && row.daysToExpiry >= 0).sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))
  const requestBatch = requestBatches[0]
  const cartRows = cartItems.map((item) => {
    const medicine = db.medicines.find((entry) => entry.id === item.medicineId)
    const row = stockRows.find((entry) => entry.batch.id === item.batchId)
    return { ...item, medicine, row }
  })
  const visibleRequisitions = db.requisitions.filter((request) => {
    const involved = isSuperAdmin(db, currentUser) || request.requesterUserId === currentUser.id || canViewBranch(db, currentUser, request.sourceBranchId) || canViewBranch(db, currentUser, request.requestingBranchId)
    const dateMatches = !historyDate || request.createdAt.slice(0, 10) === historyDate
    return involved && dateMatches
  })
  const incomingRequisitions = db.requisitions.filter((request) => request.status === 'pending' && activeBranch && request.sourceBranchId === activeBranch.id && (isSuperAdmin(db, currentUser) || canViewBranch(db, currentUser, request.sourceBranchId)))
  const awaitingReceiptRequisitions = db.requisitions.filter((request) => request.status === 'released' && activeBranch && request.requestingBranchId === activeBranch.id && (isSuperAdmin(db, currentUser) || canViewBranch(db, currentUser, request.requestingBranchId)))
  const todaysRequisitions = visibleRequisitions
    .filter((request) => request.createdAt.slice(0, 10) === today())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const selectedRequisition = db.requisitions.find((request) => request.id === selectedRequisitionId)
  const autoPricingOn = pricingPolicy(db.settings).enabled
  const canOverrideAutoPricing = isSuperAdmin(db, currentUser)

  function openRequestModal(medicineId: string) {
    setRequestMedicineId(medicineId)
    setRequestQuantity(1)
  }

  function closeRequestModal() {
    setRequestMedicineId('')
    setRequestQuantity(1)
  }

  function addRequestItem() {
    if (!requestMedicine || !requestBatch) return
    if (!activeBranch || !requestingBranch) {
      flash('No requesting branch is available for your account')
      return
    }
    const quantity = Math.max(1, Math.min(Number(requestQuantity) || 1, requestBatch.quantity))
    setCartItems((current) => {
      const existing = current.find((item) => item.batchId === requestBatch.batch.id)
      if (existing) {
        return current.map((item) => item.batchId === requestBatch.batch.id ? { ...item, quantity } : item)
      }
      return [...current, { rowId: id('cart'), medicineId: requestMedicine.id, batchId: requestBatch.batch.id, quantity }]
    })
    flash(`${requestMedicine.brandName} added to requisition cart`)
    closeRequestModal()
  }

  function updateCartItem(rowId: string, quantity: number) {
    setCartItems((current) => current.map((item) => item.rowId === rowId ? { ...item, quantity: Math.max(1, quantity || 1) } : item))
  }

  function removeCartItem(rowId: string) {
    setCartItems((current) => current.filter((item) => item.rowId !== rowId))
  }

  function submitCart() {
    if (!activeBranch || !requestingBranch || !cartItems.length) return
    void executeAction('createRequisition', {
      sourceBranchId: activeBranch.id,
      requestingBranchId: requestingBranch.id,
      items: cartItems.map((item) => ({ medicineId: item.medicineId, batchId: item.batchId, quantity: item.quantity })),
    }, 'Requisition sent to supplying branch')
    setCartItems([])
    setCartOpen(false)
  }

  function requisitionItemAvailability(item: RequisitionItem) {
    return stockRows.find((row) => row.batch.id === item.batchId)?.quantity ?? 0
  }

  function defaultReleaseQuantity(item: RequisitionItem) {
    return Math.min(item.quantity, requisitionItemAvailability(item))
  }

  function getReleaseQuantity(item: RequisitionItem) {
    return releaseQuantities[item.id] ?? defaultReleaseQuantity(item)
  }

  function updateReleaseQuantity(item: RequisitionItem, quantity: number) {
    const maxRelease = Math.min(item.quantity, requisitionItemAvailability(item))
    setReleaseQuantities((current) => ({
      ...current,
      [item.id]: Math.max(0, Math.min(Number(quantity) || 0, maxRelease)),
    }))
  }

  function fulfillRequisition(request: Requisition) {
    const items = request.items.map((item) => ({ itemId: item.id, quantity: getReleaseQuantity(item) }))
    if (!items.some((item) => item.quantity > 0)) {
      flash('Release at least one item quantity before fulfilling this request')
      return
    }
    void executeAction('fulfillRequisition', { requestId: request.id, items }, 'Requisition released for receiving confirmation')
    setReleaseQuantities((current) => {
      const next = { ...current }
      request.items.forEach((item) => delete next[item.id])
      return next
    })
  }

  function releasedQuantity(item: RequisitionItem) {
    return item.releasedQuantity ?? item.fulfilledQuantity ?? 0
  }

  function getReceiveQuantity(item: RequisitionItem) {
    return receiveQuantities[item.id] ?? releasedQuantity(item)
  }

  function updateReceiveQuantity(item: RequisitionItem, quantity: number) {
    const maxReceive = releasedQuantity(item)
    setReceiveQuantities((current) => ({
      ...current,
      [item.id]: Math.max(0, Math.min(Number(quantity) || 0, maxReceive)),
    }))
  }

  function receiveRequisition(request: Requisition) {
    const items = request.items.map((item) => ({ itemId: item.id, quantity: getReceiveQuantity(item) }))
    if (!items.some((item) => item.quantity > 0)) {
      flash('Receive at least one released item quantity')
      return
    }
    void executeAction('receiveRequisition', { requestId: request.id, items }, 'Requisition received and stock added to branch')
    setReceiveQuantities((current) => {
      const next = { ...current }
      request.items.forEach((item) => delete next[item.id])
      return next
    })
    setSelectedRequisitionId('')
  }

  function rejectRequisition(requestId: string) {
    void executeAction('rejectRequisition', { requestId }, 'Requisition rejected')
  }

  function edit(medicine: Medicine) {
    setDrafts([{ ...medicine, rowId: id('row'), barcodes: medicine.barcodes.join(', ') }])
  }

  function updateDraft(rowId: string, updates: Partial<MedicineDraft>) {
    setDrafts((current) => current.map((draft) => (draft.rowId === rowId ? { ...draft, ...updates } : draft)))
  }

  function addDraft() {
    setDrafts((current) => [...current, createBlank()])
  }

  function removeDraft(rowId: string) {
    setDrafts((current) => current.length > 1 ? current.filter((draft) => draft.rowId !== rowId) : [createBlank()])
  }

  function resetDrafts() {
    setDrafts([createBlank()])
  }

  function draftToMedicine(draft: MedicineDraft): Medicine {
    return {
      id: draft.id || id('med'),
      sku: draft.sku.trim(),
      brandName: draft.brandName.trim(),
      genericName: draft.genericName.trim(),
      form: draft.form.trim() || 'Tablet',
      strength: draft.strength.trim(),
      unit: draft.unit.trim() || 'Pack',
      packSize: Math.max(1, Number(draft.packSize) || 1),
      sellableUnit: draft.sellableUnit.trim() || draft.unit.trim() || 'Unit',
      costPrice: Math.max(0, Number(draft.costPrice) || 0),
      sellingPrice: Math.max(0, Number(draft.sellingPrice) || 0),
      category: draft.category.trim(),
      manufacturer: draft.manufacturer.trim(),
      nafdacNumber: draft.nafdacNumber.trim(),
      barcodes: draft.barcodes.split(',').map((item) => item.trim()).filter(Boolean),
      reorderLevel: Number(draft.reorderLevel) || 0,
      active: draft.active,
    }
  }

  function getImportValue(row: Record<string, unknown>, names: string[]) {
    const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]/g, ''), value]))
    for (const name of names) {
      const value = normalized.get(name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      if (value !== undefined && value !== null) return String(value).trim()
    }
    return ''
  }

  async function importFile(file: File) {
    const rows = file.name.toLowerCase().endsWith('.csv') ? await readCsvFile(file) : await readWorkbookFile(file)
    const imported = rows
      .map((row) => ({
        ...createBlank(),
        sku: getImportValue(row, ['sku', 'medicine code', 'code']),
        brandName: getImportValue(row, ['brand name', 'brand', 'medicine', 'medicine name', 'product name']),
        genericName: getImportValue(row, ['generic name', 'generic']),
        form: getImportValue(row, ['form', 'dosage form', 'formulation']) || 'Tablet',
        strength: getImportValue(row, ['strength']),
        unit: getImportValue(row, ['container package', 'container unit', 'unit', 'pack unit', 'unit of measure', 'uom']) || 'Pack',
        packSize: Number(getImportValue(row, ['units per container', 'pack size', 'units per pack', 'quantity per pack'])) || 1,
        sellableUnit: getImportValue(row, ['sellable unit', 'least sellable unit', 'retail unit']) || 'Unit',
        costPrice: Number(getImportValue(row, ['cost price', 'cost', 'unit cost'])) || 0,
        sellingPrice: Number(getImportValue(row, ['selling price', 'sale price', 'retail price'])) || 0,
        category: getImportValue(row, ['category', 'class', 'therapeutic class']),
        manufacturer: getImportValue(row, ['manufacturer', 'maker']),
        nafdacNumber: getImportValue(row, ['nafdac number', 'nafdac no', 'nafdac registration number']),
        barcodes: getImportValue(row, ['barcodes', 'barcode', 'ean', 'code128']),
        reorderLevel: Number(getImportValue(row, ['reorder level', 'reorder', 'minimum stock', 'min stock'])) || 0,
        active: getImportValue(row, ['active', 'status']).toLowerCase() !== 'inactive',
      }))
      .filter((draft) => draft.sku || draft.brandName || draft.genericName)
    if (!imported.length) {
      flash('No medicine rows found in the uploaded file')
      return
    }
    setDrafts(imported)
    flash(`${imported.length} medicine row${imported.length > 1 ? 's' : ''} imported for review`)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    const records = drafts.map(draftToMedicine)
    if (records.some((record) => !record.sku || !record.brandName || !record.genericName)) {
      flash('SKU, brand name, and generic name are required for every row')
      return
    }
    if (records.some((record) => record.sellingPrice > 0 && record.sellingPrice < record.costPrice)) {
      flash('Selling price must be equal to or greater than cost price')
      return
    }
    const rowBarcodes = new Map<string, string>()
    for (const record of records) {
      for (const barcode of record.barcodes) {
        const previous = rowBarcodes.get(barcode)
        if (previous && previous !== record.id) {
          flash(`Barcode ${barcode} appears more than once`)
          return
        }
        rowBarcodes.set(barcode, record.id)
      }
    }
    const duplicateBarcode = db.medicines.find((medicine) => records.some((record) => medicine.id !== record.id && medicine.barcodes.some((code) => record.barcodes.includes(code))))
    if (duplicateBarcode) {
      flash(`Barcode already belongs to ${duplicateBarcode.brandName}`)
      return
    }
    const duplicateIdentity = db.medicines.find((medicine) => records.some((record) => medicine.id !== record.id && medicineDuplicateKey(medicine) === medicineDuplicateKey(record)))
    if (duplicateIdentity) {
      flash(`Likely duplicate medicine: ${duplicateIdentity.brandName} already matches this brand/generic/form/strength identity`)
      return
    }
    void executeAction(records.length === 1 ? 'upsertMedicine' : 'upsertMedicines', records.length === 1 ? { record: records[0], branchId: activeBranch?.id } : { records, branchId: activeBranch?.id }, `${records.length} medicine record${records.length > 1 ? 's' : ''} saved`)
    resetDrafts()
  }

  function updateMedicinePricing(medicine: Medicine, updates: Partial<Pick<Medicine, 'costPrice' | 'sellingPrice'>>) {
    if (!activeBranch || !canManagePrices) return
    const costPrice = updates.costPrice ?? medicine.costPrice
    const sellingPrice = updates.sellingPrice ?? medicine.sellingPrice
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      flash('Enter a valid cost price')
      return
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      flash('Enter a valid selling price')
      return
    }
    if (sellingPrice > 0 && sellingPrice < costPrice) {
      flash('Selling price must be equal to or greater than cost price')
      return
    }
    const overrideReason = autoPricingOn ? window.prompt('Auto pricing is enabled. Enter the admin override reason for this manual price change.')?.trim() : ''
    if (autoPricingOn && (!canOverrideAutoPricing || !overrideReason)) {
      flash('Auto pricing override requires the permanent admin and a reason')
      return
    }
    void executeAction('updateSellingPrice', {
      medicineId: medicine.id,
      branchId: activeBranch.id,
      costPrice,
      sellingPrice,
      overrideReason,
    }, `${medicine.brandName} pricing updated`)
  }

  function requisitionStatusLabel(status: RequisitionStatus) {
    if (status === 'pending') return 'Pending release'
    if (status === 'released') return 'Awaiting receipt'
    if (status === 'received' || status === 'fulfilled') return 'Received'
    return status[0].toUpperCase() + status.slice(1)
  }

  return (
    <div className="two-column">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Medicine Catalog</h2>
            <p>Capture NAFDAC number, barcode, dosage form, reorder level, and manufacturer.</p>
          </div>
          <div className="value-summary">
            <Archive size={17} />
            <strong>{activeBranch ? `${activeBranch.code} value` : 'Branch value'}</strong>
            <span>{money.format(totalCatalogCost)}</span>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalog" />
          </div>
          <button className="ghost-button cart-button" type="button" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={17} />
            {cartItems.length ? cartItems.length : 'Cart'}
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Category</th>
                <th>SKU</th>
                <th>NAFDAC</th>
                <th>Barcode</th>
                <th>Stock</th>
                <th>Cost / least unit</th>
                <th>Selling / least unit</th>
                <th>Cost value</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((medicine) => (
                  <tr key={medicine.id}>
                    <td>
                      <MedicineIdentity medicine={medicine} />
                    </td>
                    <td>{medicine.category || '-'}</td>
                    <td>{medicine.sku}</td>
                    <td>{medicine.nafdacNumber || '-'}</td>
                    <td>{medicine.barcodes[0] ?? '-'}</td>
                    <td>
                      <strong>{number.format(stockTotals.get(medicine.id) ?? 0)}</strong>
                      <span className="table-subtext">{sellableUnitLabel(medicine)}</span>
                    </td>
                    <td>
                      <input
                        className="table-price-input"
                        type="number"
                        min="0"
                        defaultValue={medicine.costPrice || ''}
                        onBlur={(event) => updateMedicinePricing(medicine, { costPrice: Number(event.currentTarget.value) || 0 })}
                        disabled={!canManagePrices || !activeBranch || (autoPricingOn && !canOverrideAutoPricing)}
                        aria-label={`Cost price per least sellable unit for ${medicine.brandName}`}
                      />
                    </td>
                    <td>
                      <input
                        className="table-price-input"
                        type="number"
                        min="0"
                        defaultValue={medicine.sellingPrice || getMedicineSellingPrice(stockRows, medicine.id) || ''}
                        onBlur={(event) => updateMedicinePricing(medicine, { sellingPrice: Number(event.currentTarget.value) || 0 })}
                        disabled={!canManagePrices || !activeBranch || (autoPricingOn && !canOverrideAutoPricing)}
                        aria-label={`Selling price per least sellable unit for ${medicine.brandName}`}
                      />
                    </td>
                    <td>{money.format(stockCostTotals.get(medicine.id) ?? 0)}</td>
                    <td><span className={medicine.active ? 'pill good' : 'pill muted'}>{medicine.active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-button" type="button" onClick={() => edit(medicine)} title="Edit medicine" disabled={!canWrite}>
                          <ClipboardList size={16} />
                        </button>
                        <button className="icon-button" type="button" onClick={() => openRequestModal(medicine.id)} title="Request from this branch" disabled={!activeBranch || !requestableBranches.length || (stockTotals.get(medicine.id) ?? 0) <= 0}>
                          <ShoppingCart size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={11}>No medicine records yet. Add the pharmacy catalog before receiving stock.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>{isEditing ? 'Edit Medicine' : 'Add Medicines'}</h2>
            <p>Add medicines one by one, use the plus button for multiple rows, or import a spreadsheet.</p>
          </div>
          <div className="button-row">
            <label className="file-button">
              <Upload size={16} />
              Import
              <input type="file" accept=".xlsx,.csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = '' }} disabled={!canWrite} />
            </label>
            <button className="ghost-button" type="button" onClick={addDraft} disabled={!canWrite || isEditing}>
              <Plus size={16} />
              Add row
            </button>
          </div>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <div className="line-editor full">
            {drafts.map((draft, index) => (
              <div className="line-card" key={draft.rowId}>
                <div className="line-card-heading">
                  <strong>{draft.id ? 'Editing existing medicine' : `Medicine ${index + 1}`}</strong>
                  <button className="icon-button" type="button" onClick={() => removeDraft(draft.rowId)} disabled={!canWrite} title="Remove medicine row">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>Brand name<input required value={draft.brandName} onChange={(event) => updateDraft(draft.rowId, { brandName: event.target.value })} disabled={!canWrite} /></label>
                  <label>Generic name<input required value={draft.genericName} onChange={(event) => updateDraft(draft.rowId, { genericName: event.target.value })} disabled={!canWrite} /></label>
                  <label>SKU<input required value={draft.sku} onChange={(event) => updateDraft(draft.rowId, { sku: event.target.value })} disabled={!canWrite} /></label>
                  <label>NAFDAC number<input value={draft.nafdacNumber} onChange={(event) => updateDraft(draft.rowId, { nafdacNumber: event.target.value })} disabled={!canWrite} /></label>
                  <label>Form<input value={draft.form} onChange={(event) => updateDraft(draft.rowId, { form: event.target.value })} disabled={!canWrite} /></label>
                  <label>Strength<input value={draft.strength} onChange={(event) => updateDraft(draft.rowId, { strength: event.target.value })} disabled={!canWrite} /></label>
                  <label>Container package<input value={draft.unit} onChange={(event) => updateDraft(draft.rowId, { unit: event.target.value })} placeholder="Pack, bottle, carton" disabled={!canWrite} /></label>
                  <label>Units per container<input type="number" min="1" value={numberInputValue(draft.packSize)} onChange={(event) => updateDraft(draft.rowId, { packSize: Number(event.target.value) })} disabled={!canWrite} /></label>
                  <label>Least sellable unit<input value={draft.sellableUnit} onChange={(event) => updateDraft(draft.rowId, { sellableUnit: event.target.value })} placeholder="Tablet, sachet, capsule" disabled={!canWrite} /></label>
                  <label>Cost price / least unit<input type="number" min="0" value={numberInputValue(draft.costPrice)} onChange={(event) => updateDraft(draft.rowId, { costPrice: Number(event.target.value) })} disabled={!canWrite || !canManagePrices} /></label>
                  <label>Selling price / least unit<input type="number" min="0" value={numberInputValue(draft.sellingPrice)} onChange={(event) => updateDraft(draft.rowId, { sellingPrice: Number(event.target.value) })} disabled={!canWrite || !canManagePrices || autoPricingOn} /></label>
                  <label>Category<input value={draft.category} onChange={(event) => updateDraft(draft.rowId, { category: event.target.value })} disabled={!canWrite} /></label>
                  <label>Manufacturer<input value={draft.manufacturer} onChange={(event) => updateDraft(draft.rowId, { manufacturer: event.target.value })} disabled={!canWrite} /></label>
                  <label>Reorder level<input type="number" min="0" value={numberInputValue(draft.reorderLevel)} onChange={(event) => updateDraft(draft.rowId, { reorderLevel: Number(event.target.value) })} disabled={!canWrite} /></label>
                  <label className="full">Barcodes<input value={draft.barcodes} onChange={(event) => updateDraft(draft.rowId, { barcodes: event.target.value })} disabled={!canWrite} /></label>
                  <label className="checkbox-row full"><input type="checkbox" checked={draft.active} onChange={(event) => updateDraft(draft.rowId, { active: event.target.checked })} disabled={!canWrite} /> Active medicine</label>
                </div>
              </div>
            ))}
          </div>
          <div className="form-actions full">
            <button className="ghost-button" type="button" onClick={resetDrafts}>Clear</button>
            <button className="primary-button" type="submit" disabled={!canWrite}>
              <PackageCheck size={17} />
              Save {drafts.length > 1 ? `${drafts.length} medicines` : 'medicine'}
            </button>
          </div>
        </form>
      </section>
      {requestMedicine && requestBatch && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel">
            <div className="section-heading">
              <div>
                <h2>Add to requisition cart</h2>
                <p>Requesting from {activeBranch?.name} into {requestingBranch?.name ?? 'your branch'}.</p>
              </div>
              <button className="icon-button" type="button" onClick={closeRequestModal} title="Close">
                <X size={17} />
              </button>
            </div>
            <div className="stack">
              <div className="availability">
                <MedicineIdentity medicine={requestMedicine} />
                <span>{requestBatch.batch.batchNumber} / expires {requestBatch.batch.expiryDate} / {number.format(requestBatch.quantity)} available</span>
              </div>
              <label>Quantity requested<input type="number" min="1" max={requestBatch.quantity} value={numberInputValue(requestQuantity)} onChange={(event) => setRequestQuantity(Number(event.target.value))} /></label>
              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={closeRequestModal}>Cancel</button>
                <button className="primary-button" type="button" onClick={addRequestItem}>
                  <ShoppingCart size={17} />
                  Add to cart
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {cartOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel wide">
            <div className="section-heading">
              <div>
                <h2>Requisition Cart</h2>
                <p>{activeBranch ? `Requests from ${activeBranch.name}` : 'Branch request cart'} are sent to the supplying branch team.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setCartOpen(false)} title="Close">
                <X size={17} />
              </button>
            </div>

            <section className="stack requisition-today-panel">
              <h3>Today's requisitions</h3>
              {todaysRequisitions.length ? todaysRequisitions.map((request) => (
                <button className="line-card requisition-summary-card" type="button" key={request.id} onClick={() => setSelectedRequisitionId(request.id)}>
                  <strong>{getBranchName(db, request.requestingBranchId)} from {getBranchName(db, request.sourceBranchId)}</strong>
                  <span>{requisitionStatusLabel(request.status)} / {request.items.length} item{request.items.length === 1 ? '' : 's'} / {new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <span>Requester: {getUserName(db, request.requesterUserId)} / Fulfiller: {getUserName(db, request.releasedBy ?? request.handledBy)} / Receiver: {getUserName(db, request.receivedBy)}</span>
                </button>
              )) : <div className="empty-state">No requisitions recorded today.</div>}
            </section>

            <div className="cart-layout">
              <section className="stack">
                <h3>Draft items</h3>
                {cartRows.length ? cartRows.map((item) => (
                  <article className="line-card" key={item.rowId}>
                    {item.medicine && <MedicineIdentity medicine={item.medicine} />}
                    <span>{item.row?.batch.batchNumber ?? item.batchId} / {item.row ? `${number.format(item.row.quantity)} available` : 'availability changed'}</span>
                    <div className="button-row">
                      <label>Qty<input type="number" min="1" max={item.row?.quantity ?? undefined} value={numberInputValue(item.quantity)} onChange={(event) => updateCartItem(item.rowId, Number(event.target.value))} /></label>
                      <button className="icon-button" type="button" onClick={() => removeCartItem(item.rowId)} title="Remove item">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                )) : <div className="empty-state">No draft request items yet.</div>}
                <div className="form-actions">
                  <button className="primary-button" type="button" onClick={submitCart} disabled={!cartItems.length || !requestingBranch}>
                    <Send size={17} />
                    Send request
                  </button>
                </div>
              </section>

              <section className="stack">
                <h3>Incoming requests</h3>
                {incomingRequisitions.length ? incomingRequisitions.map((request) => (
                  <article className="line-card" key={request.id}>
                    <button className="requisition-open-row" type="button" onClick={() => setSelectedRequisitionId(request.id)}>
                      <strong>{getBranchName(db, request.requestingBranchId)} request</strong>
                      <span>{new Date(request.createdAt).toLocaleString()} / requester: {getUserName(db, request.requesterUserId)}</span>
                    </button>
                    {request.items.map((item) => {
                      const medicine = db.medicines.find((entry) => entry.id === item.medicineId)
                      const batch = db.batches.find((entry) => entry.id === item.batchId)
                      const available = requisitionItemAvailability(item)
                      const maxRelease = Math.min(item.quantity, available)
                      return (
                        <div className="requisition-release-row" key={item.id}>
                          <span>
                            {medicine?.brandName ?? item.medicineId} / {batch?.batchNumber ?? item.batchId}
                            <small>Requested {number.format(item.quantity)} / available {number.format(available)} {medicine ? medicineSellableUnit(medicine) : 'least units'}</small>
                          </span>
                          <label>
                            Release qty
                            <input
                              type="number"
                              min="0"
                              max={maxRelease}
                              value={numberInputValue(getReleaseQuantity(item))}
                              onChange={(event) => updateReleaseQuantity(item, Number(event.target.value))}
                              disabled={!canFulfillActiveBranch}
                            />
                          </label>
                        </div>
                      )
                    })}
                    <div className="button-row">
                      <button className="primary-button" type="button" onClick={() => fulfillRequisition(request)} disabled={!canFulfillActiveBranch}>
                        <PackageCheck size={16} />
                        Release
                      </button>
                      <button className="ghost-button" type="button" onClick={() => rejectRequisition(request.id)} disabled={!canFulfillActiveBranch}>
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  </article>
                )) : <div className="empty-state">No incoming requests for this branch.</div>}
              </section>

              <section className="stack">
                <h3>Awaiting receipt</h3>
                {awaitingReceiptRequisitions.length ? awaitingReceiptRequisitions.map((request) => (
                  <button className="line-card requisition-summary-card" type="button" key={request.id} onClick={() => setSelectedRequisitionId(request.id)}>
                    <strong>{getBranchName(db, request.sourceBranchId)} released stock</strong>
                    <span>{request.items.length} item{request.items.length === 1 ? '' : 's'} / released by {getUserName(db, request.releasedBy ?? request.handledBy)}</span>
                    <span>Requester: {getUserName(db, request.requesterUserId)} / waiting for receiving confirmation</span>
                  </button>
                )) : <div className="empty-state">No released requisitions awaiting receipt.</div>}
              </section>
            </div>

            <div className="history-panel">
              <button className="ghost-button" type="button" onClick={() => setHistoryOpen((open) => !open)}>
                <FileText size={16} />
                {historyOpen ? 'Hide history' : 'Show history'}
              </button>
              {historyOpen && (
                <div className="stack">
                  <label>Date filter<input type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} /></label>
                  {visibleRequisitions.length ? visibleRequisitions.map((request) => (
                    <button className="line-card requisition-summary-card" type="button" key={request.id} onClick={() => setSelectedRequisitionId(request.id)}>
                      <strong>{getBranchName(db, request.requestingBranchId)} from {getBranchName(db, request.sourceBranchId)}</strong>
                      <span>{requisitionStatusLabel(request.status)} / {new Date(request.createdAt).toLocaleString()}</span>
                      {request.items.map((item) => {
                        const medicine = db.medicines.find((entry) => entry.id === item.medicineId)
                        return (
                          <span key={item.id}>
                            {medicine?.brandName ?? item.medicineId} / requested {number.format(item.quantity)}
                            {releasedQuantity(item) ? ` / released ${number.format(releasedQuantity(item))}` : ''}
                            {item.receivedQuantity !== undefined ? ` / received ${number.format(item.receivedQuantity)}` : ''}
                          </span>
                        )
                      })}
                    </button>
                  )) : <div className="empty-state">No requisition history for this filter.</div>}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {selectedRequisition && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-panel wide">
            <div className="section-heading">
              <div>
                <h2>Requisition details</h2>
                <p>{getBranchName(db, selectedRequisition.requestingBranchId)} from {getBranchName(db, selectedRequisition.sourceBranchId)} / {requisitionStatusLabel(selectedRequisition.status)}</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelectedRequisitionId('')} title="Close">
                <X size={17} />
              </button>
            </div>

            <div className="requisition-detail-grid">
              <div>
                <span>Requester</span>
                <strong>{getUserName(db, selectedRequisition.requesterUserId)}</strong>
                <small>{new Date(selectedRequisition.createdAt).toLocaleString()}</small>
              </div>
              <div>
                <span>Fulfiller</span>
                <strong>{getUserName(db, selectedRequisition.releasedBy ?? selectedRequisition.handledBy)}</strong>
                <small>{selectedRequisition.releasedAt || selectedRequisition.handledAt ? new Date(selectedRequisition.releasedAt ?? selectedRequisition.handledAt ?? '').toLocaleString() : 'Not released yet'}</small>
              </div>
              <div>
                <span>Receiver</span>
                <strong>{getUserName(db, selectedRequisition.receivedBy)}</strong>
                <small>{selectedRequisition.receivedAt ? new Date(selectedRequisition.receivedAt).toLocaleString() : 'Not received yet'}</small>
              </div>
              <div>
                <span>Branches</span>
                <strong>{getBranchName(db, selectedRequisition.requestingBranchId)}</strong>
                <small>Supplying: {getBranchName(db, selectedRequisition.sourceBranchId)}</small>
              </div>
            </div>

            <div className="stack">
              <h3>Items requested</h3>
              {selectedRequisition.items.map((item) => {
                const medicine = db.medicines.find((entry) => entry.id === item.medicineId)
                const batch = db.batches.find((entry) => entry.id === item.batchId)
                const canReceiveThis = selectedRequisition.status === 'released' && activeBranch?.id === selectedRequisition.requestingBranchId && canFulfillActiveBranch
                return (
                  <article className="requisition-detail-item" key={item.id}>
                    <div>
                      {medicine && <MedicineIdentity medicine={medicine} />}
                      {!medicine && <strong>{item.medicineId}</strong>}
                      <span>{batch?.batchNumber ?? item.batchId} / expires {batch?.expiryDate ?? 'not recorded'} / {batch?.location ?? 'source branch'}</span>
                    </div>
                    <dl>
                      <div><dt>Requested</dt><dd>{number.format(item.quantity)}</dd></div>
                      <div><dt>Released</dt><dd>{number.format(releasedQuantity(item))}</dd></div>
                      <div><dt>Received</dt><dd>{item.receivedQuantity !== undefined ? number.format(item.receivedQuantity) : '-'}</dd></div>
                    </dl>
                    {canReceiveThis && (
                      <label>
                        Confirm received
                        <input type="number" min="0" max={releasedQuantity(item)} value={numberInputValue(getReceiveQuantity(item))} onChange={(event) => updateReceiveQuantity(item, Number(event.target.value))} />
                      </label>
                    )}
                  </article>
                )
              })}
            </div>

            {selectedRequisition.note && <div className="audit-note">Note: {selectedRequisition.note}</div>}

            {selectedRequisition.status === 'released' && activeBranch?.id === selectedRequisition.requestingBranchId && (
              <div className="form-actions">
                <button className="ghost-button" type="button" onClick={() => setSelectedRequisitionId('')}>Close</button>
                <button className="primary-button" type="button" onClick={() => receiveRequisition(selectedRequisition)} disabled={!canFulfillActiveBranch}>
                  <PackageCheck size={17} />
                  Accept received stock
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Suppliers({ db, canWrite, executeAction }: { db: Database; canWrite: boolean; executeAction: ExecuteAction }) {
  const [form, setForm] = useState({ id: '', name: '', contact: '', address: '', licenseRef: '', active: true })

  function submit(event: FormEvent) {
    event.preventDefault()
    const record: Supplier = { ...form, id: form.id || id('sup') }
    void executeAction('upsertSupplier', { record }, 'Supplier saved')
    setForm({ id: '', name: '', contact: '', address: '', licenseRef: '', active: true })
  }

  return (
    <div className="two-column">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Supplier Register</h2>
            <p>Supplier license references support receiving traceability and compliance review.</p>
          </div>
        </div>
        <div className="supplier-grid">
          {db.suppliers.length ? (
            db.suppliers.map((supplier) => (
              <article className="supplier-card" key={supplier.id}>
                <Truck size={20} />
                <div>
                  <strong>{supplier.name}</strong>
                  <span>{supplier.contact || 'No contact recorded'}</span>
                  <span>{supplier.address || 'No address recorded'}</span>
                  <span>{supplier.licenseRef || 'No license reference'}</span>
                </div>
                <button className="icon-button" type="button" onClick={() => setForm(supplier)} disabled={!canWrite} title="Edit supplier">
                  <ClipboardList size={16} />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">No suppliers yet. Add approved suppliers before receiving stock.</div>
          )}
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>{form.id ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <p>Keep supplier records accurate for batch-level traceability.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label className="full">Supplier name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!canWrite} /></label>
          <label>Contact<input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} disabled={!canWrite} /></label>
          <label>License reference<input value={form.licenseRef} onChange={(event) => setForm({ ...form, licenseRef: event.target.value })} disabled={!canWrite} /></label>
          <label className="full">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} disabled={!canWrite} /></label>
          <label className="checkbox-row full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} disabled={!canWrite} /> Active supplier</label>
          <div className="form-actions full">
            <button className="primary-button" type="submit" disabled={!canWrite}>
              <Truck size={17} />
              Save supplier
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function ReceiveStock({ db, activeBranch, canWrite, executeAction, flash }: { db: Database; activeBranch: Branch; canWrite: boolean; executeAction: ExecuteAction; flash: (message: string) => void }) {
  type ReceiveLine = {
    rowId: string
    itemType: 'medicine' | 'product'
    itemId: string
    batchNumber: string
    expiryDate: string
    quantity: number
    unitCost: number
    sellingPrice: number
    location: string
  }
  type ReceiveReviewLine = ReceiveLine & {
    medicineId: string
    productId: string
    itemName: string
    unitLabel: string
    containers: number
    unitsPerContainer: number
    postedQuantity: number
    leastUnitCost: number
    calculatedSellingPrice: number
    markupPercent: number
    markupSource: string
    lineCost: number
    lineRetail: number
    warnings: string[]
  }
  const createLine = (): ReceiveLine => ({
    rowId: id('line'),
    itemType: 'medicine',
    itemId: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 1,
    unitCost: 0,
    sellingPrice: 0,
    location: 'Main Store',
  })
  const [scan, setScan] = useState('')
  const [header, setHeader] = useState({
    supplierId: '',
    invoiceRef: '',
  })
  const [lines, setLines] = useState<ReceiveLine[]>([createLine()])
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewLines, setReviewLines] = useState<ReceiveReviewLine[]>([])
  const selectedSupplierId = header.supplierId || db.suppliers[0]?.id || ''
  const hasReceivableItems = db.medicines.some((medicine) => medicine.active) || db.products.some((product) => product.active)
  const policy = pricingPolicy(db.settings)

  function lineUnitCost(line: Pick<ReceiveLine, 'itemType' | 'itemId' | 'unitCost'>) {
    if (line.itemType === 'product') return Math.max(0, Number(line.unitCost) || 0)
    const medicine = db.medicines.find((item) => item.id === line.itemId)
    return medicineUnitCostFromContainerCost(medicine, Number(line.unitCost))
  }

  function applyAutoPrice(line: ReceiveLine) {
    if (!policy.enabled || !line.itemId) return line
    const unitCost = lineUnitCost(line)
    return {
      ...line,
      sellingPrice: calculatedSellingPrice(db, line.itemType, line.itemId, unitCost).price,
    }
  }

  function updateLine(rowId: string, updates: Partial<ReceiveLine>) {
    setLines((current) => current.map((line) => (line.rowId === rowId ? applyAutoPrice({ ...line, ...updates }) : line)))
  }

  function itemPriceDefaults(itemType: ReceiveLine['itemType'], itemId: string) {
    if (itemType === 'product') {
      const product = db.products.find((item) => item.id === itemId)
      return { unitCost: product?.costPrice || 0, sellingPrice: product?.sellingPrice || 0 }
    }
    const medicine = db.medicines.find((item) => item.id === itemId)
    return {
      unitCost: medicine ? (medicine.costPrice || 0) * medicineUnitsPerContainer(medicine) : 0,
      sellingPrice: medicine?.sellingPrice || 0,
    }
  }

  function selectedMedicineForLine(line: ReceiveLine) {
    if (line.itemType !== 'medicine') return undefined
    return db.medicines.find((medicine) => medicine.id === line.itemId)
  }

  function receiveLineSummary(line: ReceiveLine) {
    const medicine = selectedMedicineForLine(line)
    if (!medicine) return undefined
    const containers = Math.max(0, Number(line.quantity) || 0)
    const unitsPerContainer = medicineUnitsPerContainer(medicine)
    const totalLeastUnits = containers * unitsPerContainer
    const unitCost = medicineUnitCostFromContainerCost(medicine, line.unitCost)
    return {
      containerPackage: medicineContainerPackage(medicine),
      leastUnit: medicineSellableUnit(medicine),
      totalLeastUnits,
      unitCost,
      unitsPerContainer,
    }
  }

  function selectItem(rowId: string, itemType: ReceiveLine['itemType'], itemId: string) {
    const defaults = itemPriceDefaults(itemType, itemId)
    setLines((current) => current.map((line) => (
      line.rowId === rowId
        ? applyAutoPrice({ ...line, itemType, itemId, unitCost: line.unitCost || defaults.unitCost, sellingPrice: line.sellingPrice || defaults.sellingPrice })
        : line
    )))
  }

  function addLine() {
    setLines((current) => [...current, createLine()])
  }

  function removeLine(rowId: string) {
    setLines((current) => current.length > 1 ? current.filter((line) => line.rowId !== rowId) : [createLine()])
  }

  function applyScan() {
    const match = findReceivableItem(db, scan)
    if (!match) {
      flash('No medicine or mart product found for that name, SKU, or barcode')
      return
    }
    setLines((current) => current.map((line, index) => {
      if (index !== current.length - 1) return line
      const defaults = itemPriceDefaults(match.itemType, match.itemId)
      return applyAutoPrice({ ...line, itemType: match.itemType, itemId: match.itemId, unitCost: line.unitCost || defaults.unitCost, sellingPrice: line.sellingPrice || defaults.sellingPrice })
    }))
    flash(`${match.label} selected`)
  }

  function buildReviewLines() {
    if (!selectedSupplierId || !hasReceivableItems || !activeBranch.id) {
      flash('Add at least one Pharmacy or Mart item, supplier, and branch before receiving stock')
      return []
    }
    const items = lines.map((line) => {
      const fallbackId = line.itemType === 'product' ? db.products.find((product) => product.active)?.id : db.medicines.find((medicine) => medicine.active)?.id
      const itemId = line.itemId || fallbackId || ''
      const item = line.itemType === 'product'
        ? db.products.find((product) => product.id === itemId)
        : db.medicines.find((medicine) => medicine.id === itemId)
      const unitCost = line.itemType === 'medicine'
        ? medicineUnitCostFromContainerCost(item as Medicine | undefined, Number(line.unitCost))
        : Math.max(0, Number(line.unitCost) || 0)
      const priceCalc = calculatedSellingPrice(db, line.itemType, itemId, unitCost)
      const sellingPrice = policy.enabled ? priceCalc.price : Math.max(0, Number(line.sellingPrice) || 0)
      const containers = Math.max(0, Number(line.quantity) || 0)
      const unitsPerContainer = line.itemType === 'medicine' ? medicineUnitsPerContainer(item as Medicine | undefined) : 1
      const postedQuantity = containers * unitsPerContainer
      const existingCost = item ? Math.max(0, Number(item.costPrice) || 0) : 0
      const costDelta = existingCost > 0 && unitCost > 0 ? Math.abs(unitCost - existingCost) / existingCost * 100 : 0
      const warnings = [
        sellingPrice > 0 && sellingPrice < unitCost ? 'Selling price is below cost' : '',
        priceCalc.markupPercent > policy.unusualMarkupPercent ? `Markup is above ${policy.unusualMarkupPercent}%` : '',
        costDelta > policy.costChangeWarningPercent ? `Cost changed ${Math.round(costDelta)}% from catalog cost` : '',
        line.itemType === 'medicine' && unitsPerContainer <= 1 && (item as Medicine | undefined)?.unit?.toLowerCase() !== (item as Medicine | undefined)?.sellableUnit?.toLowerCase() ? 'Units per container is 1; confirm package setup' : '',
      ].filter(Boolean)
      return {
        ...line,
        itemId,
        medicineId: line.itemType === 'medicine' ? itemId : '',
        productId: line.itemType === 'product' ? itemId : '',
        itemName: item ? (line.itemType === 'product' ? (item as Product).name : medicineOptionLabel(item as Medicine)) : 'Unknown item',
        unitLabel: line.itemType === 'medicine' ? medicineSellableUnit(item as Medicine | undefined) : (item as Product | undefined)?.unit || 'unit',
        containers,
        unitsPerContainer,
        postedQuantity,
        leastUnitCost: unitCost,
        sellingPrice,
        calculatedSellingPrice: priceCalc.price,
        markupPercent: priceCalc.markupPercent,
        markupSource: priceCalc.source,
        lineCost: postedQuantity * unitCost,
        lineRetail: postedQuantity * sellingPrice,
        warnings,
      }
    })
    if (items.some((line) => !line.itemId || Number(line.quantity) <= 0)) {
      flash('Item and quantity are required for every line')
      return []
    }
    if (items.some((line) => line.itemType === 'medicine' && (!line.batchNumber || !line.expiryDate))) {
      flash('Batch number and expiry date are required for medicines')
      return []
    }
    if (items.some((line) => line.expiryDate && line.expiryDate < today())) {
      flash('Receiving blocked: expiry date must be today or later')
      return []
    }
    if (items.some((line) => line.sellingPrice > 0 && line.sellingPrice < line.leastUnitCost)) {
      flash('Receiving blocked: selling price cannot be lower than unit cost')
      return []
    }
    return items
  }

  function postReviewedLines(items: ReceiveReviewLine[]) {
    void executeAction('receiveStock', {
      supplierId: selectedSupplierId,
      invoiceRef: header.invoiceRef,
      branchId: activeBranch.id,
      items,
    }, `${items.length} stock line${items.length > 1 ? 's' : ''} received and posted`)
    setHeader({ ...header, invoiceRef: '' })
    setLines([createLine()])
    setReviewLines([])
    setReviewOpen(false)
    setScan('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    const items = buildReviewLines()
    if (!items.length) return
    setReviewLines(items)
    setReviewOpen(true)
  }

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Goods Receiving Note</h2>
          <p>Posting into {activeBranch.name}. Switch branch from the top bar before receiving elsewhere.</p>
        </div>
        <button className="ghost-button" type="button" onClick={addLine} disabled={!canWrite}>
          <Plus size={16} />
          Add item
        </button>
      </div>
      {!canWrite && <div className="form-error">You only have view access in {activeBranch.name}. Ask the branch manager or an admin for posting access.</div>}
      <form className="form-grid" onSubmit={submit}>
        <label>Supplier<select required value={selectedSupplierId} onChange={(event) => setHeader({ ...header, supplierId: event.target.value })} disabled={!canWrite || !db.suppliers.length}><option value="">Select supplier</option>{db.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label>Invoice/reference<input value={header.invoiceRef} onChange={(event) => setHeader({ ...header, invoiceRef: event.target.value })} disabled={!canWrite} /></label>
        <label className="scan-field full">Search or scan item<div><Barcode size={17} /><input value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyScan() } }} placeholder="Search by item name, SKU, or barcode, then press Enter" disabled={!canWrite || !hasReceivableItems} /><button className="ghost-button" type="button" onClick={applyScan} disabled={!canWrite || !hasReceivableItems}><Search size={16} />Lookup</button></div></label>

        <div className="line-editor full">
          {lines.map((line, index) => {
            const medicineOptions = db.medicines.filter((medicine) => medicine.active)
            const productOptions = db.products.filter((product) => product.active)
            const selectedItemId = line.itemId || (line.itemType === 'product' ? productOptions[0]?.id : medicineOptions[0]?.id) || ''
            const hasItemOptions = line.itemType === 'product' ? productOptions.length > 0 : medicineOptions.length > 0
            const selectedMedicine = selectedMedicineForLine({ ...line, itemId: selectedItemId })
            const lineSummary = receiveLineSummary({ ...line, itemId: selectedItemId })
            return (
              <div className="line-card" key={line.rowId}>
                <div className="line-card-heading">
                  <strong>Invoice item {index + 1}</strong>
                  <button className="icon-button" type="button" onClick={() => removeLine(line.rowId)} disabled={!canWrite} title="Remove item">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label>Item class<select value={line.itemType} onChange={(event) => updateLine(line.rowId, { itemType: event.target.value as ReceiveLine['itemType'], itemId: '' })} disabled={!canWrite}><option value="medicine">Pharmacy</option><option value="product">Mart</option></select></label>
                  <label className="full">Item<select required value={selectedItemId} onChange={(event) => selectItem(line.rowId, line.itemType, event.target.value)} disabled={!canWrite || !hasItemOptions}><option value="">Select item</option>{line.itemType === 'product' ? productOptions.map((product) => <option key={product.id} value={product.id}>{product.name} / {product.sku}</option>) : medicineOptions.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicineOptionLabel(medicine)}</option>)}</select></label>
                  <label>Batch/Lot number<input required={line.itemType === 'medicine'} value={line.batchNumber} onChange={(event) => updateLine(line.rowId, { batchNumber: event.target.value })} placeholder={line.itemType === 'product' ? 'Optional for Mart items' : ''} disabled={!canWrite} /></label>
                  <label>Expiry date<input required={line.itemType === 'medicine'} type="date" value={line.expiryDate} onChange={(event) => updateLine(line.rowId, { expiryDate: event.target.value })} disabled={!canWrite} /></label>
                  <label>{line.itemType === 'medicine' ? `Containers received${selectedMedicine ? ` (${medicineContainerPackage(selectedMedicine)})` : ''}` : 'Quantity received'}<input required type="number" min="1" value={numberInputValue(line.quantity)} onChange={(event) => updateLine(line.rowId, { quantity: Number(event.target.value) })} disabled={!canWrite} /></label>
                  <label>{line.itemType === 'medicine' ? 'Cost per container' : 'Unit cost'}<input type="number" min="0" value={numberInputValue(line.unitCost)} onChange={(event) => updateLine(line.rowId, { unitCost: Number(event.target.value) })} disabled={!canWrite} /></label>
                  <label>{line.itemType === 'medicine' ? 'Selling price / least unit' : 'Selling price'}<input type="number" min="0" value={numberInputValue(line.sellingPrice)} onChange={(event) => updateLine(line.rowId, { sellingPrice: Number(event.target.value) })} disabled={!canWrite || policy.enabled} /></label>
                  <label>Stock location<input value={line.location} onChange={(event) => updateLine(line.rowId, { location: event.target.value })} disabled={!canWrite} /></label>
                  {lineSummary && (
                    <div className="receive-conversion-note full">
                      <div>
                        <strong>{number.format(line.quantity || 0)} {lineSummary.containerPackage} x {number.format(lineSummary.unitsPerContainer)} {lineSummary.leastUnit}</strong>
                        <span>= {number.format(lineSummary.totalLeastUnits)} {lineSummary.leastUnit} posted to stock</span>
                      </div>
                      <div>
                        <strong>{money.format(lineSummary.unitCost)}</strong>
                        <span>cost per {lineSummary.leastUnit}</span>
                      </div>
                      {policy.enabled && (
                        <div>
                          <strong>{money.format(calculatedSellingPrice(db, line.itemType, selectedItemId, lineSummary.unitCost).price)}</strong>
                          <span>auto selling price</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="form-actions full">
          <button className="ghost-button" type="button" onClick={addLine} disabled={!canWrite}>
            <Plus size={16} />
            Add another item
          </button>
          <button className="primary-button" type="submit" disabled={!canWrite || !hasReceivableItems || !db.suppliers.length}>
            <PackagePlus size={17} />
            Post {lines.length} item{lines.length > 1 ? 's' : ''}
          </button>
        </div>
      </form>
      {reviewOpen && (
        <div className="pos-modal-backdrop" role="presentation" onMouseDown={() => setReviewOpen(false)}>
          <section className="pos-modal-panel receive-review-modal" role="dialog" aria-modal="true" aria-labelledby="receive-review-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="pos-modal-header">
              <div>
                <span className="pos-modal-kicker">Calculation review</span>
                <h3 id="receive-review-title">Confirm goods receiving note</h3>
              </div>
              <button type="button" onClick={() => setReviewOpen(false)} aria-label="Close receive review"><X size={18} /></button>
            </header>
            <div className="receive-review-summary">
              <div><span>Invoice lines</span><strong>{number.format(reviewLines.length)}</strong></div>
              <div><span>Total units</span><strong>{number.format(reviewLines.reduce((sum, line) => sum + line.postedQuantity, 0))}</strong></div>
              <div><span>Cost value</span><strong>{money.format(reviewLines.reduce((sum, line) => sum + line.lineCost, 0))}</strong></div>
              <div><span>Retail value</span><strong>{money.format(reviewLines.reduce((sum, line) => sum + line.lineRetail, 0))}</strong></div>
            </div>
            {policy.enabled && (
              <div className="receive-review-policy">
                <Sparkles size={16} />
                Auto pricing is on. Selling prices below are calculated from least-unit cost, markup priority, and rounding.
              </div>
            )}
            {reviewLines.some((line) => line.warnings.length) && (
              <div className="receive-review-warnings">
                <AlertTriangle size={17} />
                <div>
                  <strong>{reviewLines.reduce((sum, line) => sum + line.warnings.length, 0)} warning{reviewLines.reduce((sum, line) => sum + line.warnings.length, 0) === 1 ? '' : 's'} need review</strong>
                  <span>Confirm the highlighted line values before posting stock.</span>
                </div>
              </div>
            )}
            <div className="receive-review-table table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty received</th>
                    <th>Posted units</th>
                    <th>Cost / unit</th>
                    <th>Markup</th>
                    <th>Selling / unit</th>
                    <th>Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewLines.map((line) => (
                    <tr key={line.rowId} className={line.warnings.length ? 'warn-row' : ''}>
                      <td>
                        <strong>{line.itemName}</strong>
                        <span className="table-subtext">{line.batchNumber || 'No batch'} / {line.expiryDate || 'No expiry'} / {line.location}</span>
                      </td>
                      <td>{number.format(line.containers)} {line.itemType === 'medicine' ? medicineContainerPackage(db.medicines.find((medicine) => medicine.id === line.itemId)) : line.unitLabel}</td>
                      <td>{number.format(line.postedQuantity)} {line.unitLabel}</td>
                      <td>{money.format(line.leastUnitCost)}</td>
                      <td>{line.markupPercent}% <span className="table-subtext">{line.markupSource}</span></td>
                      <td><strong>{money.format(line.sellingPrice)}</strong></td>
                      <td>{line.warnings.length ? line.warnings.map((warning) => <span className="warning-chip" key={warning}>{warning}</span>) : <span className="success-chip">Checked</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button className="ghost-button" type="button" onClick={() => setReviewOpen(false)}>Back to edit</button>
              <button className="primary-button" type="button" onClick={() => postReviewedLines(reviewLines)} disabled={!reviewLines.length}>
                <PackageCheck size={17} />
                Confirm and post stock
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

function IssueStock({
  db,
  activeBranch,
  stockRows,
  canWrite,
  executeAction,
  flash,
}: {
  db: Database
  activeBranch: Branch
  stockRows: StockRow[]
  canWrite: boolean
  executeAction: ExecuteAction
  flash: (message: string) => void
}) {
  const [scan, setScan] = useState('')
  const [form, setForm] = useState({
    medicineId: '',
    quantity: 1,
    reason: 'Dispense',
    reference: '',
  })
  const selectedBranchId = activeBranch.id
  const selectedMedicineId = form.medicineId || db.medicines[0]?.id || ''

  const availableBatches = stockRows
    .filter((row) => row.batch.branchId === selectedBranchId && row.medicine.id === selectedMedicineId && row.quantity > 0 && row.daysToExpiry >= 0)
    .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))
  const totalAvailable = availableBatches.reduce((sum, row) => sum + row.quantity, 0)
  const suggested = allocateFefo(availableBatches, Number(form.quantity))

  function applyScan() {
    const medicine = findMedicineByScan(db, scan)
    if (!medicine) {
      flash('No medicine found for scanned code')
      return
    }
    setForm((current) => ({ ...current, medicineId: medicine.id }))
    flash(`${medicineOptionLabel(medicine)} selected`)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const quantity = Number(form.quantity)
    if (!canWrite || quantity <= 0) return
    if (quantity > totalAvailable) {
      flash('Stock-out blocked: quantity exceeds available non-expired stock')
      return
    }
    void executeAction('issueStock', {
      medicineId: selectedMedicineId,
      branchId: selectedBranchId,
      quantity,
      reason: form.reason,
      reference: form.reference,
    }, 'Stock issued and FEFO ledger entries posted')
    setForm({ ...form, quantity: 1, reference: '' })
    setScan('')
  }

  return (
    <div className="two-column">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Stock Issue</h2>
            <p>Issuing from {activeBranch.name}. Expired batches are excluded and FEFO is applied.</p>
          </div>
        </div>
        {!canWrite && <div className="form-error">You only have view access in {activeBranch.name}. Ask the branch manager or an admin for stock-out access.</div>}
        <form className="form-grid" onSubmit={submit}>
          <label className="scan-field full">Scan barcode or SKU<div><Barcode size={17} /><input value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyScan() } }} placeholder="Scan, then press Enter" disabled={!canWrite || !db.medicines.length} /><button className="ghost-button" type="button" onClick={applyScan} disabled={!canWrite || !db.medicines.length}><Search size={16} />Lookup</button></div></label>
          <label className="full">Medicine<select required value={selectedMedicineId} onChange={(event) => setForm({ ...form, medicineId: event.target.value })} disabled={!canWrite || !db.medicines.length}><option value="">Select medicine</option>{db.medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicineOptionLabel(medicine)}</option>)}</select></label>
          <label>Quantity / least unit<input type="number" min="1" value={numberInputValue(form.quantity)} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={!canWrite} /></label>
          <label>Reason<select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} disabled={!canWrite}><option>Dispense</option><option>Internal use</option><option>Donation</option><option>Damage</option><option>Other</option></select></label>
          <label className="full">Reference note<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Receipt, request, or memo reference" disabled={!canWrite} /></label>
          <div className="availability full">
            <strong>{number.format(totalAvailable)}</strong>
            <span>available from non-expired batches in {getBranchName(db, selectedBranchId)}</span>
          </div>
          <div className="form-actions full">
            <button className="primary-button" type="submit" disabled={!canWrite || !selectedMedicineId || Number(form.quantity) > totalAvailable || totalAvailable <= 0}>
              <PackageMinus size={17} />
              Post stock-out
            </button>
          </div>
        </form>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>FEFO Allocation</h2>
            <p>These batches will be consumed in expiry order.</p>
          </div>
        </div>
        <StockTable rows={suggested.map((item) => ({ ...item.row, quantity: item.quantity }))} compact />
      </section>
    </div>
  )
}

function ProductsView({ db, canWrite, executeAction, flash }: { db: Database; canWrite: boolean; executeAction: ExecuteAction; flash: (message: string) => void }) {
  type ProductDraft = Omit<Product, 'barcodes'> & {
    barcodes: string
  }
  const createBlank = (): ProductDraft => ({
    id: '',
    sku: '',
    name: '',
    category: 'General retail',
    unit: 'Unit',
    costPrice: 0,
    sellingPrice: 0,
    quantity: 0,
    barcodes: '',
    supplierId: '',
    active: true,
    createdAt: new Date().toISOString(),
  })
  const [form, setForm] = useState<ProductDraft>(createBlank)
  const [query, setQuery] = useState('')
  const autoPricingOn = pricingPolicy(db.settings).enabled
  const visible = db.products
    .filter((product) => {
      const text = `${product.sku} ${product.name} ${product.category} ${product.unit} ${product.barcodes.join(' ')}`.toLowerCase()
      return text.includes(query.toLowerCase())
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  function edit(product: Product) {
    setForm({ ...product, barcodes: product.barcodes.join(', ') })
  }

  function reset() {
    setForm(createBlank())
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    const record: Product = {
      ...form,
      id: form.id || id('prd'),
      sku: form.sku.trim(),
      name: form.name.trim(),
      category: form.category.trim() || 'General retail',
      unit: form.unit.trim() || 'Unit',
      costPrice: Math.max(0, Number(form.costPrice) || 0),
      sellingPrice: autoPricingOn ? calculatedSellingPrice(db, 'product', form.id, Math.max(0, Number(form.costPrice) || 0)).price : Math.max(0, Number(form.sellingPrice) || 0),
      quantity: Math.max(0, Number(form.quantity) || 0),
      barcodes: form.barcodes.split(',').map((item) => item.trim()).filter(Boolean),
      supplierId: form.supplierId,
      createdAt: form.createdAt || new Date().toISOString(),
    }
    if (!record.sku || !record.name) {
      flash('SKU and product name are required')
      return
    }
    if (record.sellingPrice > 0 && record.sellingPrice < record.costPrice) {
      flash('Selling price must be equal to or greater than cost price')
      return
    }
    void executeAction('upsertProduct', { record }, `${record.name} saved`)
    reset()
  }

  return (
    <div className="two-column">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Retail Products</h2>
            <p>Non-medicinal items available for POS sale.</p>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
          </label>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>SKU</th>
                <th>Stock</th>
                <th>Cost</th>
                <th>Selling</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? visible.map((product) => (
                <tr key={product.id}>
                  <td>
                    <strong>{product.name}</strong>
                    <span className="table-subtext">{product.unit}</span>
                  </td>
                  <td>{product.category || '-'}</td>
                  <td>{product.sku}</td>
                  <td>{number.format(product.quantity)}</td>
                  <td>{money.format(product.costPrice)}</td>
                  <td>{money.format(product.sellingPrice)}</td>
                  <td><span className={product.active ? 'pill good' : 'pill muted'}>{product.active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="icon-button" type="button" onClick={() => edit(product)} disabled={!canWrite} title="Edit product">
                      <ClipboardList size={16} />
                    </button>
                  </td>
                </tr>
              )) : <tr><td colSpan={8}>No retail products yet. Add soaps, condoms, drinks, or other counter items here.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>{form.id ? 'Edit Product' : 'Add Product'}</h2>
            <p>Cost, selling price, and quantity feed directly into POS.</p>
          </div>
        </div>
        {!canWrite && <div className="form-error">You need pricing access to create or edit retail products.</div>}
        <form className="form-grid" onSubmit={submit}>
          <label className="full">Product name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={!canWrite} /></label>
          <label>SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} disabled={!canWrite} /></label>
          <label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} disabled={!canWrite} /></label>
          <label>Unit<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} disabled={!canWrite} /></label>
          <label>Quantity<input type="number" min="0" value={numberInputValue(form.quantity)} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={!canWrite} /></label>
          <label>Cost price<input type="number" min="0" value={numberInputValue(form.costPrice)} onChange={(event) => setForm({ ...form, costPrice: Number(event.target.value) })} disabled={!canWrite} /></label>
          <label>Selling price<input type="number" min="0" value={numberInputValue(autoPricingOn ? calculatedSellingPrice(db, 'product', form.id, Number(form.costPrice) || 0).price : form.sellingPrice)} onChange={(event) => setForm({ ...form, sellingPrice: Number(event.target.value) })} disabled={!canWrite || autoPricingOn} /></label>
          <label>Supplier<select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} disabled={!canWrite}><option value="">No supplier</option>{db.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label className="full">Barcodes<input value={form.barcodes} onChange={(event) => setForm({ ...form, barcodes: event.target.value })} disabled={!canWrite} placeholder="Comma-separated barcodes" /></label>
          <label className="checkbox-row full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} disabled={!canWrite} /> Active product</label>
          <div className="form-actions full">
            <button className="ghost-button" type="button" onClick={reset}>Clear</button>
            <button className="primary-button" type="submit" disabled={!canWrite}>
              <Boxes size={17} />
              Save product
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function POSView({
  db,
  currentUser,
  activeBranch,
  stockRows,
  canSell,
  executeAction,
  flash,
}: {
  db: Database
  currentUser: User
  activeBranch: Branch
  stockRows: StockRow[]
  canSell: boolean
  executeAction: ExecuteAction
  flash: (message: string) => void
}) {
  type CartItem = {
    rowId: string
    itemType: 'medicine' | 'product'
    itemId: string
    quantity: number
    daysSupply?: number
    counselingNote?: string
    labelInstruction?: string
  }
  type SaleOption = {
    itemType: 'medicine' | 'product'
    itemId: string
    title: string
    meta: string
    category: string
    available: number
    unitPrice: number
    scanCodes: string[]
  }
  const currentDraft = db.posDrafts.find((draft) => draft.userId === currentUser.id && draft.branchId === activeBranch.id && draft.expiresAt > new Date().toISOString())
  const [query, setQuery] = useState('')
  const [scan, setScan] = useState('')
  const [cart, setCart] = useState<CartItem[]>(() => currentDraft?.items.map((item) => ({
    rowId: id('pos'),
    itemType: item.itemType,
    itemId: item.itemId,
    quantity: item.quantity,
    daysSupply: item.daysSupply,
    counselingNote: item.counselingNote,
    labelInstruction: item.labelInstruction,
  })) ?? [])
  const [customerName, setCustomerName] = useState(currentDraft?.customerName ?? '')
  const [customerPhone, setCustomerPhone] = useState(currentDraft?.customerPhone ?? '')
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod']>(currentDraft?.paymentMethod ?? 'cash')
  const [discount, setDiscount] = useState(currentDraft?.discount ?? 0)
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount')
  const [cashPaid, setCashPaid] = useState(0)
  const [note, setNote] = useState(currentDraft?.note ?? '')
  const [followUpMessage, setFollowUpMessage] = useState(currentDraft?.followUpMessage ?? '')
  const [selectedDraftId, setSelectedDraftId] = useState(currentDraft?.id ?? '')
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyStartDate, setHistoryStartDate] = useState(today())
  const [historyEndDate, setHistoryEndDate] = useState(today())

  const stockByMedicine = useMemo(() => aggregateMedicineStock(stockRows.filter((row) => row.quantity > 0 && row.daysToExpiry >= 0)), [stockRows])
  const allSaleOptions: SaleOption[] = useMemo(() => [
    ...db.medicines
      .filter((medicine) => medicine.active && (stockByMedicine.get(medicine.id) ?? 0) > 0)
      .map((medicine) => {
        const batchPrice = stockRows
          .filter((row) => row.medicine.id === medicine.id && row.quantity > 0 && row.daysToExpiry >= 0)
          .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))[0]?.batch.sellingPrice ?? 0
        return {
          itemType: 'medicine' as const,
          itemId: medicine.id,
          title: medicine.brandName,
          meta: `${medicineMeta(medicine)} / ${sellableUnitLabel(medicine)}`,
          category: medicine.category || medicine.form || 'Medicines',
          available: stockByMedicine.get(medicine.id) ?? 0,
          unitPrice: medicine.sellingPrice || batchPrice,
          scanCodes: [medicine.sku, medicine.nafdacNumber, ...medicine.barcodes].filter(Boolean),
        }
      }),
    ...db.products
      .filter((product) => product.active && product.quantity > 0)
      .map((product) => ({
        itemType: 'product' as const,
        itemId: product.id,
        title: product.name,
        meta: `${product.category || 'Retail product'} / ${product.unit}`,
        category: product.category || 'Retail products',
        available: product.quantity,
        unitPrice: product.sellingPrice,
        scanCodes: [product.sku, ...product.barcodes].filter(Boolean),
      })),
  ], [db.medicines, db.products, stockByMedicine, stockRows])
  const branchSales = useMemo(() => db.sales
    .filter((sale) => sale.branchId === activeBranch.id)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt)), [activeBranch.id, db.sales])
  const frequentlySoldOptions = useMemo(() => {
    const totals = new Map<string, { quantity: number; lastSoldAt: string }>()
    branchSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const itemId = item.itemType === 'product' ? item.productId : item.medicineId
        if (!itemId) return
        const key = `${item.itemType}:${itemId}`
        const current = totals.get(key)
        totals.set(key, {
          quantity: (current?.quantity ?? 0) + item.quantity,
          lastSoldAt: current && current.lastSoldAt > sale.soldAt ? current.lastSoldAt : sale.soldAt,
        })
      })
    })
    return allSaleOptions
      .map((option) => ({ option, sales: totals.get(`${option.itemType}:${option.itemId}`) }))
      .filter((entry) => entry.sales && entry.option.available > 0)
      .sort((a, b) => (b.sales?.quantity ?? 0) - (a.sales?.quantity ?? 0) || (b.sales?.lastSoldAt ?? '').localeCompare(a.sales?.lastSoldAt ?? ''))
      .map((entry) => entry.option)
      .slice(0, 16)
  }, [allSaleOptions, branchSales])
  const saleOptions = allSaleOptions
    .filter((item) => {
      const text = `${item.title} ${item.meta} ${item.category} ${item.scanCodes.join(' ')}`.toLowerCase()
      return text.includes(query.toLowerCase())
    })
    .slice(0, 16)
  const visibleSaleOptions = query.trim() ? saleOptions : frequentlySoldOptions
  const cartRows = cart.map((item) => {
    const option = saleOptions.find((entry) => entry.itemType === item.itemType && entry.itemId === item.itemId)
      ?? makeSaleOption(item.itemType, item.itemId)
    const available = option?.available ?? 0
    const unitPrice = option?.unitPrice ?? 0
    return { ...item, option, available, unitPrice, lineTotal: item.quantity * unitPrice }
  })
  const subtotal = cartRows.reduce((sum, item) => sum + item.lineTotal, 0)
  const discountInput = Math.max(0, Number(discount) || 0)
  const safeDiscount = discountMode === 'percent' ? Math.min(subtotal, subtotal * Math.min(discountInput, 100) / 100) : Math.min(discountInput, subtotal)
  const maxDiscountPercent = discountLimitPercent(db, currentUser)
  const maxDiscountAmount = subtotal * (maxDiscountPercent / 100)
  const discountTooHigh = safeDiscount > maxDiscountAmount
  const total = Math.max(0, subtotal - safeDiscount)
  const changeDue = Math.max(0, (Number(cashPaid) || 0) - total)
  const filteredSales = branchSales.filter((sale) => {
    const soldDate = sale.soldAt.slice(0, 10)
    return (!historyStartDate || soldDate >= historyStartDate) && (!historyEndDate || soldDate <= historyEndDate)
  })
  const filteredSalesTotal = filteredSales.reduce((sum, sale) => sum + (sale.total ?? sale.subtotal), 0)
  const filteredSalesDiscount = filteredSales.reduce((sum, sale) => sum + (sale.discount ?? 0), 0)
  const filteredSalesItems = filteredSales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)
  const paymentTotals = filteredSales.reduce<Record<string, number>>((totals, sale) => {
    totals[sale.paymentMethod] = (totals[sale.paymentMethod] ?? 0) + (sale.total ?? sale.subtotal)
    return totals
  }, {})
  const branchDrafts = db.posDrafts
    .filter((draft) => draft.branchId === activeBranch.id && draft.expiresAt > new Date().toISOString())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const canCompleteSale = currentUser.role === 'cashier'
  const patientProfiles = useMemo(() => buildPatientProfiles(db, activeBranch.id), [activeBranch.id, db])
  const selectedPatient = useMemo(() => {
    const phone = normalizePhone(customerPhone)
    if (!phone) return undefined
    return patientProfiles.find((profile) => normalizePhone(profile.phone) === phone)
  }, [customerPhone, patientProfiles])
  const nameMatches = useMemo(() => {
    const queryText = customerName.trim().toLowerCase()
    if (queryText.length < 2) return []
    const activePhone = normalizePhone(customerPhone)
    return patientProfiles
      .filter((profile) => profile.name.toLowerCase().includes(queryText) && normalizePhone(profile.phone) !== activePhone)
      .slice(0, 5)
  }, [customerName, customerPhone, patientProfiles])
  const phoneMatches = useMemo(() => {
    const phone = normalizePhone(customerPhone)
    if (phone.length < 4) return []
    if (selectedPatient && normalizePhone(selectedPatient.phone) === phone) return []
    return patientProfiles
      .filter((profile) => normalizePhone(profile.phone).includes(phone))
      .slice(0, 5)
  }, [customerPhone, patientProfiles, selectedPatient])

  function defaultMedicinePrice(medicineId: string) {
    return stockRows
      .filter((row) => row.medicine.id === medicineId && row.quantity > 0 && row.daysToExpiry >= 0)
      .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))[0]?.batch.sellingPrice ?? 0
  }

  function makeSaleOption(itemType: CartItem['itemType'], itemId: string): SaleOption | undefined {
    if (itemType === 'product') {
      const product = db.products.find((item) => item.id === itemId)
      if (!product) return undefined
      return {
        itemType: 'product',
        itemId: product.id,
        title: product.name,
        meta: `${product.category || 'Retail product'} / ${product.unit}`,
        category: product.category || 'Retail products',
        available: product.quantity,
        unitPrice: product.sellingPrice,
        scanCodes: [product.sku, ...product.barcodes].filter(Boolean),
      }
    }
    const medicine = db.medicines.find((item) => item.id === itemId)
    if (!medicine) return undefined
    return {
      itemType: 'medicine',
      itemId: medicine.id,
      title: medicine.brandName,
      meta: `${medicineMeta(medicine)} / ${sellableUnitLabel(medicine)}`,
      category: medicine.category || medicine.form || 'Medicines',
      available: stockByMedicine.get(medicine.id) ?? 0,
      unitPrice: medicine.sellingPrice || defaultMedicinePrice(medicine.id),
      scanCodes: [medicine.sku, medicine.nafdacNumber, ...medicine.barcodes].filter(Boolean),
    }
  }

  function addItem(itemType: CartItem['itemType'], itemId: string) {
    const option = makeSaleOption(itemType, itemId)
    if (!option) return
    setCart((current) => {
      const existing = current.find((item) => item.itemType === itemType && item.itemId === itemId)
      if (existing) {
        return current.map((item) => item.rowId === existing.rowId ? { ...item, quantity: Math.min(item.quantity + 1, option.available || item.quantity + 1) } : item)
      }
      return [...current, {
        rowId: id('pos'),
        itemType,
        itemId,
        quantity: 1,
        daysSupply: itemType === 'medicine' ? 30 : undefined,
        labelInstruction: defaultLabelInstruction(db, itemType, itemId),
      }]
    })
    flash(`${option.title} added to POS cart`)
  }

  function applyScan() {
    const needle = scan.trim().toLowerCase()
    const option = allSaleOptions.find((item) => item.scanCodes.some((code) => code.toLowerCase() === needle))
    if (!option) {
      const medicine = findMedicineByScan(db, scan)
      if (medicine && (stockByMedicine.get(medicine.id) ?? 0) <= 0) {
        flash(`${medicine.brandName} has no non-expired stock in ${activeBranch.name}`)
        return
      }
      flash('No stocked medicine or product found for scanned code')
      return
    }
    if (option.available <= 0) {
      flash(`${option.title} is out of stock`)
      return
    }
    addItem(option.itemType, option.itemId)
    setScan('')
  }

  function optionTone(option: SaleOption) {
    if (option.itemType === 'medicine') {
      const medicine = db.medicines.find((item) => item.id === option.itemId)
      const earliest = stockRows
        .filter((row) => row.medicine.id === option.itemId && row.quantity > 0 && row.daysToExpiry >= 0)
        .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))[0]
      if (earliest && earliest.daysToExpiry <= db.settings.nearExpiryDays) return 'fefo'
      if (medicine && option.available <= medicine.reorderLevel) return 'low'
    }
    return ''
  }

  function optionInitials(title: string) {
    return title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'Rx'
  }

  const tillTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const vatIncluded = total > 0 ? total - (total / 1.075) : 0
  const suggestedFollowUpMessage = buildPurchaseFollowUpMessage(db, cart)

  function updateCart(rowId: string, updates: Partial<CartItem>) {
    setCart((current) => current.map((item) => {
      if (item.rowId !== rowId) return item
      const option = makeSaleOption(item.itemType, item.itemId)
      const available = option?.available ?? 0
      return {
        ...item,
        ...updates,
        quantity: Math.max(0, Math.min(Number(updates.quantity ?? item.quantity) || 0, available || 0)),
      }
    }))
  }

  function selectPatientProfile(profile: ReturnType<typeof buildPatientProfiles>[number]) {
    setCustomerName(profile.name === 'Walk-in patient' ? '' : profile.name)
    setCustomerPhone(profile.phone)
    flash(`${profile.name} selected for this sale`)
  }

  function salePayload() {
    return {
      branchId: activeBranch.id,
      draftId: selectedDraftId,
      customerName,
      customerPhone,
      paymentMethod,
      discount: safeDiscount,
      note,
      followUpMessage: followUpMessage.trim() || suggestedFollowUpMessage,
      items: cart.map((item) => ({
        itemType: item.itemType,
        itemId: item.itemId,
        quantity: item.quantity,
        daysSupply: item.daysSupply,
        counselingNote: item.counselingNote,
        labelInstruction: item.labelInstruction,
      })),
    }
  }

  async function saveDraft() {
    if (!canSell || !cart.length) return
    if (discountTooHigh) {
      flash(`Discount exceeds your ${maxDiscountPercent}% limit`)
      return
    }
    const saved = await executeAction('savePosDraft', salePayload(), 'POS cart saved as a 10-minute draft')
    if (saved) resetSaleForm()
  }

  function resetSaleForm() {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setDiscount(0)
    setCashPaid(0)
    setNote('')
    setFollowUpMessage('')
    setScan('')
    setSelectedDraftId('')
  }

  function clearCart() {
    resetSaleForm()
    flash('POS cart cleared')
  }

  function deleteDraft(draftId: string) {
    void executeAction('clearPosDraft', { branchId: activeBranch.id, draftId }, 'POS draft cleared')
    if (draftId === selectedDraftId) resetSaleForm()
  }

  function loadDraft(draft: PosDraft) {
    setSelectedDraftId(draft.id)
    setCart(draft.items.map((item) => ({
      rowId: id('pos'),
      itemType: item.itemType,
      itemId: item.itemId,
      quantity: item.quantity,
      daysSupply: item.daysSupply,
      counselingNote: item.counselingNote,
      labelInstruction: item.labelInstruction,
    })))
    setCustomerName(draft.customerName)
    setCustomerPhone(draft.customerPhone)
    setPaymentMethod(draft.paymentMethod)
    setDiscount(draft.discount)
    setDiscountMode('amount')
    setCashPaid(0)
    setNote(draft.note)
    setFollowUpMessage(draft.followUpMessage ?? '')
    setDraftsOpen(false)
    flash(`Draft ${draft.bookingCode} loaded`)
  }

  function buildMedicationLabels() {
    return cartRows
      .filter((item) => item.itemType === 'medicine' && item.option)
      .map((item) => {
        const medicine = db.medicines.find((entry) => entry.id === item.itemId)
        const instruction = item.labelInstruction?.trim() || (medicine ? defaultLabelInstruction(db, 'medicine', medicine.id) : '')
        return {
          medicineName: item.option?.title ?? medicine?.brandName ?? 'Medicine',
          medicineMeta: medicine ? [medicine.genericName, medicine.strength, medicine.form].filter(Boolean).join(' / ') : item.option?.meta ?? '',
          quantity: item.quantity,
          unit: medicine ? medicineSellableUnit(medicine) : 'unit',
          instruction,
        }
      })
      .filter((label) => label.instruction)
  }

  function printMedicationLabels(labels: ReturnType<typeof buildMedicationLabels>) {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) {
      flash('Medication labels are ready, but the browser blocked the print window')
      return
    }
    const patient = customerName.trim() || customerPhone.trim() || 'Walk-in patient'
    const labelCards = labels.map((label) => `
      <article>
        <header>
          <strong>${escapeHtml(db.settings.accountName)}</strong>
          <span>${escapeHtml(activeBranch.name)}</span>
        </header>
        <h2>${escapeHtml(label.medicineName)}</h2>
        <p class="meta">${escapeHtml(label.medicineMeta)}</p>
        <p><b>Patient:</b> ${escapeHtml(patient)}</p>
        <p><b>Qty:</b> ${number.format(label.quantity)} ${escapeHtml(label.unit)}</p>
        <p class="instruction">${escapeHtml(label.instruction)}</p>
      </article>
    `).join('')
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Medication labels</title>
          <style>
            body { color: #172024; font-family: Arial, sans-serif; margin: 16px; }
            .labels { display: grid; gap: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
            article { border: 1px solid #172024; border-radius: 8px; min-height: 210px; padding: 12px; page-break-inside: avoid; }
            header { border-bottom: 1px solid #d7e4e3; display: flex; justify-content: space-between; gap: 8px; margin-bottom: 8px; padding-bottom: 6px; }
            h2 { font-size: 18px; margin: 0 0 4px; }
            p { font-size: 12px; line-height: 1.35; margin: 5px 0; }
            .meta { color: #52636c; }
            .instruction { border-top: 1px solid #d7e4e3; font-size: 13px; margin-top: 8px; padding-top: 8px; }
            @media print { body { margin: 0; } button { display: none; } article { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()">Print labels</button>
          <section class="labels">${labelCards}</section>
          <script>window.setTimeout(() => window.print(), 300)</script>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canCompleteSale || !cart.length) return
    if (discountTooHigh) {
      flash(`Discount exceeds your ${maxDiscountPercent}% limit`)
      return
    }
    if (cartRows.some((item) => item.quantity < 1)) {
      flash('Enter a quantity for every POS item')
      return
    }
    if (cartRows.some((item) => item.quantity > item.available)) {
      flash('Sale blocked: one or more quantities exceed available stock')
      return
    }
    if (cartRows.some((item) => !item.option || item.unitPrice <= 0)) {
      flash('Every POS item needs a saved selling price')
      return
    }
    const labels = buildMedicationLabels()
    const completed = await executeAction('recordSale', salePayload(), 'Sale completed and inventory deducted')
    if (completed && labels.length) printMedicationLabels(labels)
    if (completed) resetSaleForm()
  }

  function printSalesHistory() {
    if (!filteredSales.length) return
    const period = `${historyStartDate || 'Start'} to ${historyEndDate || 'End'}`
    const rows = filteredSales.map((sale) => {
      const cashier = db.users.find((user) => user.id === sale.cashierUserId)?.name ?? 'Unknown'
      const items = sale.items.map((item) => `
        <li>${escapeHtml(item.itemName || item.medicineId || item.productId)} - ${number.format(item.quantity)} x ${money.format(item.unitPrice)} = ${money.format(item.lineTotal)}</li>
      `).join('')
      return `
        <article>
          <h3>${escapeHtml(sale.reference)} - ${money.format(sale.total ?? sale.subtotal)}</h3>
          <p>${new Date(sale.soldAt).toLocaleString()} | Cashier: ${escapeHtml(cashier)} | Payment: ${escapeHtml(sale.paymentMethod)}</p>
          <p>Customer: ${escapeHtml(sale.customerName || 'Walk-in customer')}${sale.customerPhone ? ` | ${escapeHtml(sale.customerPhone)}` : ''}</p>
          <ul>${items}</ul>
          <p>Discount: ${money.format(sale.discount || 0)} | Subtotal: ${money.format(sale.subtotal)} | Total: ${money.format(sale.total ?? sale.subtotal)}</p>
        </article>
      `
    }).join('')
    const paymentSummary = Object.entries(paymentTotals).map(([method, amount]) => `<li>${escapeHtml(method)}: ${money.format(amount)}</li>`).join('')
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>POS sales reconciliation</title>
          <style>
            body { color: #172024; font-family: Arial, sans-serif; margin: 32px; }
            header { border-bottom: 2px solid #006b45; margin-bottom: 18px; padding-bottom: 12px; }
            h1 { margin: 0 0 8px; }
            article { border-bottom: 1px solid #d7e4e3; padding: 14px 0; }
            h3 { margin: 0 0 6px; }
            p, li { font-size: 13px; }
            .summary { display: grid; gap: 8px; grid-template-columns: repeat(4, 1fr); margin: 18px 0; }
            .summary div { border: 1px solid #d7e4e3; border-radius: 8px; padding: 10px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <header>
            <h1>${escapeHtml(db.settings.accountName)} POS sales reconciliation</h1>
            <p>${escapeHtml(activeBranch.name)} | ${escapeHtml(period)}</p>
            <button onclick="window.print()">Print</button>
          </header>
          <section class="summary">
            <div><strong>${number.format(filteredSales.length)}</strong><br />sales</div>
            <div><strong>${number.format(filteredSalesItems)}</strong><br />items sold</div>
            <div><strong>${money.format(filteredSalesDiscount)}</strong><br />discount</div>
            <div><strong>${money.format(filteredSalesTotal)}</strong><br />total sales</div>
          </section>
          <h2>Payment totals</h2>
          <ul>${paymentSummary || '<li>No payment totals</li>'}</ul>
          ${rows}
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
  }

  return (
    <div className="pos-redesign">
      <div className="pos-window">
        <div className="pos-appbar">
          <div className="pos-appbar-left">
            <span className="pos-title-icon"><ShoppingCart size={15} /></span>
            <strong>Point of Sale</strong>
            <span className="pos-branch-meta">· {db.settings.accountName} / {activeBranch.name}</span>
          </div>
          <div className="pos-appbar-right">
            <span className="pos-shift-pill"><span /> Shift open · {currentUser.name}</span>
            <span className="pos-time-pill"><Clock3 size={13} /> {tillTime}</span>
            <button className="pos-icon-button" type="button" onClick={() => setHistoryOpen(true)} title="View sales history" aria-label="View sales history">
              <History size={16} />
            </button>
          </div>
        </div>

        {!canSell && <div className="form-error pos-access-error">You need cashier, pharmacist, branch manager, or admin access in {activeBranch.name} to use POS.</div>}

        <form className="pos-terminal-grid" onSubmit={submit}>
          <section className="pos-catalog-panel">
            <div className="pos-search-row">
              <label className="pos-search-control">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    setScan(event.target.value)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && scan.trim()) {
                      event.preventDefault()
                      applyScan()
                    }
                  }}
                  placeholder="Search product, batch or scan barcode..."
                  disabled={!canSell}
                />
              </label>
              <button className="pos-scan-button" type="button" onClick={applyScan} disabled={!canSell || !scan.trim()}>
                <ScanLine size={17} />
                Scan
              </button>
            </div>

            <div className="pos-quick-heading">
              <div>
                <strong>{query.trim() ? 'Search results' : 'Frequently sold items'}</strong>
                <span>{query.trim() ? 'Matching stocked Pharmacy and Mart items' : 'Based on real sales history and current stock availability'}</span>
              </div>
            </div>

            <div className="pos-catalog-grid">
              {visibleSaleOptions.map((option) => {
                const tone = optionTone(option)
                return (
                  <button className="pos-catalog-card" type="button" key={`${option.itemType}-${option.itemId}`} onClick={() => addItem(option.itemType, option.itemId)} disabled={!canSell || option.unitPrice <= 0}>
                    <div>
                      <strong>{option.title}</strong>
                      {tone === 'fefo' && <span className="pos-card-tag danger"><AlertTriangle size={11} /> FEFO</span>}
                      {tone === 'low' && <span className="pos-card-tag warn">Low</span>}
                    </div>
                    <small>{option.meta}</small>
                    <footer>
                      <span>{number.format(option.available)} in stock</span>
                      <b>{money.format(option.unitPrice)}</b>
                    </footer>
                  </button>
                )
              })}
              {!visibleSaleOptions.length && (
                <div className="empty-state">
                  {query.trim() ? 'No stocked medicines or retail products match this search.' : 'No frequently sold stocked items yet. Use search or scan to sell the first items.'}
                </div>
              )}
            </div>
          </section>

          <aside className="pos-sale-cart">
            <div className="pos-cart-header">
              <div>
                <h2>Sale cart</h2>
                <p><strong>{cart.length} item{cart.length === 1 ? '' : 's'}</strong> ready / FEFO batch auto-selected</p>
              </div>
              <button className="pos-draft-pill" type="button" onClick={() => setDraftsOpen(true)}>
                <FileText size={13} />
                Draft
                {branchDrafts.length > 0 && <b>{branchDrafts.length}</b>}
              </button>
            </div>

            <div className="pos-cart-lines">
              {cartRows.map((item) => (
                <div className="pos-line-item" key={item.rowId}>
                  <div className="pos-line-avatar">{optionInitials(item.option?.title ?? 'Rx')}</div>
                  <div className="pos-line-main">
                    <div className="pos-line-top">
                      <div>
                        <strong>{item.option?.title ?? 'Unknown item'}</strong>
                        {item.itemType === 'medicine' && <span className="pos-fefo-chip">FEFO</span>}
                        <small>{item.option?.meta ?? 'Unavailable item'} / {number.format(item.available)} avail.</small>
                      </div>
                      <button className="pos-line-remove" type="button" onClick={() => setCart((current) => current.filter((cartItem) => cartItem.rowId !== item.rowId))} title="Remove item" disabled={!canSell}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="pos-line-bottom">
                      <div className="pos-qty-stepper">
                        <button type="button" onClick={() => updateCart(item.rowId, { quantity: item.quantity - 1 })} disabled={!canSell || item.quantity <= 1}><Minus size={14} /></button>
                        <input aria-label="Quantity" type="number" min="1" max={item.available || 1} value={numberInputValue(item.quantity)} onChange={(event) => updateCart(item.rowId, { quantity: Number(event.target.value) })} disabled={!canSell} />
                        <button type="button" onClick={() => updateCart(item.rowId, { quantity: item.quantity + 1 })} disabled={!canSell || item.quantity >= item.available}><Plus size={14} /></button>
                      </div>
                      <div>
                        <small>{money.format(item.unitPrice)} / {number.format(item.available)} avail.</small>
                        <strong>{money.format(item.lineTotal)}</strong>
                      </div>
                    </div>
                    {item.itemType === 'medicine' && (
                      <div className="pos-care-fields">
                        <label>
                          <span>Therapy days</span>
                          <input type="number" min="0" value={numberInputValue(item.daysSupply)} onChange={(event) => updateCart(item.rowId, { daysSupply: Number(event.target.value) })} disabled={!canSell} />
                        </label>
                        <label>
                          <span>Medication label</span>
                          <textarea value={item.labelInstruction ?? ''} onChange={(event) => updateCart(item.rowId, { labelInstruction: event.target.value })} disabled={!canSell} rows={3} />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!cartRows.length && <div className="empty-state">Add medicines or products to begin a sale.</div>}
            </div>

            <div className="pos-customer-panel">
              <div className="pos-customer-field">
                <label htmlFor="pos-customer-name"><User2 size={15} /> Customer</label>
                <input id="pos-customer-name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Enter customer name" disabled={!canSell} />
                {nameMatches.length > 0 && (
                  <div className="pos-patient-suggestions">
                    {nameMatches.map((profile) => (
                      <button key={profile.key} type="button" onClick={() => selectPatientProfile(profile)} disabled={!canSell}>
                        <strong>{profile.name}</strong>
                        <span>{profile.phone} / {profile.sales.length} visit{profile.sales.length === 1 ? '' : 's'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="pos-customer-field">
                <label htmlFor="pos-customer-phone"><Phone size={15} /> Phone</label>
                <input id="pos-customer-phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Enter customer phone number" disabled={!canSell} />
                {phoneMatches.length > 0 && (
                  <div className="pos-patient-suggestions">
                    {phoneMatches.map((profile) => (
                      <button key={profile.key} type="button" onClick={() => selectPatientProfile(profile)} disabled={!canSell}>
                        <strong>{profile.name}</strong>
                        <span>{profile.phone} / last seen {new Date(profile.lastVisit).toLocaleDateString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedPatient && (
                <button className="pos-patient-snapshot" type="button" onClick={() => selectPatientProfile(selectedPatient)} disabled={!canSell}>
                  <strong>{selectedPatient.name}</strong>
                  <span>{selectedPatient.phone} / {selectedPatient.sales.length} previous visit{selectedPatient.sales.length === 1 ? '' : 's'} / last seen {new Date(selectedPatient.lastVisit).toLocaleDateString()}</span>
                </button>
              )}
              <div className="pos-payment-block">
                <span><Wallet size={15} /> Payment method</span>
                <div>
                  {[
                    { value: 'cash' as const, label: 'Cash', icon: Wallet },
                    { value: 'card' as const, label: 'Card', icon: CreditCard },
                    { value: 'transfer' as const, label: 'Transfer', icon: Smartphone },
                  ].map(({ value, label, icon: Icon }) => (
                    <button className={paymentMethod === value ? 'active' : ''} key={value} type="button" onClick={() => setPaymentMethod(value)} disabled={!canSell}>
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                <span><Percent size={15} /> Discount</span>
                <div className="pos-discount-control">
                  <input type="number" min="0" max={discountMode === 'percent' ? 100 : subtotal} value={numberInputValue(discount)} onChange={(event) => setDiscount(Number(event.target.value))} disabled={!canSell} />
                  <button className={discountMode === 'amount' ? 'active' : ''} type="button" onClick={() => setDiscountMode('amount')} disabled={!canSell}>{String.fromCharCode(8358)}</button>
                  <button className={discountMode === 'percent' ? 'active' : ''} type="button" onClick={() => setDiscountMode('percent')} disabled={!canSell}>%</button>
                </div>
                <small className={discountTooHigh ? 'discount-limit-note danger' : 'discount-limit-note'}>Limit: {maxDiscountPercent}% / {money.format(maxDiscountAmount)}</small>
              </label>
              <label>
                <span><Wallet size={15} /> Cash paid</span>
                <input type="number" min="0" value={numberInputValue(cashPaid)} onChange={(event) => setCashPaid(Number(event.target.value))} placeholder="Enter amount paid" disabled={!canSell} />
              </label>
              <label>
                <span><StickyNote size={15} /> Note</span>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add optional sale note" disabled={!canSell} />
              </label>
              <label className="full">
                <span><MessageSquare size={15} /> Purchase follow-up</span>
                <textarea value={followUpMessage} onChange={(event) => setFollowUpMessage(event.target.value)} placeholder={suggestedFollowUpMessage || 'One follow-up message for this purchase'} disabled={!canSell} rows={3} />
              </label>
              {suggestedFollowUpMessage && (
                <div className="pos-followup-suggestion">
                  <span>{suggestedFollowUpMessage}</span>
                  <button type="button" onClick={() => setFollowUpMessage(suggestedFollowUpMessage)} disabled={!canSell}>Use suggested</button>
                </div>
              )}
            </div>

            <div className="pos-total-panel">
              <div><span>Subtotal</span><strong>{money.format(subtotal)}</strong></div>
              <div><span>Discount</span><strong>-{money.format(safeDiscount)}</strong></div>
              <div><span>VAT (incl.)</span><strong>{money.format(vatIncluded)}</strong></div>
              <hr />
              <section>
                <div>
                  <span>Total due</span>
                  <strong>{money.format(total)}</strong>
                </div>
                <div>
                  <span>Change</span>
                  <strong>{money.format(changeDue)}</strong>
                </div>
              </section>
            </div>

            <div className="pos-action-row">
              <button type="button" onClick={saveDraft} disabled={!canSell || !cartRows.length || subtotal <= 0}>
                <Save size={16} />
                Draft
              </button>
              <button type="button" onClick={clearCart} disabled={!canSell || !cartRows.length}>
                <XCircle size={16} />
                Clear
              </button>
              <button className="complete" type="submit" disabled={!canCompleteSale || !cartRows.length || total <= 0} title={canCompleteSale ? 'Complete sale' : 'Only cashiers can complete sales'}>
                <CheckCircle2 size={17} />
                Complete sale
                <span>Enter</span>
              </button>
            </div>
            {canSell && !canCompleteSale && (
              <div className="pos-cashier-note">Only cashiers can complete sales. Save the cart as a draft for cashier checkout.</div>
            )}
          </aside>
        </form>
      </div>

      {historyOpen && (
        <div className="pos-modal-backdrop" role="presentation" onMouseDown={() => setHistoryOpen(false)}>
          <section className="pos-modal-panel pos-history-modal" role="dialog" aria-modal="true" aria-labelledby="sales-history-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="pos-modal-header">
              <div>
                <span className="pos-modal-kicker">POS audit</span>
                <h3 id="sales-history-title">Sales history</h3>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)} aria-label="Close sales history"><X size={18} /></button>
            </header>
            <div className="pos-modal-filter pos-period-filter">
              <label>
                <span>Start date</span>
                <input type="date" value={historyStartDate} onChange={(event) => setHistoryStartDate(event.target.value)} />
              </label>
              <label>
                <span>End date</span>
                <input type="date" value={historyEndDate} onChange={(event) => setHistoryEndDate(event.target.value)} />
              </label>
              <button type="button" onClick={printSalesHistory} disabled={!filteredSales.length}>
                <Printer size={15} />
                Print
              </button>
            </div>
            <div className="pos-sales-summary">
              <div><span>Sales</span><strong>{number.format(filteredSales.length)}</strong></div>
              <div><span>Items sold</span><strong>{number.format(filteredSalesItems)}</strong></div>
              <div><span>Discount</span><strong>{money.format(filteredSalesDiscount)}</strong></div>
              <div><span>Total</span><strong>{money.format(filteredSalesTotal)}</strong></div>
            </div>
            <div className="pos-payment-summary">
              {Object.entries(paymentTotals).map(([method, amount]) => <span key={method}>{method}: <strong>{money.format(amount)}</strong></span>)}
              {!Object.keys(paymentTotals).length && <span>No sales in this period</span>}
            </div>
            <div className="pos-modal-list">
              {filteredSales.map((sale) => (
                <article className="sale-history-item" key={sale.id}>
                  <div>
                    <strong>{money.format(sale.total ?? sale.subtotal)} / {sale.paymentMethod}</strong>
                    <span>{new Date(sale.soldAt).toLocaleString()} / Ref {sale.reference}{sale.bookingCode ? ` / Draft ${sale.bookingCode}` : ''} / Cashier {getUserName(db, sale.cashierUserId)}</span>
                  </div>
                  <span>{sale.customerName || 'Walk-in customer'}{sale.customerPhone ? ` / ${sale.customerPhone}` : ''}</span>
                  <ul>
                    {sale.items.map((item, index) => (
                      <li key={`${sale.id}-${index}`}>{item.itemName || item.medicineId || item.productId}: {number.format(item.quantity)} x {money.format(item.unitPrice)} = {money.format(item.lineTotal)}</li>
                    ))}
                  </ul>
                  {sale.discount > 0 && <small>Discount: {money.format(sale.discount)}</small>}
                </article>
              ))}
              {!filteredSales.length && <div className="empty-state">No sales recorded for this period.</div>}
            </div>
          </section>
        </div>
      )}

      {draftsOpen && (
        <div className="pos-modal-backdrop" role="presentation" onMouseDown={() => setDraftsOpen(false)}>
          <section className="pos-modal-panel pos-drafts-modal" role="dialog" aria-modal="true" aria-labelledby="pos-drafts-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="pos-modal-header">
              <div>
                <span className="pos-modal-kicker">Temporary carts</span>
                <h3 id="pos-drafts-title">Draft carts</h3>
              </div>
              <button type="button" onClick={() => setDraftsOpen(false)} aria-label="Close draft carts"><X size={18} /></button>
            </header>
            <div className="pos-modal-list">
              {branchDrafts.map((draft) => {
                const draftTotal = draft.items.reduce((sum, item) => {
                  const option = makeSaleOption(item.itemType, item.itemId)
                  return sum + ((option?.unitPrice ?? 0) * item.quantity)
                }, 0)
                return (
                  <article className="pos-draft-item" key={draft.id}>
                    <div>
                      <strong>Draft {draft.bookingCode}</strong>
                      <span>{draft.customerName || 'Walk-in customer'}{draft.customerPhone ? ` / ${draft.customerPhone}` : ''}</span>
                      <small>{draft.items.length} item{draft.items.length === 1 ? '' : 's'} / expires {new Date(draft.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <b>{money.format(draftTotal)}</b>
                    <footer>
                      <button type="button" onClick={() => loadDraft(draft)}>Load</button>
                      <button type="button" onClick={() => deleteDraft(draft.id)}>Clear</button>
                    </footer>
                  </article>
                )
              })}
              {!branchDrafts.length && <div className="empty-state">No active POS drafts for this branch.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function PatientsView({ db, activeBranch, flash }: { db: Database; activeBranch?: Branch; flash: (message: string) => void }) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const branchId = activeBranch?.id
  const profiles = useMemo(() => buildPatientProfiles(db, branchId), [branchId, db])
  const refillRows = useMemo(() => buildRefillRows(db, branchId), [branchId, db])
  const dueRows = refillRows.filter((row) => row.daysUntilDue <= 7)
  const overdueRows = refillRows.filter((row) => row.daysUntilDue < 0)
  const chronicPatients = profiles.filter((profile) => {
    const medicineSaleCount = profile.sales.reduce((sum, sale) => sum + sale.items.filter((item) => item.itemType === 'medicine' && item.daysSupply).length, 0)
    return medicineSaleCount >= 2 || profile.sales.length >= 3
  })
  const careQueue = [
    { label: 'Overdue refills', value: overdueRows.length, tone: 'danger', detail: 'Patients whose therapy window has already passed.' },
    { label: 'Due this week', value: dueRows.filter((row) => row.daysUntilDue >= 0).length, tone: 'warning', detail: 'Patients to call or message before they miss a refill.' },
    { label: 'Chronic relationship list', value: chronicPatients.length, tone: 'good', detail: 'Repeat patients worth retaining with consistent follow-up.' },
  ]
  const filteredProfiles = profiles.filter((profile) => {
    const text = `${profile.name} ${profile.phone} ${profile.sales.map((sale) => sale.reference).join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })
  const selectedProfile = filteredProfiles.find((profile) => profile.key === selectedKey) ?? filteredProfiles[0]
  const selectedMessages = selectedProfile?.sales
    .map((sale) => ({
      sale,
      body: saleFollowUpBody(db, sale),
    }))
    .filter((message) => message.body) ?? []

  async function copyMessage(message: string) {
    try {
      await navigator.clipboard.writeText(message)
      flash('Patient message copied')
    } catch {
      flash(message)
    }
  }

  return (
    <div className="page-grid patients-page">
      <section className="metric-grid">
        <Metric icon={Users} label="Known patients" value={compactNumber(profiles.length)} />
        <Metric icon={Bell} label="Refills due soon" value={compactNumber(dueRows.length)} tone={dueRows.length ? 'warning' : 'good'} />
        <Metric icon={MessageSquare} label="Follow-up notes" value={compactNumber(selectedMessages.length)} />
        <Metric icon={Phone} label="Phone-linked records" value={compactNumber(profiles.filter((profile) => profile.phone).length)} />
      </section>

      <section className="patient-care-queue">
        {careQueue.map((item) => (
          <article className={`care-queue-card ${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{compactNumber(item.value)}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Patient Lookup</h2>
            <p>Search by phone, name, or receipt reference from POS sales history.</p>
          </div>
          {activeBranch && <span className="pill active">{activeBranch.name}</span>}
        </div>
        <label className="patient-search">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patient phone, name, or receipt..." />
        </label>
        <div className="patients-layout">
          <div className="patient-list">
            {filteredProfiles.map((profile) => (
              <button className={profile.key === selectedProfile?.key ? 'patient-list-item active' : 'patient-list-item'} key={profile.key} type="button" onClick={() => setSelectedKey(profile.key)}>
                <strong>{profile.name}</strong>
                <span>{profile.phone || 'No phone saved'} / {profile.sales.length} visit{profile.sales.length === 1 ? '' : 's'}</span>
                <small>Last seen {new Date(profile.lastVisit).toLocaleDateString()} / {money.format(profile.totalSpent)}</small>
              </button>
            ))}
            {!filteredProfiles.length && <div className="empty-state">No patient records match this search yet.</div>}
          </div>

          <div className="patient-profile-panel">
            {selectedProfile ? (
              <>
                <header className="patient-profile-header">
                  <div>
                    <span className="eyebrow">Patient profile</span>
                    <h2>{selectedProfile.name}</h2>
                    <p>{selectedProfile.phone || 'Phone number not recorded'} / {selectedProfile.sales.length} visit{selectedProfile.sales.length === 1 ? '' : 's'}</p>
                  </div>
                  <strong>{money.format(selectedProfile.totalSpent)}</strong>
                </header>

                <div className="patient-profile-grid">
                  <section>
                    <h3>Medication History</h3>
                    <div className="patient-timeline">
                      {selectedProfile.sales.map((sale) => (
                        <article key={sale.id}>
                          <div>
                            <strong>{new Date(sale.soldAt).toLocaleDateString()} / {sale.reference}</strong>
                            <span>{sale.items.length} item{sale.items.length === 1 ? '' : 's'} / {money.format(sale.total ?? sale.subtotal)}</span>
                          </div>
                          <ul>
                            {sale.items.map((item, index) => (
                              <li key={`${sale.id}-${index}`}>
                                {getSaleItemLabel(db, item)} / Qty {number.format(item.quantity)}
                                {item.daysSupply ? ` / ${item.daysSupply} therapy day${item.daysSupply === 1 ? '' : 's'}` : ''}
                                {item.refillDueAt ? ` / refill ${formatDate(item.refillDueAt)}` : ''}
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3>Follow-up Messages</h3>
                    <div className="patient-message-list">
                      {selectedMessages.map(({ sale, body }) => {
                        const message = patientCareMessage(db.settings.accountName, selectedProfile.name, body)
                        const href = whatsappHref(selectedProfile.phone, message)
                        return (
                          <article key={sale.id}>
                            <strong>{new Date(sale.soldAt).toLocaleDateString()} / {sale.reference}</strong>
                            <p>{message}</p>
                            <footer>
                              <button type="button" onClick={() => { void copyMessage(message) }}><ClipboardList size={14} /> Copy</button>
                              {href && <a href={href} target="_blank" rel="noreferrer"><Smartphone size={14} /> WhatsApp</a>}
                            </footer>
                          </article>
                        )
                      })}
                      {!selectedMessages.length && <div className="empty-state">No counseling messages captured for this patient yet.</div>}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="empty-state">Select a patient to see their medication history and follow-up messages.</div>
            )}
          </div>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Refill Reminders</h2>
            <p>Generated from medicines sold with therapy days recorded at checkout.</p>
          </div>
          <span className="pill warning">{dueRows.length} due within 7 days</span>
        </div>
        <div className="patient-reminder-list">
          {dueRows.map((row) => {
            const message = refillMessage(db.settings.accountName, row)
            const href = whatsappHref(row.phone, message)
            return (
              <article key={`${row.profileKey}-${row.item.medicineId}-${row.sale.id}`}>
                <div>
                  <strong>{row.patientName}</strong>
                  <span>{row.medicineName} / refill {formatDate(row.refillDueAt)} / {row.daysUntilDue < 0 ? `${Math.abs(row.daysUntilDue)} day${Math.abs(row.daysUntilDue) === 1 ? '' : 's'} overdue` : `${row.daysUntilDue} day${row.daysUntilDue === 1 ? '' : 's'} left`}</span>
                  <small>{row.phone || 'No phone saved'}</small>
                </div>
                <footer>
                  <button type="button" onClick={() => { void copyMessage(message) }}><ClipboardList size={14} /> Copy</button>
                  {href && <a href={href} target="_blank" rel="noreferrer"><Smartphone size={14} /> WhatsApp</a>}
                </footer>
              </article>
            )
          })}
          {!dueRows.length && <div className="empty-state">No refill reminders due in the next 7 days.</div>}
        </div>
      </section>
    </div>
  )
}

function allocateFefo(rows: StockRow[], quantity: number) {
  let remaining = quantity
  const allocation: Array<{ row: StockRow; quantity: number }> = []
  for (const row of rows) {
    if (remaining <= 0) break
    const take = Math.min(row.quantity, remaining)
    allocation.push({ row, quantity: take })
    remaining -= take
  }
  return allocation
}

function Adjustments({ activeBranch, stockRows, canAdjust, executeAction, flash }: { activeBranch: Branch; stockRows: StockRow[]; canAdjust: boolean; executeAction: ExecuteAction; flash: (message: string) => void }) {
  const positiveRows = stockRows.filter((row) => row.quantity > 0)
  const [form, setForm] = useState({
    batchId: '',
    mode: 'write-off' as LedgerType,
    quantity: 1,
    reason: '',
    reference: '',
  })
  const selectedBatchId = form.batchId || positiveRows[0]?.batch.id || ''
  const selected = stockRows.find((row) => row.batch.id === selectedBatchId)
  const isPositive = form.mode === 'adjustment' || form.mode === 'customer-return'

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canAdjust || !selected) return
    if (!isPositive && Number(form.quantity) > selected.quantity) {
      flash('Adjustment blocked: cannot reduce more than available stock')
      return
    }
    void executeAction('adjustStock', {
      batchId: selected.batch.id,
      mode: form.mode,
      quantity: Number(form.quantity),
      reason: form.reason,
      reference: form.reference,
    }, 'Adjustment posted')
    setForm({ ...form, quantity: 1, reference: '', reason: '' })
  }

  return (
    <section className="content-section narrow">
      <div className="section-heading">
        <div>
          <h2>Adjustments and Returns</h2>
          <p>Posting adjustments for {activeBranch.name}. All corrections require a reason.</p>
        </div>
      </div>
      {!canAdjust && <div className="form-error">You only have view access in {activeBranch.name}, or your role cannot post adjustments.</div>}
      <form className="form-grid" onSubmit={submit}>
        <label className="full">Batch<select required value={selectedBatchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} disabled={!canAdjust || !positiveRows.length}><option value="">Select batch</option>{positiveRows.map((row) => <option key={row.batch.id} value={row.batch.id}>{medicineOptionLabel(row.medicine)} / {row.batch.batchNumber} / Qty {medicineStockLabel(row.medicine, row.quantity)}</option>)}</select></label>
        <label>Transaction type<select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as LedgerType })} disabled={!canAdjust}><option value="write-off">Write-off</option><option value="supplier-return">Supplier return</option><option value="customer-return">Customer return</option><option value="adjustment">Positive adjustment</option></select></label>
        <label>Quantity / least unit<input type="number" min="1" value={numberInputValue(form.quantity)} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={!canAdjust} /></label>
        <label className="full">Reason<textarea required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} disabled={!canAdjust} /></label>
        <label className="full">Reference<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} disabled={!canAdjust} /></label>
        {selected && <div className="availability full"><MedicineIdentity medicine={selected.medicine} /><span>{selected.batch.batchNumber} / available {medicineStockLabel(selected.medicine, selected.quantity)} / expires {selected.batch.expiryDate}</span></div>}
        <div className="form-actions full">
          <button className="primary-button" type="submit" disabled={!canAdjust || !selected}>
            <RotateCcw size={17} />
            Post entry
          </button>
        </div>
      </form>
    </section>
  )
}

function Reports({ db, stockRows, stockTotals, activeBranch }: { db: Database; stockRows: StockRow[]; stockTotals: Map<string, number>; activeBranch?: Branch }) {
  const [report, setReport] = useState<'stock' | 'movement' | 'supplier' | 'expiry' | 'reorder'>('stock')
  const [stockItemType, setStockItemType] = useState<'medicine' | 'product'>('medicine')
  const [movementItemType, setMovementItemType] = useState<'medicine' | 'product'>('medicine')
  const [movementStartDate, setMovementStartDate] = useState('')
  const [movementEndDate, setMovementEndDate] = useState('')
  const [movementType, setMovementType] = useState('')
  const [medicineFilter, setMedicineFilter] = useState('')
  const [genericFilter, setGenericFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [supplierDate, setSupplierDate] = useState('')
  const categories = useMemo(() => {
    const source = report === 'stock'
      ? stockItemType === 'medicine'
        ? db.medicines.map((medicine) => medicine.category)
        : db.products.map((product) => product.category)
      : report === 'movement'
        ? movementItemType === 'medicine'
          ? db.medicines.map((medicine) => medicine.category)
          : db.products.map((product) => product.category)
        : [...db.medicines.map((medicine) => medicine.category), ...db.products.map((product) => product.category)]
    return Array.from(new Set(source.filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [db.medicines, db.products, movementItemType, report, stockItemType])

  const rows: ReportRow[] = useMemo(() => {
    const scopedBatchIds = new Set(stockRows.map((row) => row.batch.id))
    const scopedBranchIds = new Set(activeBranch ? [activeBranch.id] : db.branches.filter((branch) => branch.active).map((branch) => branch.id))
    if (report === 'movement') {
      return db.ledger
        .filter((entry) => movementItemType === 'product' ? entry.itemType === 'product' : entry.itemType !== 'product')
        .filter((entry) => entry.itemType === 'product' ? scopedBranchIds.has(entry.toBranchId || entry.fromBranchId || '') : scopedBatchIds.has(entry.batchId))
        .filter((entry) => {
          const medicine = entry.itemType === 'product' ? undefined : db.medicines.find((item) => item.id === entry.medicineId)
          const product = entry.itemType === 'product' ? db.products.find((item) => item.id === entry.productId) : undefined
          const itemName = medicine?.brandName ?? product?.name ?? ''
          const genericName = medicine?.genericName ?? ''
          const category = medicine?.category || product?.category || ''
          const semanticType = entry.reason === 'POS sale' ? 'pos' : entry.reason.startsWith('Internal requisition') ? 'internal-transfer' : entry.type
          const entryDate = entry.createdAt.slice(0, 10)
          return (!movementStartDate || entryDate >= movementStartDate) &&
            (!movementEndDate || entryDate <= movementEndDate) &&
            (!movementType || semanticType === movementType) &&
            (!medicineFilter || itemName.toLowerCase().includes(medicineFilter.toLowerCase())) &&
            (!genericFilter || genericName.toLowerCase().includes(genericFilter.toLowerCase())) &&
            (!categoryFilter || category === categoryFilter)
        })
        .map((entry) => {
          const product = entry.itemType === 'product' ? db.products.find((item) => item.id === entry.productId) : undefined
          const medicine = entry.itemType === 'product' ? undefined : db.medicines.find((item) => item.id === entry.medicineId)
          const batch = entry.itemType === 'product' ? undefined : db.batches.find((item) => item.id === entry.batchId)
          const user = db.users.find((item) => item.id === entry.userId)
          const supplier = batch ? db.suppliers.find((item) => item.id === batch.supplierId) : undefined
          const branchName = getBranchName(db, batch?.branchId ?? entry.toBranchId ?? entry.fromBranchId ?? 'main')
          const from = entry.fromBranchId ? getBranchName(db, entry.fromBranchId) : entry.type === 'stock-in' ? supplier?.name ?? 'Supplier' : entry.type === 'customer-return' ? 'Customer' : branchName
          const to = entry.toBranchId ? getBranchName(db, entry.toBranchId) : entry.type === 'supplier-return' ? supplier?.name ?? 'Supplier' : entry.type === 'stock-out' ? entry.reason : entry.type === 'write-off' ? 'Write-off' : branchName
          const sale = entry.reason === 'POS sale' ? db.sales.find((item) => item.reference === entry.reference) : undefined
          const saleItem = sale?.items.find((item) => entry.itemType === 'product' ? item.productId === entry.productId : item.medicineId === entry.medicineId && (!item.batchId || item.batchId === entry.batchId))
          const semanticType = entry.reason === 'POS sale' ? 'POS' : entry.reason.startsWith('Internal requisition') ? 'Internal Transfer' : movementLabels[entry.type]
          const unitPrice = saleItem?.unitPrice ?? entry.sellingPrice ?? 0
          const salesValue = entry.reason === 'POS sale' ? Math.abs(entry.quantity) * unitPrice : 0
          return {
            Date: new Date(entry.createdAt).toLocaleString(),
            Type: semanticType,
            'Item type': entry.itemType === 'product' ? 'Mart' : 'Pharmacy',
            Medicine: medicine ? medicineReportName(medicine) : product?.name ?? entry.productId ?? 'Unknown',
            Generic: medicine?.genericName ?? '-',
            Form: medicine?.form ?? product?.unit ?? '-',
            Strength: medicine?.strength ?? '-',
            Category: medicine?.category || product?.category || '-',
            Batch: batch?.batchNumber ?? entry.batchNumber ?? '-',
            Unit: medicine ? medicineSellableUnit(medicine) : product?.unit ?? '-',
            Branch: branchName,
            From: from,
            To: to,
            Quantity: entry.quantity,
            'Unit Price': unitPrice || '-',
            'Sales Value': salesValue || '-',
            Reason: entry.reason,
            Reference: entry.reference,
            User: user?.name ?? 'Unknown',
          }
        })
    }
    if (report === 'supplier') {
      return db.receipts
        .filter((receipt) => (!supplierFilter || db.suppliers.find((supplier) => supplier.id === receipt.supplierId)?.name === supplierFilter) && (!supplierDate || receipt.receivedAt.slice(0, 10) === supplierDate))
        .flatMap((receipt) => receipt.items.map((item) => {
          const batch = item.itemType === 'product' ? undefined : db.batches.find((entry) => entry.id === item.batchId)
          const medicine = item.itemType === 'product' ? undefined : db.medicines.find((entry) => entry.id === item.medicineId)
          const product = item.itemType === 'product' ? db.products.find((entry) => entry.id === item.productId) : undefined
          const supplier = db.suppliers.find((entry) => entry.id === receipt.supplierId)
          return {
            Date: new Date(receipt.receivedAt).toLocaleString(),
            Supplier: supplier?.name ?? receipt.supplierId,
            Invoice: receipt.invoiceRef,
            'Item type': item.itemType === 'product' ? 'Mart' : 'Pharmacy',
            Medicine: medicine?.brandName ?? product?.name ?? item.medicineId ?? item.productId,
            Generic: medicine?.genericName ?? '-',
            Form: medicine?.form ?? product?.unit ?? '-',
            Strength: medicine?.strength ?? '-',
            Category: medicine?.category || product?.category || '-',
            Batch: batch?.batchNumber ?? item.batchNumber ?? item.batchId,
            Expiry: batch?.expiryDate ?? item.expiryDate ?? '-',
            Unit: medicine ? medicineSellableUnit(medicine) : product?.unit ?? '-',
            Quantity: item.quantity,
            'Cost / Least Unit': item.unitCost,
            Branch: getBranchName(db, batch?.branchId ?? item.branchId ?? 'main'),
          }
        }))
    }
    if (report === 'expiry') {
      return stockRows
        .filter((row) => row.quantity > 0)
        .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))
        .map((row) => ({
          Medicine: row.medicine.brandName,
          Generic: row.medicine.genericName,
          Form: row.medicine.form,
          Strength: row.medicine.strength,
          Category: row.medicine.category || '-',
          Batch: row.batch.batchNumber,
          Expiry: row.batch.expiryDate,
          Days: row.daysToExpiry,
          Unit: medicineSellableUnit(row.medicine),
          Quantity: row.quantity,
          Status: row.status,
          Branch: row.branch?.name ?? row.batch.branchId,
          Location: row.batch.location,
        }))
    }
    if (report === 'reorder') {
      return db.medicines
        .filter((medicine) => (stockTotals.get(medicine.id) ?? 0) <= medicine.reorderLevel)
        .map((medicine) => ({
          SKU: medicine.sku,
          Medicine: medicine.brandName,
          Generic: medicine.genericName,
          Form: medicine.form,
          Strength: medicine.strength,
          Category: medicine.category || '-',
          Unit: medicineSellableUnit(medicine),
          Available: stockTotals.get(medicine.id) ?? 0,
          'Reorder Level': medicine.reorderLevel,
          Manufacturer: medicine.manufacturer,
        }))
    }
    if (stockItemType === 'product') {
      return db.products
        .filter((product) => product.active)
        .filter((product) => (
          (!medicineFilter || product.name.toLowerCase().includes(medicineFilter.toLowerCase()) || product.sku.toLowerCase().includes(medicineFilter.toLowerCase())) &&
          (!categoryFilter || product.category === categoryFilter)
        ))
        .map((product) => {
          const supplier = db.suppliers.find((item) => item.id === product.supplierId)
          return {
            SKU: product.sku,
            Product: product.name,
            Category: product.category || '-',
            Unit: product.unit,
            Quantity: product.quantity,
            'Unit Cost': product.costPrice,
            'Selling Price': product.sellingPrice,
            'Cost Value': product.quantity * product.costPrice,
            Supplier: supplier?.name ?? '-',
            Branch: activeBranch?.name ?? 'Mart register',
            Status: product.active ? 'Active' : 'Inactive',
          }
        })
    }
    return stockRows
      .filter((row) => (
        (!medicineFilter || row.medicine.brandName.toLowerCase().includes(medicineFilter.toLowerCase()) || row.medicine.sku.toLowerCase().includes(medicineFilter.toLowerCase())) &&
        (!genericFilter || row.medicine.genericName.toLowerCase().includes(genericFilter.toLowerCase())) &&
        (!categoryFilter || row.medicine.category === categoryFilter)
      ))
      .map((row) => ({
        SKU: row.medicine.sku,
        Medicine: row.medicine.brandName,
        Generic: row.medicine.genericName,
        Form: row.medicine.form,
        Strength: row.medicine.strength,
        Category: row.medicine.category || '-',
        Batch: row.batch.batchNumber,
        Expiry: row.batch.expiryDate,
        Unit: medicineSellableUnit(row.medicine),
        Quantity: row.quantity,
        'Cost / Least Unit': row.batch.unitCost,
        'Cost Value': row.costValue,
        Supplier: row.supplier?.name ?? '-',
        Branch: row.branch?.name ?? row.batch.branchId,
        Location: row.batch.location,
      }))
  }, [activeBranch, categoryFilter, db, genericFilter, medicineFilter, movementEndDate, movementItemType, movementStartDate, movementType, report, stockItemType, stockRows, stockTotals, supplierDate, supplierFilter])
  const movementQuantityTotal = report === 'movement' ? rows.reduce((sum, row) => sum + Number(row.Quantity ?? 0), 0) : 0
  const movementUnitsMoved = report === 'movement' ? rows.reduce((sum, row) => sum + Math.abs(Number(row.Quantity ?? 0)), 0) : 0
  const movementSalesTotal = report === 'movement' ? rows.reduce((sum, row) => sum + (Number(row['Sales Value']) || 0), 0) : 0
  const stockQuantityTotal = report === 'stock' ? rows.reduce((sum, row) => sum + Number(row.Quantity ?? 0), 0) : 0
  const stockCostTotal = report === 'stock' ? rows.reduce((sum, row) => sum + Number(row['Cost Value'] ?? 0), 0) : 0

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Reports and Exports</h2>
          <p>CSV export and browser print cover spreadsheet and PDF workflows.</p>
        </div>
        <div className="button-row">
          <button className="ghost-button" type="button" onClick={() => exportCsv(`${report}-report.csv`, rows)} disabled={!rows.length}>
            <Download size={16} />
            CSV
          </button>
          <button className="ghost-button" type="button" onClick={() => window.print()}>
            <Printer size={16} />
            Print/PDF
          </button>
        </div>
      </div>
      <div className="tabs">
        <button className={report === 'stock' ? 'active' : ''} onClick={() => setReport('stock')} type="button">Stock on hand</button>
        <button className={report === 'movement' ? 'active' : ''} onClick={() => setReport('movement')} type="button">Movement ledger</button>
        <button className={report === 'supplier' ? 'active' : ''} onClick={() => setReport('supplier')} type="button">Supplier</button>
        <button className={report === 'expiry' ? 'active' : ''} onClick={() => setReport('expiry')} type="button">Expiry</button>
        <button className={report === 'reorder' ? 'active' : ''} onClick={() => setReport('reorder')} type="button">Reorder</button>
      </div>
      {report === 'movement' && (
        <>
          <div className="report-mode-switch">
            <button className={movementItemType === 'medicine' ? 'active' : ''} type="button" onClick={() => { setMovementItemType('medicine'); setCategoryFilter(''); setMedicineFilter(''); setGenericFilter('') }}>
              <Pill size={16} />
              Pharmacy
            </button>
            <button className={movementItemType === 'product' ? 'active' : ''} type="button" onClick={() => { setMovementItemType('product'); setCategoryFilter(''); setMedicineFilter(''); setGenericFilter('') }}>
              <Boxes size={16} />
              Mart
            </button>
          </div>
          <div className="report-filters">
            <label>Start date<input type="date" value={movementStartDate} onChange={(event) => setMovementStartDate(event.target.value)} /></label>
            <label>End date<input type="date" value={movementEndDate} onChange={(event) => setMovementEndDate(event.target.value)} /></label>
            <label>Type<select value={movementType} onChange={(event) => setMovementType(event.target.value)}><option value="">All types</option>{movementFilterOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>{movementItemType === 'medicine' ? 'Brand' : 'Product'}<input value={medicineFilter} onChange={(event) => setMedicineFilter(event.target.value)} placeholder={movementItemType === 'medicine' ? 'Brand name' : 'Product name'} /></label>
            {movementItemType === 'medicine' && <label>Generic<input value={genericFilter} onChange={(event) => setGenericFilter(event.target.value)} placeholder="Generic name" /></label>}
            <label>Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          </div>
        </>
      )}
      {report === 'stock' && (
        <>
          <div className="report-mode-switch">
            <button className={stockItemType === 'medicine' ? 'active' : ''} type="button" onClick={() => { setStockItemType('medicine'); setCategoryFilter(''); setMedicineFilter(''); setGenericFilter('') }}>
              <Pill size={16} />
              Pharmacy
            </button>
            <button className={stockItemType === 'product' ? 'active' : ''} type="button" onClick={() => { setStockItemType('product'); setCategoryFilter(''); setMedicineFilter(''); setGenericFilter('') }}>
              <Boxes size={16} />
              Mart
            </button>
          </div>
          <div className="report-filters">
            <label>{stockItemType === 'medicine' ? 'Brand' : 'Product'}<input value={medicineFilter} onChange={(event) => setMedicineFilter(event.target.value)} placeholder={stockItemType === 'medicine' ? 'Brand name or SKU' : 'Product name or SKU'} /></label>
            {stockItemType === 'medicine' && <label>Generic<input value={genericFilter} onChange={(event) => setGenericFilter(event.target.value)} placeholder="Generic name" /></label>}
            <label>Category<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          </div>
          <div className="report-summary">
            <Archive size={16} />
            <strong>{number.format(stockQuantityTotal)}</strong>
            <span>{stockItemType === 'medicine' ? 'pharmacy units' : 'mart units'} on hand / {money.format(stockCostTotal)} value</span>
          </div>
        </>
      )}
      {report === 'supplier' && (
        <div className="report-filters">
          <label>Supplier<select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}><option value="">All suppliers</option>{db.suppliers.map((supplier) => <option key={supplier.id} value={supplier.name}>{supplier.name}</option>)}</select></label>
          <label>Date supplied<input type="date" value={supplierDate} onChange={(event) => setSupplierDate(event.target.value)} /></label>
        </div>
      )}
      {report === 'movement' && (
        <div className="report-summary">
          <Archive size={16} />
          <strong>{number.format(movementUnitsMoved)}</strong>
          <span>units moved{categoryFilter ? ` in ${categoryFilter}` : ''} / net {number.format(movementQuantityTotal)} / POS sales value {money.format(movementSalesTotal)}</span>
        </div>
      )}
      <ReportTable rows={rows} />
    </section>
  )
}

function QuestCoach({ db, currentUser, activeView, activeBranchId, setActiveView }: { db: Database; currentUser: User; activeView: View; activeBranchId?: string; setActiveView: (view: View) => void }) {
  const steps = useMemo(() => getQuestSteps(db, currentUser), [currentUser, db])
  const indexKey = safeStorageKey(db, currentUser, 'quest-index')
  const dismissedKey = safeStorageKey(db, currentUser, 'quest-dismissed')
  const positionKey = safeStorageKey(db, currentUser, 'quest-position')
  const [index, setIndex] = useState(() => getStoredNumber(indexKey, 0))
  const [dismissed, setDismissed] = useState(() => getStoredBoolean(dismissedKey))
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = JSON.parse(window.localStorage.getItem(positionKey) || 'null') as { x?: number; y?: number } | null
      if (!stored || !Number.isFinite(stored.x) || !Number.isFinite(stored.y)) return null
      return { x: Number(stored.x), y: Number(stored.y) }
    } catch {
      return null
    }
  })
  const questRef = useRef<HTMLElement | null>(null)
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0, originX: 0, originY: 0 })
  const [initialBranchId] = useState(activeBranchId)
  const completionTimerRef = useRef<number | undefined>(undefined)
  const lastCompletedStepRef = useRef('')
  const [completedTitle, setCompletedTitle] = useState('')
  const safeIndex = Math.min(index, Math.max(steps.length - 1, 0))
  const step = steps[safeIndex]
  const branchCanSwitch = db.branches.filter((branch) => branch.active).length > 1
  const complete = step ? step.id === 'branch-switcher'
    ? activeView === 'dashboard' && (!branchCanSwitch || activeBranchId !== initialBranchId)
    : activeView === step.view : false
  const progress = steps.length ? Math.round(((safeIndex + (complete ? 1 : 0)) / steps.length) * 100) : 100
  const stepId = step?.id ?? ''
  const stepTitle = step?.title ?? ''

  useEffect(() => {
    setStoredValue(indexKey, String(safeIndex))
  }, [indexKey, safeIndex])

  useEffect(() => {
    setStoredValue(dismissedKey, String(dismissed))
  }, [dismissed, dismissedKey])

  useEffect(() => {
    if (!position || typeof window === 'undefined') return
    window.localStorage.setItem(positionKey, JSON.stringify(position))
  }, [position, positionKey])

  useEffect(() => {
    if (!stepId || !complete || lastCompletedStepRef.current === stepId) return undefined
    lastCompletedStepRef.current = stepId
    setCompletedTitle(stepTitle)
    completionTimerRef.current = window.setTimeout(() => {
      setCompletedTitle('')
      if (safeIndex >= steps.length - 1) {
        setDismissed(true)
        return
      }
      setIndex(safeIndex + 1)
    }, 2100)
    return () => window.clearTimeout(completionTimerRef.current)
  }, [complete, safeIndex, stepId, stepTitle, steps.length])

  useEffect(() => {
    if (!position) return undefined
    function handleResize() {
      setPosition((current) => current ? clampQuestPosition(current.x, current.y) : current)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [position])

  function clampQuestPosition(x: number, y: number) {
    if (typeof window === 'undefined') return { x, y }
    const rect = questRef.current?.getBoundingClientRect()
    const width = rect?.width ?? 360
    const height = rect?.height ?? 260
    const padding = 12
    return {
      x: Math.min(Math.max(padding, x), Math.max(padding, window.innerWidth - width - padding)),
      y: Math.min(Math.max(padding, y), Math.max(padding, window.innerHeight - height - padding)),
    }
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!questRef.current) return
    const rect = questRef.current.getBoundingClientRect()
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: position?.x ?? rect.left,
      originY: position?.y ?? rect.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.active) return
    const dx = event.clientX - dragRef.current.startX
    const dy = event.clientY - dragRef.current.startY
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true
    setPosition(clampQuestPosition(dragRef.current.originX + dx, dragRef.current.originY + dy))
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.active) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Pointer capture may already be released by the browser.
    }
    dragRef.current.active = false
  }

  if (dismissed || !step) return null

  function next() {
    window.clearTimeout(completionTimerRef.current)
    setCompletedTitle('')
    lastCompletedStepRef.current = ''
    if (safeIndex >= steps.length - 1) {
      setDismissed(true)
      return
    }
    setIndex(safeIndex + 1)
  }

  function previous() {
    window.clearTimeout(completionTimerRef.current)
    setCompletedTitle('')
    lastCompletedStepRef.current = ''
    setIndex(Math.max(0, safeIndex - 1))
  }

  return (
    <aside
      className={completedTitle ? 'quest-coach is-complete' : 'quest-coach'}
      ref={questRef}
      style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
      aria-label="Beta quest coach"
    >
      <div className="quest-coach-head">
        <button
          className="quest-drag-handle"
          type="button"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          title="Drag quest card"
        >
          <Trophy size={16} />
          Beta quest
        </button>
        <button type="button" onClick={() => setDismissed(true)}>Skip</button>
      </div>
      <div className="quest-progress" aria-label={`${progress}% complete`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {completedTitle ? (
        <div className="quest-completion" role="status" aria-live="polite">
          <CheckCircle2 size={28} />
          <strong>Well done!</strong>
          <p>Congratulations, you just completed: {completedTitle}. Moving you to the next quest...</p>
        </div>
      ) : (
        <>
          <strong>{step.title}</strong>
          <p>{step.body}</p>
        </>
      )}
      <div className="quest-status">
        <span>{safeIndex + 1} of {steps.length}</span>
        <b className={complete ? 'done' : ''}>{complete ? 'Completed' : roleLabels[currentUser.role]}</b>
      </div>
      <div className="quest-actions">
        <button className="ghost-button" type="button" onClick={() => setActiveView(step.view)} disabled={Boolean(completedTitle)}>{step.action}</button>
        <button className="ghost-button" type="button" onClick={previous} disabled={safeIndex === 0 || Boolean(completedTitle)}>Back</button>
        <button className="primary-button" type="button" onClick={next}>{safeIndex >= steps.length - 1 ? 'Finish' : 'Next'}</button>
      </div>
      <button className="quest-guide-link" type="button" onClick={() => setActiveView('guide')}>
        <BookOpen size={15} />
        Open role guide
      </button>
    </aside>
  )
}

type GuideCard = {
  id: string
  title: string
  summary: string
  view: View
  shot: 'branch' | 'pos' | 'receive' | 'reports' | 'access' | 'settings' | 'chat'
  steps: string[]
  roles?: Role[]
  superAdminOnly?: boolean
  branchManagerOnly?: boolean
}

const guideCards: GuideCard[] = [
  {
    id: 'branch',
    title: 'Choose the correct branch',
    summary: 'Start every shift by confirming the branch/site at the top right of the workspace.',
    view: 'dashboard',
    shot: 'branch',
    steps: ['Open Dashboard.', 'Use the branch selector in the top bar.', 'Choose the branch you are working from.', 'Confirm cards and alerts refresh for that branch.'],
  },
  {
    id: 'pos',
    title: 'Complete a POS sale',
    summary: 'Cashiers and pharmacists can find in-stock items, add them to cart, apply discounts, and print reconciliation history.',
    view: 'pos',
    shot: 'pos',
    roles: ['cashier', 'pharmacist'],
    steps: ['Open POS.', 'Search by product name, SKU, barcode, or use Frequently sold items.', 'Add items to cart and enter customer/payment details.', 'Save draft or complete sale if you are the cashier.'],
  },
  {
    id: 'receive',
    title: 'Receive Pharmacy and Mart stock',
    summary: 'Inventory staff receive medicines and general products from the same workflow.',
    view: 'receive',
    shot: 'receive',
    roles: ['inventory', 'pharmacist', 'admin'],
    steps: ['Open Receive.', 'Switch between Pharmacy and Mart where needed.', 'Search by name, SKU, or barcode.', 'Enter invoice, supplier, cost, selling price, quantity, and optional batch/expiry for products.'],
  },
  {
    id: 'reports',
    title: 'Export stock and movement reports',
    summary: 'Reports help beta testers check stock at hand, stock movement, POS value, suppliers, expiry, and reorder needs.',
    view: 'reports',
    shot: 'reports',
    steps: ['Open Reports.', 'Choose Stock on hand or Movement ledger.', 'Switch between Pharmacy and Mart.', 'Filter by date, type, brand/product, generic, or category, then export CSV or print.'],
  },
  {
    id: 'access',
    title: 'Manage staff access',
    summary: 'Super admins and branch managers can review which employees can work inside a selected branch.',
    view: 'branches',
    shot: 'access',
    branchManagerOnly: true,
    steps: ['Open Branches.', 'Select a branch/site card.', 'Review Staff Access underneath the branch list.', 'Tick access, set expiry dates where needed, and save changes.'],
  },
  {
    id: 'settings',
    title: 'Brand the workspace',
    summary: 'Super admins can confirm company identity, logo, default branch, and operational thresholds.',
    view: 'settings',
    shot: 'settings',
    superAdminOnly: true,
    steps: ['Open Settings.', 'Upload or remove the workspace logo.', 'Confirm company name and licence details.', 'Save near-expiry and approval thresholds.'],
  },
  {
    id: 'chat',
    title: 'Message the team',
    summary: 'Use group chat for shared updates and direct messages for employee-to-employee coordination.',
    view: 'chat',
    shot: 'chat',
    steps: ['Open Messages.', 'Choose Group chat or Direct message.', 'Select an employee for direct messages.', 'Send operational notes without leaving the workspace.'],
  },
]

function visibleGuideCards(db: Database, currentUser: User) {
  const superAdmin = isSuperAdmin(db, currentUser)
  const managesBranch = db.branches.some((branch) => canManageBranch(db, currentUser, branch.id))
  return guideCards.filter((card) => {
    if (card.superAdminOnly && !superAdmin) return false
    if (card.branchManagerOnly && !managesBranch && !superAdmin) return false
    if (card.roles && !card.roles.includes(currentUser.role) && !superAdmin) return false
    return true
  })
}

function GuideView({ db, currentUser, setActiveView }: { db: Database; currentUser: User; setActiveView: (view: View) => void }) {
  const cards = visibleGuideCards(db, currentUser)
  const questSteps = getQuestSteps(db, currentUser)
  return (
    <section className="content-section guide-section">
      <div className="section-heading">
        <div>
          <h2>{roleLabels[currentUser.role]} Guide</h2>
          <p>Role-specific walkthroughs for beta testing the workspace without guessing where to start.</p>
        </div>
        <span className="pill active">{questSteps.length} quest tasks</span>
      </div>
      <div className="guide-hero">
        <Sparkles size={24} />
        <div>
          <strong>Beta orientation</strong>
          <span>Use the quest coach for quick practice, then use this manual when you need step-by-step help.</span>
        </div>
      </div>
      <div className="guide-grid">
        {cards.map((card) => (
          <article className="guide-card" key={card.id}>
            <GuideScreenshot type={card.shot} />
            <div>
              <h3>{card.title}</h3>
              <p>{card.summary}</p>
              <ol>
                {card.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
            <button className="ghost-button" type="button" onClick={() => setActiveView(card.view)}>
              Open feature
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function GuideScreenshot({ type }: { type: GuideCard['shot'] }) {
  const labels: Record<GuideCard['shot'], string[]> = {
    branch: ['Dashboard', 'Port-Harcourt main store', '1 notification'],
    pos: ['Frequently sold items', 'Sale cart', 'Complete sale'],
    receive: ['Receive stock', 'Search SKU/barcode', 'Invoice items'],
    reports: ['Movement ledger', 'Pharmacy | Mart', 'CSV / Print'],
    access: ['Branches and Sites', 'Staff Access', 'Can authorize'],
    settings: ['Workspace logo', 'Account Settings', 'Save settings'],
    chat: ['Messages', 'Group chat', 'Direct message'],
  }
  return (
    <div className={`guide-shot ${type}`} aria-label={`${type} screenshot illustration`}>
      <div className="guide-shot-top"><span /><span /><span /></div>
      <div className="guide-shot-body">
        <b>{labels[type][0]}</b>
        <span>{labels[type][1]}</span>
        <em>{labels[type][2]}</em>
      </div>
    </div>
  )
}

function ChatView({ db, currentUser, executeAction }: { db: Database; currentUser: User; executeAction: ExecuteAction }) {
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<'group' | 'direct'>('group')
  const [recipientUserId, setRecipientUserId] = useState('')
  const readMarked = useRef(false)
  const employees = useMemo(() => db.users.filter((user) => user.status === 'active' && user.id !== currentUser.id).sort((a, b) => a.name.localeCompare(b.name)), [currentUser.id, db.users])

  useEffect(() => {
    if (!readMarked.current) {
      readMarked.current = true
      void executeAction('markChatRead', {})
    }
  }, [executeAction])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    if (channel === 'direct' && !recipientUserId) return
    void executeAction('sendChatMessage', { body, channel, recipientUserId: channel === 'direct' ? recipientUserId : '' }, channel === 'direct' ? 'Direct message sent' : 'Group message sent')
    setBody('')
  }

  const messages = db.chatMessages
    .filter((message) => isChatMessageVisible(message, currentUser))
    .filter((message) => channel === 'group'
      ? message.channel !== 'direct'
      : message.channel === 'direct' && (!recipientUserId || message.userId === recipientUserId || message.recipientUserId === recipientUserId || message.userId === currentUser.id && message.recipientUserId === recipientUserId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const activeRecipient = employees.find((user) => user.id === recipientUserId)

  return (
    <section className="content-section chat-section">
      <div className="section-heading">
        <div>
          <h2>Messages</h2>
          <p>Send workspace updates to everyone or private notes to another employee.</p>
        </div>
      </div>
      <div className="chat-controls">
        <div className="report-mode-switch">
          <button className={channel === 'group' ? 'active' : ''} type="button" onClick={() => setChannel('group')}>
            <Users size={16} />
            Group chat
          </button>
          <button className={channel === 'direct' ? 'active' : ''} type="button" onClick={() => setChannel('direct')}>
            <User2 size={16} />
            Direct message
          </button>
        </div>
        {channel === 'direct' && (
          <label>
            Employee
            <select value={recipientUserId} onChange={(event) => setRecipientUserId(event.target.value)}>
              <option value="">Choose employee</option>
              {employees.map((user) => <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="chat-list">
        {messages.length ? (
          messages.map((message) => {
            const user = db.users.find((item) => item.id === message.userId)
            const recipient = db.users.find((item) => item.id === message.recipientUserId)
            const mine = message.userId === currentUser.id
            return (
              <article className={mine ? 'chat-message mine' : 'chat-message'} key={message.id}>
                <div>
                  <strong>{mine ? 'You' : user?.name ?? 'Team member'}</strong>
                  <span>{message.channel === 'direct' ? `Direct${recipient ? ` to ${mine ? recipient.name : 'you'}` : ''}` : 'Group'} / {new Date(message.createdAt).toLocaleString()}</span>
                </div>
                <p>{message.body}</p>
              </article>
            )
          })
        ) : (
          <div className="empty-state">{channel === 'direct' && !activeRecipient ? 'Choose an employee to view or send direct messages.' : 'No messages yet.'}</div>
        )}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={channel === 'direct' ? activeRecipient ? `Message ${activeRecipient.name}` : 'Choose an employee before typing a direct message' : 'Type a message for the group'} maxLength={2000} disabled={channel === 'direct' && !recipientUserId} />
        <button className="primary-button" type="submit" disabled={!body.trim() || (channel === 'direct' && !recipientUserId)}>
          <Send size={17} />
          Send
        </button>
      </form>
    </section>
  )
}

function NotificationsView({ notifications, setActiveView }: { notifications: AppNotification[]; setActiveView: (view: View) => void }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Notification Center</h2>
          <p>Chat, access, stock-out, low-stock, expired, and near-expiry prompts in one place.</p>
        </div>
      </div>
      <div className="alert-list">
        {notifications.length ? (
          notifications.map((notification) => (
            <button className={`notification-item alert-item ${notification.tone}`} key={notification.id} type="button" onClick={() => setActiveView(notification.view)}>
              <NotificationIcon tone={notification.tone} />
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.detail}</span>
              </div>
            </button>
          ))
        ) : (
          <AlertItem tone="good" title="No active notifications" detail="Team messages, stock levels, expiry windows, and access approvals are currently clear." />
        )}
      </div>
    </section>
  )
}

function NotificationIcon({ tone }: { tone: NotificationTone }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : tone === 'good' ? CheckCircle2 : ClipboardList
  return <Icon size={19} />
}

function Audit({ db }: { db: Database }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <h2>Audit Trail</h2>
          <p>Critical actions are captured with actor, entity, timestamp, and before/after payloads.</p>
        </div>
      </div>
      <div className="audit-list">
        {db.auditLogs.length ? (
          db.auditLogs.map((log) => {
            const user = db.users.find((item) => item.id === log.userId)
            return (
              <article className="audit-item" key={log.id}>
                <ShieldCheck size={18} />
                <div>
                  <strong>{log.action}</strong>
                  <span>{user?.name ?? 'System'} / {log.entity} / {new Date(log.createdAt).toLocaleString()}</span>
                </div>
                <code>{log.entityId}</code>
              </article>
            )
          })
        ) : (
          <div className="empty-state">No audit entries yet.</div>
        )}
      </div>
    </section>
  )
}

function UserManagement({ db, currentUser, executeAction, flash }: { db: Database; currentUser: User; executeAction: ExecuteAction; flash: (message: string) => void }) {
  const primaryAdminId = getPrimaryAdminId(db)
  const securityEvents = db.securityEvents.slice(0, 50)

  function updateUser(userId: string, updates: Partial<Pick<User, 'role' | 'status'>>) {
    const target = db.users.find((user) => user.id === userId)
    if (!target) return
    if (target.id === currentUser.id && updates.status && updates.status !== 'active') {
      flash('You cannot suspend your own active admin account')
      return
    }
    if (target.id === primaryAdminId && ((updates.status && updates.status !== 'active') || (updates.role && updates.role !== 'admin'))) {
      flash('The permanent account admin cannot be downgraded or suspended')
      return
    }
    void executeAction('updateUser', { userId, updates }, 'User access updated')
  }

  return (
    <div className="page-grid">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>User Access Control</h2>
            <p>New registrations stay pending until an admin assigns a role and activates the account.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Branch access</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {db.users.map((user) => (
                <tr key={user.id}>
                  <td><strong>{user.name}</strong><span>{user.email}{user.id === primaryAdminId ? ' / Permanent admin' : ''}</span></td>
                  <td>{user.phone || '-'}</td>
                  <td>
                    <select value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as Role })} disabled={user.id === currentUser.id || user.id === primaryAdminId}>
                      {Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                    </select>
                  </td>
                  <td>
                    <span>{isSuperAdmin(db, user) ? 'All branches' : db.branches.filter((branch) => hasActiveBranchAssignment(user, branch.id)).map((branch) => {
                      const expiresAt = getBranchAccessExpiry(user, branch.id)
                      return `${branch.name}${expiresAt ? ` until ${expiresAt}` : ''}`
                    }).join(', ') || 'View only everywhere'}</span>
                  </td>
                  <td><span className={`pill ${user.status}`}>{statusLabels[user.status]}</span></td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="button-row">
                      <button className="ghost-button" type="button" onClick={() => updateUser(user.id, { status: 'active' })} disabled={user.status === 'active'}>
                        <UserCheck size={16} />
                        Activate
                      </button>
                      <button className="ghost-button" type="button" onClick={() => updateUser(user.id, { status: 'suspended' })} disabled={user.id === currentUser.id || user.id === primaryAdminId || user.status === 'suspended'}>
                        <XCircle size={16} />
                        Suspend
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Security Events</h2>
            <p>Password resets, new device sign-ins, panic actions, and email delivery issues are visible here for admin oversight.</p>
          </div>
        </div>
        <div className="alert-list">
          {securityEvents.length ? (
            securityEvents.map((event) => {
              const user = db.users.find((item) => item.id === event.userId)
              return (
                <article className={`alert-item ${event.severity === 'critical' ? 'danger' : event.severity === 'warning' ? 'warning' : 'info'}`} key={event.id}>
                  {event.type === 'panic-triggered' ? <ShieldCheck size={19} /> : <Lock size={19} />}
                  <div>
                    <strong>{securityEventLabels[event.type]}</strong>
                    <span>{user?.name ?? event.email} / {event.email} / {new Date(event.createdAt).toLocaleString()}</span>
                    <small>{event.detail}{event.ipAddress ? ` / IP: ${event.ipAddress}` : ''}</small>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="empty-state">No security events yet.</div>
          )}
        </div>
      </section>
    </div>
  )
}

function BranchesView({
  db,
  currentUser,
  activeBranchId,
  setActiveBranchId,
  executeAction,
}: {
  db: Database
  currentUser: User
  activeBranchId: string
  setActiveBranchId: (branchId: string) => void
  executeAction: ExecuteAction
}) {
  const createBlank = (): Branch => ({
    id: '',
    name: '',
    code: '',
    address: '',
    managerName: '',
    managerUserId: '',
    phone: '',
    active: true,
    createdAt: new Date().toISOString(),
  })
  const [form, setForm] = useState<Branch>(createBlank)
  const selectedBranch = db.branches.find((branch) => branch.id === activeBranchId) ?? db.branches[0]
  const primaryAdminId = getPrimaryAdminId(db)
  const superAdmin = isSuperAdmin(db, currentUser)
  const canManageSelected = selectedBranch ? canManageBranch(db, currentUser, selectedBranch.id) : false
  const assignableUsers = useMemo(() => db.users.filter((user) => user.status === 'active' && user.id !== primaryAdminId), [db.users, primaryAdminId])
  const managerOptions = useMemo(() => db.users.filter((user) => user.status === 'active' && (user.role === 'admin' || user.role === 'pharmacist' || user.role === 'inventory') && user.id !== primaryAdminId), [db.users, primaryAdminId])
  const [accessExpiryByUser, setAccessExpiryByUser] = useState<Record<string, string>>({})
  const currentUserHasSelectedAccess = selectedBranch ? hasActiveBranchAssignment(currentUser, selectedBranch.id) : false
  const currentUserPendingAccessRequest = selectedBranch
    ? db.branchAccessRequests.find((request) => request.userId === currentUser.id && request.branchId === selectedBranch.id && request.status === 'pending')
    : undefined

  function edit(branch: Branch) {
    setForm(branch)
    setActiveBranchId(branch.id)
  }

  function switchBranch(branch: Branch) {
    setActiveBranchId(branch.id)
    setForm(branch)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canManageSelected && form.id) return
    if (form.id && form.id !== selectedBranch?.id && !superAdmin) return
    const record: Branch = {
      ...form,
      id: form.id || id('br'),
      code: form.code || form.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12),
      createdAt: form.createdAt || new Date().toISOString(),
    }
    void executeAction('upsertBranch', { record }, 'Branch saved')
    setForm(createBlank())
  }

  function updateBranchAccess(user: User, canAccess: boolean) {
    if (!selectedBranch) return
    const draftKey = `${selectedBranch.id}:${user.id}`
    const expiresAt = accessExpiryByUser[draftKey] ?? getBranchAccessExpiry(user, selectedBranch.id)
    void executeAction('updateBranchAccess', {
      userId: user.id,
      branchId: selectedBranch.id,
      canAccess,
      expiresAt: canAccess ? expiresAt : '',
    }, 'Branch access updated')
  }

  function requestBranchAccess() {
    if (!selectedBranch) return
    void executeAction('requestBranchAccess', { branchId: selectedBranch.id }, 'Branch access request sent')
  }

  return (
    <div className="two-column">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Branches and Sites</h2>
            <p>The account is the company dashboard; branches hold stock and operational movement.</p>
          </div>
        </div>
        <div className="branch-grid">
          {db.branches.map((branch) => (
            <article className={branch.id === activeBranchId ? 'branch-card selected' : 'branch-card'} key={branch.id}>
              <Building2 size={19} />
              <div>
                <strong>{branch.name}</strong>
                <span>{branch.code || 'No code'} / {branch.active ? 'Active' : 'Inactive'} / {getUserBranchStatus(db, currentUser, branch.id)}</span>
                <span>{db.users.find((user) => user.id === branch.managerUserId)?.name || branch.managerName || 'No manager'} / {branch.phone || 'No phone'}</span>
                <span>{branch.address || 'No address recorded'}</span>
              </div>
              <button className="ghost-button" type="button" onClick={() => switchBranch(branch)}>
                Use
              </button>
              <button className="icon-button" type="button" onClick={() => edit(branch)} disabled={!canManageBranch(db, currentUser, branch.id)} title="Edit branch">
                <ClipboardList size={16} />
              </button>
            </article>
          ))}
        </div>

        {selectedBranch && (
          <div className="branch-access-panel">
            <div className="section-heading">
              <div>
                <h2>{selectedBranch.name} Staff Access</h2>
                <p>Super admin can assign managers and override transfers. Branch managers can grant access to free staff for their own branch.</p>
              </div>
              <span className={canManageSelected ? 'pill active' : 'pill muted'}>{canManageSelected ? 'Can authorize' : 'View only'}</span>
            </div>
            {!canManageSelected && !currentUserHasSelectedAccess && currentUser.id !== primaryAdminId && (
              <div className="access-request-box">
                <div>
                  <strong>Need to work in this branch?</strong>
                  <span>Request access from the branch manager.</span>
                </div>
                <button className="ghost-button" type="button" onClick={requestBranchAccess} disabled={Boolean(currentUserPendingAccessRequest)}>
                  <Send size={16} />
                  {currentUserPendingAccessRequest ? 'Request sent' : 'Request access'}
                </button>
              </div>
            )}
            <div className="access-list">
              {assignableUsers.map((user) => {
                const hasAccess = hasActiveBranchAssignment(user, selectedBranch.id)
                const isManager = user.managedBranchIds.includes(selectedBranch.id) && hasActiveBranchAssignment(user, selectedBranch.id)
                const otherAssignedBranch = getOtherAssignedBranch(db, user, selectedBranch.id)
                const waitingForRelease = Boolean(otherAssignedBranch && !hasAccess && !superAdmin)
                return (
                  <article className="access-row" key={user.id}>
                    <input type="checkbox" checked={hasAccess} onChange={(event) => updateBranchAccess(user, event.target.checked)} disabled={!canManageSelected || isManager || waitingForRelease} />
                    <span>
                      <strong>{user.name}</strong>
                      {user.email}
                    </span>
                    <div className="access-row-controls">
                      <b className={isManager ? 'pill active' : hasAccess ? 'pill good' : 'pill muted'}>{isManager ? 'Manager' : hasAccess ? roleLabels[user.role] : 'View only'}</b>
                      {canManageSelected && !isManager && (
                        <label className="access-expiry">
                          Until
                          <input type="date" value={accessExpiryByUser[`${selectedBranch.id}:${user.id}`] ?? getBranchAccessExpiry(user, selectedBranch.id)} onChange={(event) => setAccessExpiryByUser((current) => ({ ...current, [`${selectedBranch.id}:${user.id}`]: event.target.value }))} disabled={waitingForRelease} />
                        </label>
                      )}
                      {canManageSelected && hasAccess && !isManager && (
                        <button className="icon-button" type="button" onClick={() => updateBranchAccess(user, true)} title="Save access timeframe">
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>{form.id ? 'Edit Branch' : 'Add Branch'}</h2>
            <p>Managers can maintain their branch. Only admins can create branches or assign branch managers.</p>
          </div>
        </div>
        {!canManageSelected && form.id && <div className="form-error">You can view {form.name}, but only its manager or an admin can edit it.</div>}
        <form className="form-grid" onSubmit={submit}>
          <label className="full">Branch/site name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={form.id ? !canManageSelected : !superAdmin} /></label>
          <label>Code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="Enter branch code" disabled={form.id ? !canManageSelected : !superAdmin} /></label>
          <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Enter branch phone number" disabled={form.id ? !canManageSelected : !superAdmin} /></label>
          <label className="full">Manager<select value={form.managerUserId || ''} onChange={(event) => setForm({ ...form, managerUserId: event.target.value, managerName: db.users.find((user) => user.id === event.target.value)?.name ?? form.managerName })} disabled={!superAdmin}><option value="">No assigned manager</option>{managerOptions.map((user) => <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]}</option>)}</select></label>
          <label className="full">Manager/contact person<input value={form.managerName} onChange={(event) => setForm({ ...form, managerName: event.target.value })} placeholder="Enter manager or contact name" disabled={form.id ? !canManageSelected : !superAdmin} /></label>
          <label className="full">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Enter branch address" disabled={form.id ? !canManageSelected : !superAdmin} /></label>
          <label className="checkbox-row full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} disabled={!superAdmin || form.id === 'main'} /> Active branch</label>
          <div className="form-actions full">
            <button className="ghost-button" type="button" onClick={() => setForm(createBlank())}>Clear</button>
            <button className="primary-button" type="submit" disabled={form.id ? !canManageSelected : !superAdmin}>
              <Building2 size={17} />
              Save branch
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function SettingsView({ db, canAdmin, executeAction }: { db: Database; canAdmin: boolean; executeAction: ExecuteAction }) {
  const [form, setForm] = useState(db.settings)
  const [categoryMarkupText, setCategoryMarkupText] = useState(() => markupMapToText(db.settings.categoryMarkupPercentages))
  const [productMarkupText, setProductMarkupText] = useState(() => markupMapToText(db.settings.productMarkupPercentages))
  const currentPlanId = db.settings.subscriptionPlanId ?? trialPolicy.includedPlan
  const selectedPlanId = form.subscriptionPlanId ?? currentPlanId
  const selectedPlan = planById(selectedPlanId)
  const activeUsage = useMemo(() => ({
    activeBranches: db.branches.filter((branch) => branch.active).length,
    activeStaff: db.users.filter((user) => user.status === 'active').length,
  }), [db.branches, db.users])
  const planBlockers = selectedPlanId === currentPlanId ? [] : planChangeBlockers(activeUsage, selectedPlanId)
  const trialEnds = form.trialEndsAt ? formatDate(form.trialEndsAt) : ''

  async function uploadLogo(file: File) {
    if (file.size > 500_000) {
      window.alert('Logo must be below 500KB.')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Unable to read logo'))
      reader.readAsDataURL(file)
    })
    setForm((current) => ({ ...current, logoDataUrl: dataUrl }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (planBlockers.length) {
      window.alert(planBlockers.join('\n'))
      return
    }
    void executeAction('updateSettings', {
      ...form,
      categoryMarkupPercentages: textToMarkupMap(categoryMarkupText),
      productMarkupPercentages: textToMarkupMap(productMarkupText),
    }, 'Settings saved')
  }

  return (
    <section className="content-section narrow">
      <div className="section-heading">
        <div>
          <h2>Account Settings</h2>
          <p>RxLedger account identity and operational thresholds.</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <div className="workspace-logo-editor full">
          <BrandMark settings={form} />
          <div>
            <strong>Workspace logo</strong>
            <span>This replaces the default capsule mark inside your company workspace.</span>
          </div>
          <label className="file-button">
            <Upload size={16} />
            Upload logo
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); event.currentTarget.value = '' }} disabled={!canAdmin} />
          </label>
          {form.logoDataUrl && (
            <button className="ghost-button" type="button" onClick={() => setForm({ ...form, logoDataUrl: '' })} disabled={!canAdmin}>
              Remove
            </button>
          )}
        </div>
        <label>Software name<input value={form.softwareName} onChange={(event) => setForm({ ...form, softwareName: event.target.value })} disabled={!canAdmin} /></label>
        <label>Account/company name<input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value, pharmacyName: event.target.value })} disabled={!canAdmin} /></label>
        <label className="full">Business registration/licence<input value={form.businessLicense} onChange={(event) => setForm({ ...form, businessLicense: event.target.value })} disabled={!canAdmin} /></label>
        <label className="full">Main branch address<input value={form.mainBranchAddress} onChange={(event) => setForm({ ...form, mainBranchAddress: event.target.value })} disabled={!canAdmin} /></label>
        <label>Default branch name<input value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} disabled={!canAdmin} /></label>
        <label>Near-expiry days<input type="number" min="1" value={numberInputValue(form.nearExpiryDays)} onChange={(event) => setForm({ ...form, nearExpiryDays: Number(event.target.value) })} disabled={!canAdmin} /></label>
        <label>Approval threshold (NGN)<input type="number" min="0" value={numberInputValue(form.approvalThreshold)} onChange={(event) => setForm({ ...form, approvalThreshold: Number(event.target.value) })} disabled={!canAdmin} /></label>
        <div className="pricing-settings full">
          <div className="pricing-settings-head">
            <div>
              <span className="eyebrow">Price control</span>
              <h3>Auto selling price</h3>
              <p>Calculate prices from final least-unit cost, markup, and rounding. Manual selling price is locked while this is on, except admin override with audit reason.</p>
            </div>
            <label className="switch-row">
              <input type="checkbox" checked={Boolean(form.autoPricingEnabled)} onChange={(event) => setForm({ ...form, autoPricingEnabled: event.target.checked })} disabled={!canAdmin} />
              <span>{form.autoPricingEnabled ? 'On' : 'Off'}</span>
            </label>
          </div>
          <div className="pricing-settings-grid">
            <label>Global markup %<input type="number" min="0" value={numberInputValue(form.globalMarkupPercent ?? 30)} onChange={(event) => setForm({ ...form, globalMarkupPercent: Number(event.target.value) })} disabled={!canAdmin} /></label>
            <label>Round prices<select value={form.pricingRoundingRule ?? 10} onChange={(event) => setForm({ ...form, pricingRoundingRule: Number(event.target.value) as PricingRoundingRule })} disabled={!canAdmin}>{pricingRoundingRules.map((rule) => <option key={rule} value={rule}>{rule ? `Nearest ${money.format(rule)}` : 'No rounding'}</option>)}</select></label>
            <label>Cashier discount limit %<input type="number" min="0" max="100" value={numberInputValue(form.cashierDiscountLimitPercent ?? 5)} onChange={(event) => setForm({ ...form, cashierDiscountLimitPercent: Number(event.target.value) })} disabled={!canAdmin} /></label>
            <label>Manager discount limit %<input type="number" min="0" max="100" value={numberInputValue(form.managerDiscountLimitPercent ?? 10)} onChange={(event) => setForm({ ...form, managerDiscountLimitPercent: Number(event.target.value) })} disabled={!canAdmin} /></label>
            <label>Unusual markup warning %<input type="number" min="0" value={numberInputValue(form.unusualMarkupPercent ?? 80)} onChange={(event) => setForm({ ...form, unusualMarkupPercent: Number(event.target.value) })} disabled={!canAdmin} /></label>
            <label>Cost-change warning %<input type="number" min="0" value={numberInputValue(form.costChangeWarningPercent ?? 30)} onChange={(event) => setForm({ ...form, costChangeWarningPercent: Number(event.target.value) })} disabled={!canAdmin} /></label>
          </div>
          <div className="pricing-rule-editors">
            <label>
              Category markup rules
              <textarea value={categoryMarkupText} onChange={(event) => setCategoryMarkupText(event.target.value)} disabled={!canAdmin} rows={4} placeholder={'analgesics = 35\nantibiotics = 25'} />
            </label>
            <label>
              Product markup overrides
              <textarea value={productMarkupText} onChange={(event) => setProductMarkupText(event.target.value)} disabled={!canAdmin} rows={4} placeholder={'pcm-500 = 40\nmedicine:med_123 = 22'} />
            </label>
          </div>
        </div>
        <div className="subscription-settings full">
          <div>
            <span className="eyebrow">Subscription</span>
            <h3>{selectedPlan.name}</h3>
            <p>{selectedPlan.summary}</p>
            {trialEnds && <small>Trial data is preserved. Current trial ends {trialEnds}.</small>}
          </div>
          <label>
            Plan
            <select
              value={selectedPlanId}
              onChange={(event) => setForm({ ...form, subscriptionPlanId: event.target.value as SubscriptionPlanId })}
              disabled={!canAdmin}
            >
              {subscriptionPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>{plan.name} - {plan.price}{plan.per}</option>
              ))}
            </select>
          </label>
          <div className="subscription-plan-boundary">
            <strong>Plan boundary</strong>
            <span>{activeUsage.activeBranches} active branch{activeUsage.activeBranches === 1 ? '' : 'es'} / {activeUsage.activeStaff} active staff</span>
            <ul>
              {selectedPlan.limits.map((limit) => <li key={limit}>{limit}</li>)}
            </ul>
          </div>
          {planBlockers.length > 0 ? (
            <div className="form-error">
              {planBlockers.map((blocker) => <span key={blocker}>{blocker}</span>)}
              <span>Archive, export, or deactivate extra usage before moving to this lower plan. No historical data is deleted.</span>
            </div>
          ) : (
            <div className="empty-state">Plan changes keep stock, sales, patient, branch, and audit history in the workspace.</div>
          )}
        </div>
        <div className="form-actions full">
          <button className="primary-button" type="submit" disabled={!canAdmin || planBlockers.length > 0}>
            <Settings size={17} />
            Save settings
          </button>
        </div>
      </form>
    </section>
  )
}

function StockTable({ rows, compact = false }: { rows: StockRow[]; compact?: boolean }) {
  return (
    <div className="table-wrap">
      <table className={compact ? 'compact-table' : ''}>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Batch</th>
            <th>Expiry</th>
            <th>Unit</th>
            <th>Qty</th>
            {!compact && <th>Branch</th>}
            <th>Location</th>
            {!compact && <th>Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={`${row.batch.id}-${row.quantity}`}>
                <td>
                  <MedicineIdentity medicine={row.medicine} />
                </td>
                <td>{row.batch.batchNumber}</td>
                <td>{row.batch.expiryDate}</td>
                <td>{medicineSellableUnit(row.medicine)}</td>
                <td>{number.format(row.quantity)}</td>
                {!compact && <td>{row.branch?.name ?? row.batch.branchId}</td>}
                <td>{row.batch.location}</td>
                {!compact && <td><span className={`pill ${row.status}`}>{row.status.replace('-', ' ')}</span></td>}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={compact ? 6 : 8}>No stock rows yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function ReportTable({ rows }: { rows: ReportRow[] }) {
  const headers = rows.length ? Object.keys(rows[0]) : []
  return (
    <div className="table-wrap report-table">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {headers.map((header) => <td key={header}>{row[header]}</td>)}
              </tr>
            ))
          ) : (
            <tr>
              <td>No report rows available.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default App
