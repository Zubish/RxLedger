import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  Archive,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Pill,
  Printer,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  UserCheck,
  UserPlus,
  Users,
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
  | 'audit'
  | 'users'
  | 'settings'

type User = {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  status: UserStatus
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

type AppSettings = {
  pharmacyName: string
  branchName: string
  nearExpiryDays: number
  approvalThreshold: number
}

type Database = {
  users: User[]
  medicines: Medicine[]
  suppliers: Supplier[]
  batches: Batch[]
  ledger: LedgerEntry[]
  receipts: Receipt[]
  auditLogs: AuditLog[]
  settings: AppSettings
}

type StockRow = {
  batch: Batch
  medicine: Medicine
  supplier: Supplier | undefined
  quantity: number
  costValue: number
  daysToExpiry: number
  status: 'expired' | 'near-expiry' | 'ok'
}

type ReportRow = Record<string, string | number>
type AuthMode = 'login' | 'register' | 'setup'

const views: Array<{ id: View; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'medicines', label: 'Medicines', icon: Pill },
  { id: 'suppliers', label: 'Suppliers', icon: Truck },
  { id: 'receive', label: 'Receive', icon: PackagePlus },
  { id: 'issue', label: 'Issue Stock', icon: PackageMinus },
  { id: 'adjust', label: 'Adjust/Returns', icon: RotateCcw },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'audit', label: 'Audit', icon: ShieldCheck },
  { id: 'users', label: 'Users', icon: Users, adminOnly: true },
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
    batches: [],
    ledger: [],
    receipts: [],
    auditLogs: [],
    settings: {
      pharmacyName: 'Pharmacy Inventory',
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

type ExecuteAction = (action: string, payload: Record<string, unknown>, successMessage: string) => Promise<void>

function App() {
  const [db, setDb] = useState<Database>(createEmptyDatabase)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<View>('dashboard')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [hasUsers, setHasUsers] = useState(false)

  const currentUser = db.users.find((user) => user.id === sessionUserId && user.status === 'active') ?? null
  const stockRows = useMemo(() => getStockRows(db), [db])
  const stockTotals = useMemo(() => aggregateMedicineStock(stockRows), [stockRows])
  const canWrite = currentUser ? currentUser.role !== 'viewer' : false
  const canAdjust = currentUser ? currentUser.role === 'admin' || currentUser.role === 'pharmacist' : false
  const canAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    async function load() {
      try {
        setConnectionError('')
        const boot = await bootstrap()
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

  async function executeAction(action: string, payload: Record<string, unknown>, successMessage: string) {
    try {
      const result = await runAction(action, payload)
      setDb(result.db)
      setSessionUserId(result.currentUser.id)
      flash(successMessage)
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Unable to complete action')
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
    setActiveView('dashboard')
  }

  async function signOut() {
    await apiLogout()
    setSessionUserId(null)
  }

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

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <Pill size={22} />
          </div>
          <div>
            <strong>{db.settings.pharmacyName}</strong>
            <span>{db.settings.branchName}</span>
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
                onClick={() => !disabled && setActiveView(viewId)}
                disabled={disabled}
                title={label}
              >
                <Icon size={18} />
                <span>{label}</span>
                {viewId === 'users' && pendingUsers > 0 && <b className="nav-badge">{pendingUsers}</b>}
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
          <div>
            <span className="eyebrow">Operational inventory control</span>
            <h1>{views.find((view) => view.id === activeView)?.label}</h1>
          </div>
          <div className="topbar-actions">
            {notice && <span className="notice">{notice}</span>}
            {canAdmin && pendingUsers > 0 && (
              <button className="ghost-button" type="button" onClick={() => setActiveView('users')}>
                <UserCheck size={16} />
                {pendingUsers} pending
              </button>
            )}
          </div>
        </header>

        {activeView === 'dashboard' && <Dashboard db={db} stockRows={stockRows} stockTotals={stockTotals} setActiveView={setActiveView} />}
        {activeView === 'medicines' && <Medicines db={db} stockTotals={stockTotals} canWrite={canWrite} executeAction={executeAction} flash={flash} />}
        {activeView === 'suppliers' && <Suppliers db={db} canWrite={canWrite} executeAction={executeAction} />}
        {activeView === 'receive' && <ReceiveStock db={db} canWrite={canWrite} executeAction={executeAction} flash={flash} />}
        {activeView === 'issue' && <IssueStock db={db} stockRows={stockRows} canWrite={canWrite} executeAction={executeAction} flash={flash} />}
        {activeView === 'adjust' && <Adjustments stockRows={stockRows} canAdjust={canAdjust} executeAction={executeAction} flash={flash} />}
        {activeView === 'reports' && <Reports db={db} stockRows={stockRows} stockTotals={stockTotals} />}
        {activeView === 'audit' && <Audit db={db} />}
        {activeView === 'users' && <UserManagement db={db} currentUser={currentUser} executeAction={executeAction} flash={flash} />}
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
          <span className="eyebrow">{activeMode === 'setup' ? 'First run setup' : pharmacyName}</span>
          <h1>{activeMode === 'setup' ? 'Set up your pharmacy workspace' : 'Sign in to manage pharmacy inventory'}</h1>
          <p>{activeMode === 'setup' ? 'Create the first administrator account before adding medicines, suppliers, and stock.' : 'Use your approved staff account. New staff can request access for admin review.'}</p>
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
      <label className="full">Pharmacy name<input required value={form.pharmacyName} onChange={(event) => setForm({ ...form, pharmacyName: event.target.value })} autoFocus /></label>
      <label className="full">Branch name<input required value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} /></label>
      <label className="full">Admin full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>Phone<input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label className="full">Password<input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <div className="form-actions full">
        <button className="primary-button" type="submit">
          <ShieldCheck size={17} />
          Create admin workspace
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

  return (
    <div className="page-grid">
      <section className="metric-grid">
        <Metric icon={Boxes} label="Active SKUs" value={db.medicines.filter((medicine) => medicine.active).length} />
        <Metric icon={Archive} label="Stock value at cost" value={money.format(costValue)} />
        <Metric icon={AlertTriangle} label="Low stock items" value={lowStock.length} tone={lowStock.length ? 'warning' : 'good'} />
        <Metric icon={XCircle} label="Expired batches" value={expired.length} tone={expired.length ? 'danger' : 'good'} />
        <Metric icon={Activity} label="Movements today" value={todayMovements} />
        <Metric icon={UserCheck} label="Pending users" value={pendingUsers} tone={pendingUsers ? 'warning' : 'good'} />
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
  const empty = {
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
  }
  const [form, setForm] = useState(empty)
  const [query, setQuery] = useState('')

  const visible = db.medicines.filter((medicine) => {
    const text = `${medicine.sku} ${medicine.brandName} ${medicine.genericName} ${medicine.nafdacNumber} ${medicine.barcodes.join(' ')}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  function edit(medicine: Medicine) {
    setForm({ ...medicine, barcodes: medicine.barcodes.join(', ') })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!canWrite) return
    const barcodes = form.barcodes
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const duplicateBarcode = db.medicines.find((medicine) => medicine.id !== form.id && medicine.barcodes.some((code) => barcodes.includes(code)))
    if (duplicateBarcode) {
      flash(`Barcode already belongs to ${duplicateBarcode.brandName}`)
      return
    }
    const record: Medicine = { ...form, id: form.id || id('med'), barcodes, reorderLevel: Number(form.reorderLevel) || 0 }
    void executeAction('upsertMedicine', { record }, 'Medicine saved')
    setForm(empty)
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
            <h2>{form.id ? 'Edit Medicine' : 'Add Medicine'}</h2>
            <p>Use comma-separated barcodes if a product has multiple pack codes.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label>Brand name<input required value={form.brandName} onChange={(event) => setForm({ ...form, brandName: event.target.value })} disabled={!canWrite} /></label>
          <label>Generic name<input required value={form.genericName} onChange={(event) => setForm({ ...form, genericName: event.target.value })} disabled={!canWrite} /></label>
          <label>SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} disabled={!canWrite} /></label>
          <label>NAFDAC number<input value={form.nafdacNumber} onChange={(event) => setForm({ ...form, nafdacNumber: event.target.value })} disabled={!canWrite} /></label>
          <label>Form<input value={form.form} onChange={(event) => setForm({ ...form, form: event.target.value })} disabled={!canWrite} /></label>
          <label>Strength<input value={form.strength} onChange={(event) => setForm({ ...form, strength: event.target.value })} disabled={!canWrite} /></label>
          <label>Unit<input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} disabled={!canWrite} /></label>
          <label>Category<input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} disabled={!canWrite} /></label>
          <label>Manufacturer<input value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} disabled={!canWrite} /></label>
          <label>Reorder level<input type="number" min="0" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: Number(event.target.value) })} disabled={!canWrite} /></label>
          <label className="full">Barcodes<input value={form.barcodes} onChange={(event) => setForm({ ...form, barcodes: event.target.value })} disabled={!canWrite} /></label>
          <label className="checkbox-row full"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} disabled={!canWrite} /> Active medicine</label>
          <div className="form-actions full">
            <button className="ghost-button" type="button" onClick={() => setForm(empty)}>Clear</button>
            <button className="primary-button" type="submit" disabled={!canWrite}>
              <PackageCheck size={17} />
              Save medicine
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

function ReceiveStock({ db, canWrite, executeAction, flash }: { db: Database; canWrite: boolean; executeAction: ExecuteAction; flash: (message: string) => void }) {
  const [scan, setScan] = useState('')
  const [form, setForm] = useState({
    medicineId: '',
    supplierId: '',
    invoiceRef: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 1,
    unitCost: 0,
    sellingPrice: 0,
    location: 'Main Store',
  })
  const selectedMedicineId = form.medicineId || db.medicines[0]?.id || ''
  const selectedSupplierId = form.supplierId || db.suppliers[0]?.id || ''

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
    if (!canWrite) return
    if (!selectedMedicineId || !selectedSupplierId) {
      flash('Add at least one medicine and supplier before receiving stock')
      return
    }
    if (!form.batchNumber || !form.expiryDate || form.quantity <= 0) {
      flash('Batch number, expiry, and quantity are required')
      return
    }
    void executeAction('receiveStock', {
      medicineId: selectedMedicineId,
      supplierId: selectedSupplierId,
      invoiceRef: form.invoiceRef,
      batchNumber: form.batchNumber,
      expiryDate: form.expiryDate,
      quantity: form.quantity,
      unitCost: form.unitCost,
      sellingPrice: form.sellingPrice,
      location: form.location,
    }, 'Stock received and ledger updated')
    setForm({ ...form, invoiceRef: '', batchNumber: '', expiryDate: '', quantity: 1 })
    setScan('')
  }

  return (
    <section className="content-section narrow">
      <div className="section-heading">
        <div>
          <h2>Goods Receiving Note</h2>
          <p>Batch and expiry are mandatory for every stock-in transaction.</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label className="scan-field full">Scan barcode or SKU<div><Barcode size={17} /><input value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyScan() } }} placeholder="Scan, then press Enter" disabled={!canWrite || !db.medicines.length} /><button className="ghost-button" type="button" onClick={applyScan} disabled={!canWrite || !db.medicines.length}><Search size={16} />Lookup</button></div></label>
        <label className="full">Medicine<select required value={selectedMedicineId} onChange={(event) => setForm({ ...form, medicineId: event.target.value })} disabled={!canWrite || !db.medicines.length}><option value="">Select medicine</option>{db.medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.brandName} / {medicine.genericName}</option>)}</select></label>
        <label>Supplier<select required value={selectedSupplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} disabled={!canWrite || !db.suppliers.length}><option value="">Select supplier</option>{db.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
        <label>Invoice/reference<input value={form.invoiceRef} onChange={(event) => setForm({ ...form, invoiceRef: event.target.value })} disabled={!canWrite} /></label>
        <label>Batch/Lot number<input required value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} disabled={!canWrite} /></label>
        <label>Expiry date<input required type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} disabled={!canWrite} /></label>
        <label>Quantity<input required type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={!canWrite} /></label>
        <label>Unit cost<input type="number" min="0" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: Number(event.target.value) })} disabled={!canWrite} /></label>
        <label>Selling price<input type="number" min="0" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: Number(event.target.value) })} disabled={!canWrite} /></label>
        <label>Stock location<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} disabled={!canWrite} /></label>
        <div className="form-actions full">
          <button className="primary-button" type="submit" disabled={!canWrite || !db.medicines.length || !db.suppliers.length}>
            <PackagePlus size={17} />
            Post stock-in
          </button>
        </div>
      </form>
    </section>
  )
}

function IssueStock({
  db,
  stockRows,
  canWrite,
  executeAction,
  flash,
}: {
  db: Database
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
  const selectedMedicineId = form.medicineId || db.medicines[0]?.id || ''

  const availableBatches = stockRows
    .filter((row) => row.medicine.id === selectedMedicineId && row.quantity > 0 && row.daysToExpiry >= 0)
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
            <p>Expired batches are excluded; allocation is suggested by first-expire-first-out.</p>
          </div>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label className="scan-field full">Scan barcode or SKU<div><Barcode size={17} /><input value={scan} onChange={(event) => setScan(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyScan() } }} placeholder="Scan, then press Enter" disabled={!canWrite || !db.medicines.length} /><button className="ghost-button" type="button" onClick={applyScan} disabled={!canWrite || !db.medicines.length}><Search size={16} />Lookup</button></div></label>
          <label className="full">Medicine<select required value={selectedMedicineId} onChange={(event) => setForm({ ...form, medicineId: event.target.value })} disabled={!canWrite || !db.medicines.length}><option value="">Select medicine</option>{db.medicines.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.brandName} / {medicine.genericName}</option>)}</select></label>
          <label>Quantity<input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })} disabled={!canWrite} /></label>
          <label>Reason<select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} disabled={!canWrite}><option>Dispense</option><option>Internal use</option><option>Donation</option><option>Damage</option><option>Other</option></select></label>
          <label className="full">Reference note<input value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Receipt, request, or memo reference" disabled={!canWrite} /></label>
          <div className="availability full">
            <strong>{number.format(totalAvailable)}</strong>
            <span>available from non-expired batches</span>
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

function Adjustments({ stockRows, canAdjust, executeAction, flash }: { stockRows: StockRow[]; canAdjust: boolean; executeAction: ExecuteAction; flash: (message: string) => void }) {
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
          <p>All corrections require a reason and are posted as immutable ledger entries.</p>
        </div>
      </div>
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
  function updateUser(userId: string, updates: Partial<Pick<User, 'role' | 'status'>>) {
    const target = db.users.find((user) => user.id === userId)
    if (!target) return
    if (target.id === currentUser.id && updates.status && updates.status !== 'active') {
      flash('You cannot suspend your own active admin account')
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
              <th>Status</th>
              <th>Requested</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {db.users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.name}</strong><span>{user.email}</span></td>
                <td>{user.phone || '-'}</td>
                <td>
                  <select value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value as Role })} disabled={user.id === currentUser.id}>
                    {Object.entries(roleLabels).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
                  </select>
                </td>
                <td><span className={`pill ${user.status}`}>{statusLabels[user.status]}</span></td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="button-row">
                    <button className="ghost-button" type="button" onClick={() => updateUser(user.id, { status: 'active' })} disabled={user.status === 'active'}>
                      <UserCheck size={16} />
                      Activate
                    </button>
                    <button className="ghost-button" type="button" onClick={() => updateUser(user.id, { status: 'suspended' })} disabled={user.id === currentUser.id || user.status === 'suspended'}>
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
          <h2>Inventory Settings</h2>
          <p>Single-branch now, with thresholds ready for expansion.</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={submit}>
        <label>Pharmacy name<input value={form.pharmacyName} onChange={(event) => setForm({ ...form, pharmacyName: event.target.value })} disabled={!canAdmin} /></label>
        <label>Branch name<input value={form.branchName} onChange={(event) => setForm({ ...form, branchName: event.target.value })} disabled={!canAdmin} /></label>
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
                <td>{row.batch.location}</td>
                {!compact && <td><span className={`pill ${row.status}`}>{row.status.replace('-', ' ')}</span></td>}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={compact ? 5 : 6}>No stock rows yet.</td>
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
