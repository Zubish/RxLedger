import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { readSheet } from 'read-excel-file/browser'
import {
  Activity,
  AlertTriangle,
  Archive,
  Barcode,
  Bell,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Pill,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import {
  bootstrap,
  clearStoredToken,
  getStoredToken,
  loadState,
  login as apiLogin,
  logout as apiLogout,
  registerUser as apiRegisterUser,
  runAction,
  setupWorkspace,
} from './api'
import './App.css'

type Role = 'admin' | 'pharmacist' | 'inventory' | 'viewer'
type UserStatus = 'pending' | 'active' | 'suspended'
type View =
  | 'dashboard'
  | 'medicines'
  | 'suppliers'
  | 'receive'
  | 'issue'
  | 'adjust'
  | 'reports'
  | 'chat'
  | 'notifications'
  | 'audit'
  | 'users'
  | 'branches'
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
  lastChatSeenAt?: string
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

type LedgerType =
  | 'stock-in'
  | 'stock-out'
  | 'adjustment'
  | 'write-off'
  | 'supplier-return'
  | 'customer-return'

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

type Receipt = {
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
  body: string
  createdAt: string
}

type AppSettings = {
  softwareName: string
  accountName: string
  pharmacyName: string
  branchName: string
  primaryAdminId?: string
  nearExpiryDays: number
  approvalThreshold: number
}

type Database = {
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
type AuthMode = 'login' | 'register' | 'setup'
type NotificationTone = 'danger' | 'warning' | 'info' | 'good'
type AppNotification = {
  id: string
  tone: NotificationTone
  title: string
  detail: string
  view: View
  createdAt?: string
}

const views: Array<{ id: View; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'medicines', label: 'Medicines', icon: Pill },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'receive', label: 'Receive', icon: PackagePlus },
  { id: 'issue', label: 'Issue Stock', icon: PackageMinus },
  { id: 'adjust', label: 'Adjust/Returns', icon: RotateCcw },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'chat', label: 'Team Chat', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit', label: 'Audit', icon: ShieldCheck },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
  { id: 'branches', label: 'Branches', icon: Building2 },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
]

const roleLabels: Record<Role, string> = {
  admin: 'Admin',
  pharmacist: 'Pharmacist',
  inventory: 'Inventory Officer',
  viewer: 'Viewer/Auditor',
}

const statusLabels: Record<UserStatus, string> = {
  pending: 'Pending approval',
  active: 'Active',
  suspended: 'Suspended',
}

const movementLabels: Record<LedgerType, string> = {
  'stock-in': 'Stock In',
  'stock-out': 'Stock Out',
  adjustment: 'Adjustment',
  'write-off': 'Write-off',
  'supplier-return': 'Supplier Return',
  'customer-return': 'Customer Return',
}

const today = () => new Date().toISOString().slice(0, 10)
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
const number = new Intl.NumberFormat('en-NG')
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function daysUntil(date: string) {
  const todayDate = new Date(`${today()}T00:00:00`)
  const target = new Date(`${date}T00:00:00`)
  return Math.ceil((target.getTime() - todayDate.getTime()) / 86_400_000)
}

