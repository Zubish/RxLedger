export type Role = 'admin' | 'pharmacist' | 'inventory' | 'cashier' | 'viewer'
export type UserStatus = 'pending' | 'active' | 'suspended'
export type LedgerType = 'stock-in' | 'stock-out' | 'adjustment' | 'write-off' | 'supplier-return' | 'customer-return'
export type SubscriptionPlanId = 'single-branch' | 'smart-pharmacy' | 'enterprise'
export type PricingRoundingRule = 0 | 1 | 5 | 10 | 50 | 100

export type User = {
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

export type Medicine = {
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

export type Product = {
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

export type Supplier = {
  id: string
  name: string
  contact: string
  address: string
  licenseRef: string
  active: boolean
}

export type Branch = {
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

export type Batch = {
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

export type LedgerEntry = {
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

export type Receipt = {
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

export type Sale = {
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

export type PosDraft = {
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

export type AuditLog = {
  id: string
  userId: string
  action: string
  entity: string
  entityId: string
  before?: unknown
  after?: unknown
  createdAt: string
}

export type ChatMessage = {
  id: string
  userId: string
  channel?: 'group' | 'direct'
  recipientUserId?: string
  body: string
  createdAt: string
}

export type PasswordResetRequest = {
  id: string
  userId: string
  email: string
  status: 'pending' | 'completed' | 'expired'
  requestedAt: string
  expiresAt: string
  emailSent?: boolean
  resolvedAt?: string
}

export type SecurityEventType = 'password-reset-requested' | 'password-reset-completed' | 'new-device-login' | 'panic-triggered' | 'security-email-failed'

export type SecurityEvent = {
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

export type RequisitionStatus = 'pending' | 'released' | 'received' | 'fulfilled' | 'rejected' | 'cancelled'

export type RequisitionItem = {
  id: string
  medicineId: string
  batchId: string
  quantity: number
  releasedQuantity?: number
  fulfilledQuantity?: number
  receivedQuantity?: number
  destinationBatchId?: string
}

export type Requisition = {
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

export type BranchAccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type BranchAccessRequest = {
  id: string
  userId: string
  branchId: string
  status: BranchAccessRequestStatus
  requestedAt: string
  updatedAt: string
  resolvedBy?: string
  resolvedAt?: string
}

export type AppSettings = {
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

export type Database = {
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

export type SetupInput = {
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

export type RegisterInput = {
  name: string
  email: string
  phone: string
  password: string
}
