export type Role = 'admin' | 'pharmacist' | 'inventory' | 'viewer'
export type UserStatus = 'pending' | 'active' | 'suspended'
export type LedgerType = 'stock-in' | 'stock-out' | 'adjustment' | 'write-off' | 'supplier-return' | 'customer-return'

export type User = {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  status: UserStatus
  branchIds: string[]
  managedBranchIds: string[]
  lastChatSeenAt?: string
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
  category: string
  manufacturer: string
  nafdacNumber: string
  barcodes: string[]
  reorderLevel: number
  active: boolean
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
  medicineId: string
  batchId: string
  type: LedgerType
  quantity: number
  reason: string
  reference: string
  userId: string
  createdAt: string
}

export type Receipt = {
  id: string
  supplierId: string
  invoiceRef: string
  receivedAt: string
  userId: string
  items: Array<{
    medicineId: string
    batchId: string
    quantity: number
    unitCost: number
  }>
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
  body: string
  createdAt: string
}

export type AppSettings = {
  softwareName: string
  accountName: string
  pharmacyName: string
  branchName: string
  primaryAdminId?: string
  nearExpiryDays: number
  approvalThreshold: number
}

export type Database = {
  users: User[]
  medicines: Medicine[]
  suppliers: Supplier[]
  branches: Branch[]
  batches: Batch[]
  ledger: LedgerEntry[]
  receipts: Receipt[]
  chatMessages: ChatMessage[]
  auditLogs: AuditLog[]
  settings: AppSettings
}

export type SetupInput = {
  pharmacyName: string
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