function createEmptyDatabase(): Database {
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
      createdAt: new Date().toISOString(),
    }],
    batches: [],
    ledger: [],
    receipts: [],
    chatMessages: [],
    auditLogs: [],
    settings: {
      softwareName: 'RxLedger',
      accountName: 'Pharmacy Account',
      pharmacyName: 'RxLedger',
      branchName: 'Main Branch',
      nearExpiryDays: 90,
      approvalThreshold: 25_000,
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

function getActiveBranches(db: Database) {
  return db.branches.filter((branch) => branch.active)
}

function getBranchName(db: Database, branchId: string) {
  return db.branches.find((branch) => branch.id === branchId)?.name ?? db.settings.branchName
}

function getPrimaryAdminId(db: Database) {
  return db.settings.primaryAdminId || db.users.find((user) => user.role === 'admin' && user.status === 'active')?.id || ''
}

function canManageBranch(user: User, branchId: string) {
  return user.role === 'admin' || user.managedBranchIds.includes(branchId)
}

function canWriteBranch(user: User, branchId: string) {
  return user.role === 'admin' || (user.role !== 'viewer' && (user.branchIds.includes(branchId) || user.managedBranchIds.includes(branchId)))
}

function getUserBranchStatus(user: User, branchId: string) {
  if (user.role === 'admin') return 'Admin access'
  if (user.managedBranchIds.includes(branchId)) return 'Manager'
  if (user.branchIds.includes(branchId)) return 'Assigned'
  return 'View only'
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

function buildNotifications(db: Database, stockRows: StockRow[], stockTotals: Map<string, number>, currentUser: User): AppNotification[] {
  const notifications: AppNotification[] = []
  const lastChatSeen = currentUser.lastChatSeenAt ? new Date(currentUser.lastChatSeenAt).getTime() : 0
  const unreadChat = db.chatMessages.filter((message) => message.userId !== currentUser.id && new Date(message.createdAt).getTime() > lastChatSeen)
  const pendingUsers = db.users.filter((user) => user.status === 'pending')
  const expired = stockRows.filter((row) => row.quantity > 0 && row.status === 'expired')
  const nearExpiry = stockRows.filter((row) => row.quantity > 0 && row.status === 'near-expiry')
  const lowStock = db.medicines.filter((medicine) => (stockTotals.get(medicine.id) ?? 0) <= medicine.reorderLevel)
  const outOfStock = db.medicines.filter((medicine) => (stockTotals.get(medicine.id) ?? 0) <= 0)

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

  if (currentUser.role === 'admin') {
    pendingUsers.forEach((user) => {
      notifications.push({
        id: `pending-${user.id}`,
        tone: 'warning',
        title: `${user.name} is waiting for access`,
        detail: 'Admin should assign the correct role and activate the account.',
        view: 'users',
        createdAt: user.createdAt,
      })
    })
  }

  expired.forEach((row) => {
    notifications.push({
      id: `expired-${row.batch.id}`,
      tone: 'danger',
      title: `${row.medicine.brandName} has expired stock`,
      detail: `${row.batch.batchNumber} has ${number.format(row.quantity)} ${row.medicine.unit} in ${row.batch.location}.`,
      view: 'reports',
    })
  })

  nearExpiry.slice(0, 12).forEach((row) => {
    notifications.push({
      id: `near-${row.batch.id}`,
      tone: 'warning',
      title: `${row.medicine.brandName} expires in ${row.daysToExpiry} days`,
      detail: `${row.batch.batchNumber}, ${number.format(row.quantity)} ${row.medicine.unit} available.`,
      view: 'reports',
    })
  })

  outOfStock.forEach((medicine) => {
    notifications.push({
      id: `out-${medicine.id}`,
      tone: 'danger',
      title: `${medicine.brandName} is out of stock`,
      detail: `Reorder level is ${number.format(medicine.reorderLevel)} ${medicine.unit}.`,
      view: 'medicines',
    })
  })

  lowStock
    .filter((medicine) => (stockTotals.get(medicine.id) ?? 0) > 0)
    .forEach((medicine) => {
      notifications.push({
        id: `low-${medicine.id}`,
        tone: 'info',
        title: `${medicine.brandName} is low on stock`,
        detail: `Available: ${number.format(stockTotals.get(medicine.id) ?? 0)}. Reorder level: ${number.format(medicine.reorderLevel)}.`,
        view: 'medicines',
      })
    })

  return notifications.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
}

type ExecuteAction = (action: string, payload: Record<string, unknown>, successMessage?: string) => Promise<void>

function App() {
  const [db, setDb] = useState<Database>(createEmptyDatabase)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [hasUsers, setHasUsers] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeBranchId, setActiveBranchId] = useState('main')

  const currentUser = db.users.find((user) => user.id === sessionUserId && user.status === 'active') ?? null
  const activeBranches = useMemo(() => getActiveBranches(db), [db])
  const activeBranch = activeBranches.find((branch) => branch.id === activeBranchId) ?? activeBranches[0] ?? db.branches[0]
  const stockRows = useMemo(() => getStockRows(db), [db])
  const activeBranchStockRows = useMemo(() => activeBranch ? stockRows.filter((row) => row.batch.branchId === activeBranch.id) : stockRows, [activeBranch, stockRows])
  const stockTotals = useMemo(() => aggregateMedicineStock(stockRows), [stockRows])
  const canWrite = currentUser ? currentUser.role !== 'viewer' : false
  const canAdjust = currentUser ? currentUser.role === 'admin' || currentUser.role === 'pharmacist' : false
  const canAdmin = currentUser?.role === 'admin'
  const canWriteActiveBranch = currentUser && activeBranch ? canWriteBranch(currentUser, activeBranch.id) : false
  const notifications = useMemo(() => currentUser ? buildNotifications(db, stockRows, stockTotals, currentUser) : [], [currentUser, db, stockRows, stockTotals])

  useEffect(() => {
    async function load() {
      try {
        setConnectionError('')
        const boot = await bootstrap()
        if (!boot.settings) {
          throw new Error('Backend API is not available. Run npx vercel dev with DATABASE_URL for API-backed flows.')
        }
        setHasUsers(boot.hasUsers)
        setDb((previous) => ({ ...previous, settings: boot.settings }))
        if (getStoredToken()) {
          const state = await loadState()
          setDb(state.db)
          setSessionUserId(state.currentUser.id)
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

  const forceSignOut = useCallback(async (message?: string) => {
    try {
      await apiLogout()
    } catch {
      clearStoredToken()
    }
    setSessionUserId(null)
    setActiveView('dashboard')
    setSidebarOpen(false)
    if (message) setConnectionError(message)
  }, [])

  async function executeAction(action: string, payload: Record<string, unknown>, successMessage?: string) {
    try {
      const result = await runAction(action, payload)
      setDb(result.db)
      setSessionUserId(result.currentUser.id)
      setConnectionError('')
      if (successMessage) flash(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete action'
      if (message.toLowerCase().includes('authentication')) {
        await forceSignOut('Session expired. Please sign in again.')
        return
      }
      flash(message)
    }
  }

  async function createFirstAdmin(input: SetupInput) {
    const result = await setupWorkspace(input)
    setDb(result.db)
    setSessionUserId(result.currentUser.id)
    setHasUsers(true)
    setActiveView('dashboard')
  }

  async function registerUser(input: RegisterInput) {
    await apiRegisterUser(input)
  }

  async function signIn(email: string, password: string) {
    const result = await apiLogin(email, password)
    setDb(result.db)
    setSessionUserId(result.currentUser.id)
    setConnectionError('')
    setActiveView('dashboard')
  }

  async function signOut() {
    await forceSignOut()
  }

  function navigate(view: View) {
    setActiveView(view)
    setSidebarOpen(false)
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

  if (loading) return <LoadingScreen />

  if (!currentUser) {
    return (
      <AuthScreen
        hasUsers={hasUsers}
        pharmacyName={db.settings.pharmacyName}
        connectionError={connectionError}
        createFirstAdmin={createFirstAdmin}
        login={signIn}
        registerUser={registerUser}
      />
    )
  }

  const pendingUsers = db.users.filter((user) => user.status === 'pending').length
  const unreadChat = notifications.some((notification) => notification.id === 'chat-unread') ? db.chatMessages.filter((message) => message.userId !== currentUser.id && new Date(message.createdAt).getTime() > (currentUser.lastChatSeenAt ? new Date(currentUser.lastChatSeenAt).getTime() : 0)).length : 0

  return (
    <div className={sidebarOpen ? 'app-shell sidebar-open' : 'app-shell'}>
      <button className="sidebar-backdrop" type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Pill size={22} />
          </div>
          <div>
            <strong>{db.settings.softwareName}</strong>
            <span>{db.settings.accountName}</span>
          </div>
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
                {viewId === 'users' && pendingUsers > 0 && <b className="nav-badge">{pendingUsers}</b>}
                {viewId === 'chat' && unreadChat > 0 && <b className="nav-badge">{unreadChat}</b>}
                {viewId === 'notifications' && notifications.length > 0 && <b className="nav-badge">{notifications.length}</b>}
              </button>
            )
          })}
        </nav>

        <div className="user-panel">
          <div>
            <strong>{currentUser.name}</strong>
            <span>{roleLabels[currentUser.role]}</span>
          </div>
          <button className="icon-button" type="button" onClick={() => { void signOut() }} title="Log out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <button className="mobile-menu-button" type="button" onClick={() => setSidebarOpen((open) => !open)} aria-label={sidebarOpen ? 'Close menu' : 'Open menu'} aria-expanded={sidebarOpen}>
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <span className="eyebrow">{db.settings.accountName}</span>
              <h1>{views.find((view) => view.id === activeView)?.label}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            {notice && <span className="notice">{notice}</span>}
            {activeBranch && (
              <label className="branch-switcher">
                <Building2 size={16} />
                <select value={activeBranch.id} onChange={(event) => setActiveBranchId(event.target.value)}>
                  {activeBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name} / {currentUser ? getUserBranchStatus(currentUser, branch.id) : 'View only'}</option>
                  ))}
                </select>
              </label>
            )}
            {canAdmin && pendingUsers > 0 && (
              <button className="ghost-button" type="button" onClick={() => navigate('users')}>
                <UserCheck size={16} />
                {pendingUsers} pending
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

        {activeView === 'dashboard' && <Dashboard db={db} stockRows={stockRows} stockTotals={stockTotals} setActiveView={setActiveView} />}
        {activeView === 'medicines' && <Medicines db={db} stockTotals={stockTotals} canWrite={canWrite} executeAction={executeAction} flash={flash} />}
        {activeView === 'suppliers' && <Suppliers db={db} canWrite={canWrite} executeAction={executeAction} />}
        {activeView === 'receive' && activeBranch && <ReceiveStock db={db} activeBranch={activeBranch} canWrite={Boolean(canWriteActiveBranch)} executeAction={executeAction} flash={flash} />}
        {activeView === 'issue' && activeBranch && <IssueStock db={db} activeBranch={activeBranch} stockRows={activeBranchStockRows} canWrite={Boolean(canWriteActiveBranch)} executeAction={executeAction} flash={flash} />}
        {activeView === 'adjust' && activeBranch && <Adjustments activeBranch={activeBranch} stockRows={activeBranchStockRows} canAdjust={canAdjust && Boolean(canWriteActiveBranch)} executeAction={executeAction} flash={flash} />}
        {activeView === 'reports' && <Reports db={db} stockRows={stockRows} stockTotals={stockTotals} />}
        {activeView === 'chat' && <ChatView db={db} currentUser={currentUser} executeAction={executeAction} />}
        {activeView === 'notifications' && <NotificationsView notifications={notifications} setActiveView={setActiveView} />}
        {activeView === 'audit' && <Audit db={db} />}
        {activeView === 'users' && <UserManagement db={db} currentUser={currentUser} executeAction={executeAction} flash={flash} />}
        {activeView === 'branches' && activeBranch && <BranchesView db={db} currentUser={currentUser} activeBranchId={activeBranch.id} setActiveBranchId={setActiveBranchId} executeAction={executeAction} />}
        {activeView === 'settings' && <SettingsView db={db} canAdmin={canAdmin} executeAction={executeAction} />}
      </main>
    </div>
  )
}

type SetupInput = {
  pharmacyName: string
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

function LoadingScreen() {
  return (
    <main className="login-screen">
      <section className="login-panel auth-panel">
        <div className="brand-mark large">
          <Pill size={30} />
        </div>
        <div>
          <span className="eyebrow">Connecting</span>
          <h1>Loading pharmacy workspace</h1>
          <p>Connecting to the shared inventory database.</p>
        </div>
      </section>
    </main>
  )
}

function AuthScreen({
  hasUsers,
  pharmacyName,
  connectionError,
  createFirstAdmin,
  login,
  registerUser,
}: {
  hasUsers: boolean
  pharmacyName: string
  connectionError: string
  createFirstAdmin: (input: SetupInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  registerUser: (input: RegisterInput) => Promise<void>
}) {
  const [mode, setMode] = useState<AuthMode>(hasUsers ? 'login' : 'setup')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const activeMode: AuthMode = hasUsers ? mode : 'setup'

  return (
    <main className="login-screen">
      <section className="login-panel auth-panel">
        <div className="brand-mark large">
          <Pill size={30} />
        </div>
        <div>
          <span className="eyebrow">{activeMode === 'setup' ? 'RxLedger setup' : pharmacyName}</span>
          <h1>{activeMode === 'setup' ? 'Create your pharmacy account' : 'Sign in to RxLedger'}</h1>
          <p>{activeMode === 'setup' ? 'Create the company account, first branch, and permanent administrator before adding medicines, suppliers, and stock.' : 'Use your approved staff account. New staff can request access for admin review.'}</p>
        </div>

        {activeMode !== 'setup' && (
          <div className="tabs auth-tabs">
            <button className={activeMode === 'login' ? 'active' : ''} type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>Sign in</button>
            <button className={activeMode === 'register' ? 'active' : ''} type="button" onClick={() => { setMode('register'); setError(''); setSuccess('') }}>Request access</button>
          </div>
        )}

        {activeMode === 'setup' && <SetupForm createFirstAdmin={createFirstAdmin} setError={setError} />}
        {activeMode === 'login' && <LoginForm login={login} setError={setError} setSuccess={setSuccess} />}
        {activeMode === 'register' && <RegisterForm registerUser={registerUser} setError={setError} setSuccess={setSuccess} />}

        {connectionError && <div className="form-error">{connectionError}</div>}
        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}
      </section>
    </main>
  )
}

function SetupForm({ createFirstAdmin, setError }: { createFirstAdmin: (input: SetupInput) => Promise<void>; setError: (message: string) => void }) {
  const [form, setForm] = useState<SetupInput>({
    pharmacyName: '',
    branchName: 'Main Branch',
    name: '',
    email: '',
    phone: '',
    password: '',
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    await createFirstAdmin(form)
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="full">Account/company name<input required value={form.pharmacyName} onChange={(event) => setForm({ ...form, pharmacyName: event.target.value })} placeholder="Totalenergies EP" autoFocus /></label>
      <label className="full">First branch/site<input required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} placeholder="Deepwater Medical LOS" /></label>
      <label className="full">Permanent admin full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Phone<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label className="full">Password<input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
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
    <form className="stack" onSubmit={submit}>
      <label>Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
      <label>Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
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

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    try {
      await registerUser(form)
      setForm({ name: '', email: '', phone: '', password: '' })
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
      <label className="full">Password<input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <div className="form-actions full">
        <button className="primary-button" type="submit">
          <UserPlus size={17} />
          Request access
        </button>
      </div>
    </form>
  )
}

function Dashboard({
  db,
  stockRows,
  stockTotals,
  setActiveView,
}: {
  db: Database
  stockRows: StockRow[]
  stockTotals: Map<string, number>
  setActiveView: (view: View) => void
}) {
  const lowStock = db.medicines.filter((medicine) => (stockTotals.get(medicine.id) ?? 0) <= medicine.reorderLevel)
  const nearExpiry = stockRows.filter((row) => row.quantity > 0 && row.status === 'near-expiry')
  const expired = stockRows.filter((row) => row.quantity > 0 && row.status === 'expired')
  const costValue = stockRows.reduce((sum, row) => sum + Math.max(0, row.costValue), 0)
  const todayMovements = db.ledger.filter((entry) => entry.createdAt.slice(0, 10) === today()).length
  const pendingUsers = db.users.filter((user) => user.status === 'pending').length
  const activeBranches = getActiveBranches(db)
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
        <Metric icon={Boxes} label="Active SKUs" value={db.medicines.filter((medicine) => medicine.active).length} />
        <Metric icon={Building2} label="Active branches" value={activeBranches.length} />
        <Metric icon={Archive} label="Stock value at cost" value={money.format(costValue)} />
        <Metric icon={AlertTriangle} label="Low stock items" value={lowStock.length} tone={lowStock.length ? 'warning' : 'good'} />
        <Metric icon={XCircle} label="Expired batches" value={expired.length} tone={expired.length ? 'danger' : 'good'} />
        <Metric icon={Activity} label="Movements today" value={todayMovements} />
      </section>

      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Main Account Overview</h2>
            <p>Company-level view across branches/sites. Stock remains held by branches.</p>
          </div>
          <span className="pill active">{db.settings.accountName}</span>
        </div>
        <div className="branch-grid">
          {branchSummaries.map(({ branch, branchStockValue, branchExpired, branchNearExpiry, branchSkuCount }) => (
            <article className="branch-card" key={branch.id}>
              <Building2 size={19} />
              <div>
                <strong>{branch.name}</strong>
                <span>{branch.code}</span>
                <span>{branchSkuCount} stocked SKU{branchSkuCount === 1 ? '' : 's'} / {money.format(branchStockValue)}</span>
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
            <p>Low stock, expiry risk, expired inventory, and access approvals.</p>
          </div>
          <button className="ghost-button" type="button" onClick={() => setActiveView('reports')}>
            <FileText size={16} />
            Reports
          </button>
        </div>
        <div className="alert-list">
          {pendingUsers > 0 && (
            <AlertItem tone="warning" title={`${pendingUsers} staff access request${pendingUsers > 1 ? 's' : ''} pending`} detail="An admin should approve users and assign the correct role before they can sign in." />
          )}
          {expired.map((row) => (
            <AlertItem key={row.batch.id} tone="danger" title={`${row.medicine.brandName} expired`} detail={`${row.batch.batchNumber} has ${number.format(row.quantity)} ${row.medicine.unit} in ${row.batch.location}`} />
          ))}
          {nearExpiry.slice(0, 5).map((row) => (
            <AlertItem key={row.batch.id} tone="warning" title={`${row.medicine.brandName} expires in ${row.daysToExpiry} days`} detail={`${row.batch.batchNumber}, ${number.format(row.quantity)} ${row.medicine.unit} available`} />
          ))}
          {lowStock.map((medicine) => (
            <AlertItem key={medicine.id} tone="info" title={`${medicine.brandName} is at or below reorder level`} detail={`Available: ${number.format(stockTotals.get(medicine.id) ?? 0)}. Reorder level: ${number.format(medicine.reorderLevel)}`} />
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
        <StockTable rows={stockRows.filter((row) => row.quantity > 0).slice(0, 8)} />
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

function AlertItem({ title, detail, tone }: { title: string; detail: string; tone: 'danger' | 'warning' | 'info' | 'good' }) {
  const Icon = tone === 'danger' ? XCircle : tone === 'warning' ? AlertTriangle : tone === 'good' ? CheckCircle2 : ClipboardList
  return (
    <div className={`alert-item ${tone}`}>
      <Icon size={19} />
      <div>
        <strong>{title}</strong>
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
  stockTotals,
  canWrite,
  executeAction,
  flash,
}: {
  db: Database
  stockTotals: Map<string, number>
  canWrite: boolean
  executeAction: ExecuteAction
  flash: (message: string) => void
}) {
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
    unit: 'Unit',
    category: '',
    manufacturer: '',
    nafdacNumber: '',
    barcodes: '',
    reorderLevel: 20,
    active: true,
  })
  const [drafts, setDrafts] = useState<MedicineDraft[]>([createBlank()])
  const [query, setQuery] = useState('')
  const isEditing = drafts.length === 1 && Boolean(drafts[0].id)

  const visible = db.medicines.filter((medicine) => {
    const text = `${medicine.sku} ${medicine.brandName} ${medicine.genericName} ${medicine.nafdacNumber} ${medicine.barcodes.join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

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
      unit: draft.unit.trim() || 'Unit',
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
        unit: getImportValue(row, ['unit', 'unit of measure', 'uom']) || 'Unit',
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
    void executeAction(records.length === 1 ? 'upsertMedicine' : 'upsertMedicines', records.length === 1 ? { record: records[0] } : { records }, `${records.length} medicine record${records.length > 1 ? 's' : ''} saved`)
    resetDrafts()
  }

  return (
    <div className="two-column">
      <section className="content-section">
        <div className="section-heading">
          <div>
            <h2>Medicine Catalog</h2>
            <p>Capture NAFDAC number, barcode, dosage form, reorder level, and manufacturer.</p>
          </div>
          <div className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search catalog" />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>SKU</th>
                <th>NAFDAC</th>
                <th>Barcode</th>
                <th>Stock</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((medicine) => (
                  <tr key={medicine.id}>
                    <td>
                      <strong>{medicine.brandName}</strong>
                      <span>{medicine.genericName} / {medicine.strength} / {medicine.form}</span>
                    </td>
                    <td>{medicine.sku}</td>
                    <td>{medicine.nafdacNumber || '-'}</td>
                    <td>{medicine.barcodes[0] ?? '-'}</td>
                    <td>{number.format(stockTotals.get(medicine.id) ?? 0)}</td>
                    <td><span className={medicine.active ? 'pill good' : 'pill muted'}>{medicine.active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                      <button className="icon-button" type="button" onClick={() => edit(medicine)} title="Edit medicine" disabled={!canWrite}>
                        <ClipboardList size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7}>No medicine records yet. Add the pharmacy catalog before receiving stock.</td></tr>
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
                  <label>Unit<input value={draft.unit} onChange={(event) => updateDraft(draft.rowId, { unit: event.target.value })} disabled={!canWrite} /></label>
                  <label>Category<input value={draft.category} onChange={(event) => updateDraft(draft.rowId, { category: event.target.value })} disabled={!canWrite} /></label>
                  <label>Manufacturer<input value={draft.manufacturer} onChange={(event) => updateDraft(draft.rowId, { manufacturer: event.target.value })} disabled={!canWrite} /></label>
                  <label>Reorder level<input type="number" min="0" value={draft.reorderLevel} onChange={(event) => updateDraft(draft.rowId, { reorderLevel: Number(event.target.value) })} disabled={!canWrite} /></label>
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
    medicineId: string
    batchNumber: string
    expiryDate: string
    quantity: number
    unitCost: number
    sellingPrice: number
    location: string
  }
  const createLine = (): ReceiveLine => ({
    rowId: id('line'),
    medicineId: '',
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
  const selectedSupplierId = header.supplierId || db.suppliers[0]?.id || ''

  function updateLine(rowId: string, updates: Partial<ReceiveLine>) {
    setLines((current) => current.map((line) => (line.rowId === rowId ? { ...line, ...updates } : line)))
  }

  function addLine() {
    setLines((current) => [...current, createLine()])
  }

  function removeLine(rowId: string) {
    setLines((current) => current.length > 1 ? current.filter((line) => line.rowId !== rowId) : [createLine()])
  }

  function applyScan() {
    const medicine = findMedicineByScan(db, scan)
    if (!medicine) {
      flash('No medicine found for scanned code')
      return
    }
    setLines((current) => current.map((line, index) => index === current.length - 1 ? { ...line, medicineId: medicine.id } : line))
    flash(`${medicine.brandName} selected`)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    if (!selectedSupplierId || !db.medicines.length || !activeBranch.id) {
      flash('Add at least one medicine, supplier, and branch before receiving stock')
      return
    }
    const items = lines.map((line) => ({ ...line, medicineId: line.medicineId || db.medicines[0]?.id || '' }))
    if (items.some((line) => !line.medicineId || !line.batchNumber || !line.expiryDate || Number(line.quantity) <= 0)) {
      flash('Medicine, batch number, expiry, and quantity are required for every line')
      return
    }
    if (items.some((line) => line.expiryDate < today())) {
      flash('Receiving blocked: expiry date must be today or later')
      return
    }
    if (items.some((line) => Number(line.sellingPrice) > 0 && Number(line.sellingPrice) < Number(line.unitCost))) {
      flash('Receiving blocked: selling price cannot be lower than unit cost')
      return
    }
    void executeAction('receiveStock', {
      supplierId: selectedSupplierId,
      invoiceRef: header.invoiceRef,
      branchId: activeBranch.id,
      items,
    }, `${items.length} stock line${items.length > 1 ? 's' : ''} received and posted`)
    setHeader({ ...header, invoiceRef: '' })
    setLines([createLine()])
    setScan('')
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
        <label className="scan-field full">Scan barcode or SKU<div><Barcode size={17} /><input value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyScan() } }} placeholder="Scan, then press Enter to set the last item line" disabled={!canWrite || !db.medicines.length} /><button className="ghost-button" type="button" onClick={applyScan} disabled={!canWrite || !db.medicines.length}><Search size={16} />Lookup</button></div></label>

        <div className="line-editor full">
          {lines.map((line, index) => {
            const selectedMedicineId = line.medicineId || db.medicines[0]?.id || ''
            return (
              <div className="line-card" key={line.rowId}>
                <div className="line-card-heading">
                  <strong>Invoice item {index + 1}</strong>
                  <button className="icon-button" type="button" onClick={() => removeLine(line.rowId)} disabled={!canWrite} title="Remove item">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="form-grid">
                  <label className="full">Medicine<select required value={selectedMedicineId} onChange={(event) => updateLine(line.rowId, { medicineId: event.target.value })} disabled={!canWrite || !db.medicines.length}><option value="">Select medicine</option>{db.medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.brandName} / {medicine.genericName}</option>)}</select></label>
                  <label>Batch/Lot number<input required value={line.batchNumber} onChange={(event) => updateLine(line.rowId, { batchNumber: event.target.value })} disabled={!canWrite} /></label>
                  <label>Expiry date<input required type="date" value={line.expiryDate} onChange={(event) => updateLine(line.rowId, { expiryDate: event.target.value })} disabled={!canWrite} /></label>
                  <label>Quantity<input required type="number" min="1" value={line.quantity} onChange={(event) => updateLine(line.rowId, { quantity: Number(event.target.value) })} disabled={!canWrite} /></label>
                  <label>Unit cost<input type="number" min="0" value={line.unitCost} onChange={(event) => updateLine(line.rowId, { unitCost: Number(event.target.value) })} disabled={!canWrite} /></label>
                  <label>Selling price<input type="number" min="0" value={line.sellingPrice} onChange={(event) => updateLine(line.rowId, { sellingPrice: Number(event.target.value) })} disabled={!canWrite} /></label>
                  <label>Stock location<input value={line.location} onChange={(event) => updateLine(line.rowId, { location: event.target.value })} disabled={!canWrite} /></label>
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
          <button className="primary-button" type="submit" disabled={!canWrite || !db.medicines.length || !db.suppliers.length}>
            <PackagePlus size={17} />
            Post {lines.length} item{lines.length > 1 ? 's' : ''}
          </button>
        </div>
      </form>
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
    flash(`${medicine.brandName} selected`)
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
          <label className="full">Medicine<select required value={selectedMedicineId} onChange={(event) => setForm({ ...form, medicineId: event.target.value })} disabled={!canWrite || !db.medicines.length}><option value="">Select medicine</option>{db.medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.brandName} / {medicine.genericName}</option>)}</select></label>
          <label>Quantity<input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={!canWrite} /></label>
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
        <label className="full">Batch<select required value={selectedBatchId} onChange={(event) => setForm({ ...form, batchId: event.target.value })} disabled={!canAdjust || !positiveRows.length}><option value="">Select batch</option>{positiveRows.map((row) => <option key={row.batch.id} value={row.batch.id}>{row.medicine.brandName} / {row.batch.batchNumber} / Qty {row.quantity}</option>)}</select></label>
        <label>Transaction type<select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as LedgerType })} disabled={!canAdjust}><option value="write-off">Write-off</option><option value="supplier-return">Supplier return</option><option value="customer-return">Customer return</option><option value="adjustment">Positive adjustment</option></select></label>
        <label>Quantity<input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={!canAdjust} /></label>
        <label className="full">Reason<textarea required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} disabled={!canAdjust} /></label>
        <label className="full">Reference<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} disabled={!canAdjust} /></label>
        {selected && <div className="availability full"><strong>{selected.medicine.brandName}</strong><span>{selected.batch.batchNumber} / available {number.format(selected.quantity)} / expires {selected.batch.expiryDate}</span></div>}
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

function Reports({ db, stockRows, stockTotals }: { db: Database; stockRows: StockRow[]; stockTotals: Map<string, number> }) {
  const [report, setReport] = useState<'stock' | 'movement' | 'expiry' | 'reorder'>('stock')

  const rows: ReportRow[] = useMemo(() => {
    if (report === 'movement') {
      return db.ledger.map((entry) => {
        const medicine = db.medicines.find((item) => item.id === entry.medicineId)
        const batch = db.batches.find((item) => item.id === entry.batchId)
        const user = db.users.find((item) => item.id === entry.userId)
        return {
          Date: new Date(entry.createdAt).toLocaleString(),
          Type: movementLabels[entry.type],
          Medicine: medicine?.brandName ?? 'Unknown',
          Batch: batch?.batchNumber ?? '-',
          Branch: getBranchName(db, batch?.branchId ?? 'main'),
          Quantity: entry.quantity,
          Reason: entry.reason,
          Reference: entry.reference,
          User: user?.name ?? 'Unknown',
        }
      })
    }
    if (report === 'expiry') {
      return stockRows
        .filter((row) => row.quantity > 0)
        .sort((a, b) => a.batch.expiryDate.localeCompare(b.batch.expiryDate))
        .map((row) => ({
          Medicine: row.medicine.brandName,
          Generic: row.medicine.genericName,
          Batch: row.batch.batchNumber,
          Expiry: row.batch.expiryDate,
          Days: row.daysToExpiry,
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
          Available: stockTotals.get(medicine.id) ?? 0,
          'Reorder Level': medicine.reorderLevel,
          Manufacturer: medicine.manufacturer,
        }))
    }
    return stockRows.map((row) => ({
      SKU: row.medicine.sku,
      Medicine: row.medicine.brandName,
      Generic: row.medicine.genericName,
      Batch: row.batch.batchNumber,
      Expiry: row.batch.expiryDate,
      Quantity: row.quantity,
      'Unit Cost': row.batch.unitCost,
      'Cost Value': row.costValue,
      Supplier: row.supplier?.name ?? '-',
      Branch: row.branch?.name ?? row.batch.branchId,
      Location: row.batch.location,
    }))
  }, [db, report, stockRows, stockTotals])

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
        <button className={report === 'expiry' ? 'active' : ''} onClick={() => setReport('expiry')} type="button">Expiry</button>
        <button className={report === 'reorder' ? 'active' : ''} onClick={() => setReport('reorder')} type="button">Reorder</button>
      </div>
      <ReportTable rows={rows} />
    </section>
  )
}

function ChatView({ db, currentUser, executeAction }: { db: Database; currentUser: User; executeAction: ExecuteAction }) {
  const [body, setBody] = useState('')
  const readMarked = useRef(false)

  useEffect(() => {
    if (!readMarked.current) {
      readMarked.current = true
      void executeAction('markChatRead', {})
    }
  }, [executeAction])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    void executeAction('sendChatMessage', { body }, 'Message sent')
    setBody('')
  }

  const messages = [...db.chatMessages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return (
    <section className="content-section chat-section">
      <div className="section-heading">
        <div>
          <h2>Team Chat</h2>
          <p>Operational notes for pharmacists, inventory staff, and admins using this workspace.</p>
        </div>
      </div>
      <div className="chat-list">
        {messages.length ? (
          messages.map((message) => {
            const user = db.users.find((item) => item.id === message.userId)
            const mine = message.userId === currentUser.id
            return (
              <article className={mine ? 'chat-message mine' : 'chat-message'} key={message.id}>
                <div>
                  <strong>{mine ? 'You' : user?.name ?? 'Team member'}</strong>
                  <span>{new Date(message.createdAt).toLocaleString()}</span>
                </div>
                <p>{message.body}</p>
              </article>
            )
          })
        ) : (
          <div className="empty-state">No messages yet.</div>
        )}
      </div>
      <form className="chat-composer" onSubmit={submit}>
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Type a message for the team" maxLength={2000} />
        <button className="primary-button" type="submit" disabled={!body.trim()}>
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
                  <span>{user.role === 'admin' ? 'All branches' : db.branches.filter((branch) => user.branchIds.includes(branch.id) || user.managedBranchIds.includes(branch.id)).map((branch) => branch.name).join(', ') || 'View only everywhere'}</span>
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
  const canManageSelected = selectedBranch ? canManageBranch(currentUser, selectedBranch.id) : false
  const assignableUsers = db.users.filter((user) => user.status === 'active' && user.role !== 'admin')
  const managerOptions = db.users.filter((user) => user.status === 'active' && user.role !== 'viewer')

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
    if (form.id && form.id !== selectedBranch?.id && currentUser.role !== 'admin') return
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
    void executeAction('updateBranchAccess', {
      userId: user.id,
      branchId: selectedBranch.id,
      canAccess,
    }, 'Branch access updated')
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
                <span>{branch.code || 'No code'} / {branch.active ? 'Active' : 'Inactive'} / {getUserBranchStatus(currentUser, branch.id)}</span>
                <span>{db.users.find((user) => user.id === branch.managerUserId)?.name || branch.managerName || 'No manager'} / {branch.phone || 'No phone'}</span>
                <span>{branch.address || 'No address recorded'}</span>
              </div>
              <button className="ghost-button" type="button" onClick={() => switchBranch(branch)}>
                Use
              </button>
              <button className="icon-button" type="button" onClick={() => edit(branch)} disabled={!canManageBranch(currentUser, branch.id)} title="Edit branch">
                <ClipboardList size={16} />
              </button>
            </article>
          ))}
        </div>
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
          <label className="full">Branch/site name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} disabled={form.id ? !canManageSelected : currentUser.role !== 'admin'} /></label>
          <label>Code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="LOS-01" disabled={form.id ? !canManageSelected : currentUser.role !== 'admin'} /></label>
          <label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} disabled={form.id ? !canManageSelected : currentUser.role !== 'admin'} /></label>
          <label className="full">Manager<select value={form.managerUserId || ''} onChange={(event) => setForm({ ...form, managerUserId: event.target.value, managerName: db.users.find((user) => user.id === event.target.value)?.name ?? form.managerName })} disabled={currentUser.role !== 'admin'}><option value="">No assigned manager</option>{managerOptions.map((user) => <option key={user.id} value={user.id}>{user.name} / {roleLabels[user.role]}</option>)}</select></label>
          <label className="full">Manager/contact person<input value={form.managerName} onChange={(event) => setForm({ ...form, managerName: event.target.value })} disabled={form.id ? !canManageSelected : currentUser.role !== 'admin'} /></label>
          <label className="full">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} disabled={form.id ? !canManageSelected : currentUser.role !== 'admin'} /></label>
          <label className="checkbox-row full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} disabled={currentUser.role !== 'admin' || form.id === 'main'} /> Active branch</label>
          <div className="form-actions full">
            <button className="ghost-button" type="button" onClick={() => setForm(createBlank())}>Clear</button>
            <button className="primary-button" type="submit" disabled={form.id ? !canManageSelected : currentUser.role !== 'admin'}>
              <Building2 size={17} />
              Save branch
            </button>
          </div>
        </form>

        {selectedBranch && (
          <div className="branch-access-panel">
            <div className="section-heading">
              <div>
                <h2>{selectedBranch.name} Staff Access</h2>
                <p>Users without access can view this branch only. Assigned users can work here according to their role.</p>
              </div>
              <span className={canManageSelected ? 'pill active' : 'pill muted'}>{canManageSelected ? 'Can authorize' : 'View only'}</span>
            </div>
            <div className="access-list">
              {assignableUsers.map((user) => {
                const hasAccess = user.branchIds.includes(selectedBranch.id) || user.managedBranchIds.includes(selectedBranch.id)
                const isManager = user.managedBranchIds.includes(selectedBranch.id)
                return (
                  <label className="access-row" key={user.id}>
                    <input type="checkbox" checked={hasAccess} onChange={(event) => updateBranchAccess(user, event.target.checked)} disabled={!canManageSelected || isManager} />
                    <span><strong>{user.name}</strong>{user.email}</span>
                    <b className={isManager ? 'pill active' : hasAccess ? 'pill good' : 'pill muted'}>{isManager ? 'Manager' : hasAccess ? roleLabels[user.role] : 'View only'}</b>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

function SettingsView({ db, canAdmin, executeAction }: { db: Database; canAdmin: boolean; executeAction: ExecuteAction }) {
  const [form, setForm] = useState(db.settings)

  function submit(event: FormEvent) {
    event.preventDefault()
    void executeAction('updateSettings', form, 'Settings saved')
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
        <label>Software name<input value={form.softwareName} onChange={(event) => setForm({ ...form, softwareName: event.target.value })} disabled={!canAdmin} /></label>
        <label>Account/company name<input value={form.accountName} onChange={(event) => setForm({ ...form, accountName: event.target.value, pharmacyName: event.target.value })} disabled={!canAdmin} /></label>
        <label>Default branch name<input value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} disabled={!canAdmin} /></label>
        <label>Near-expiry days<input type="number" min="1" value={form.nearExpiryDays} onChange={(event) => setForm({ ...form, nearExpiryDays: Number(event.target.value) })} disabled={!canAdmin} /></label>
        <label>Approval threshold (NGN)<input type="number" min="0" value={form.approvalThreshold} onChange={(event) => setForm({ ...form, approvalThreshold: Number(event.target.value) })} disabled={!canAdmin} /></label>
        <div className="form-actions full">
          <button className="primary-button" type="submit" disabled={!canAdmin}>
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
                  <strong>{row.medicine.brandName}</strong>
                  <span>{row.medicine.genericName}</span>
                </td>
                <td>{row.batch.batchNumber}</td>
                <td>{row.batch.expiryDate}</td>
                <td>{number.format(row.quantity)}</td>
                {!compact && <td>{row.branch?.name ?? row.batch.branchId}</td>}
                <td>{row.batch.location}</td>
                {!compact && <td><span className={`pill ${row.status}`}>{row.status.replace('-', ' ')}</span></td>}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={compact ? 5 : 7}>No stock rows yet.</td>
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
