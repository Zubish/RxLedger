import { addAudit, createSession, createTenantRecord, fail, generateCompanyCode, hashPassword, id, loadRootState, nowIso, normalizeCompanySlug, requireMethod, sanitizeDatabase, saveRootState } from './_shared.js'
import type { Database, HandlerRequest, HandlerResponse, User } from './_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as Partial<{
      pharmacyName: string
      companySlug: string
      businessLicense: string
      mainBranchAddress: string
      branchName: string
      name: string
      email: string
      phone: string
      password: string
    }>
    const root = await loadRootState()
    const companySlug = normalizeCompanySlug(body.companySlug || body.pharmacyName || '')
    if (!body.pharmacyName || !companySlug || !body.businessLicense || !body.mainBranchAddress || !body.branchName || !body.name || !body.email || !body.phone || !body.password) {
      fail(res, 400, 'All setup fields are required')
      return
    }
    if (root.tenants.some((tenant) => tenant.slug === companySlug)) {
      fail(res, 409, `The company URL "${companySlug}" has already been claimed`)
      return
    }
    if (body.password.length < 8) {
      fail(res, 400, 'Password must be at least 8 characters')
      return
    }
    const { salt, hash } = hashPassword(body.password)
    const adminId = id('usr')
    const createdAt = nowIso()
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const companyCode = generateCompanyCode(body.pharmacyName)
    const admin: User = {
      id: adminId,
      name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      role: 'admin',
      status: 'active',
      branchIds: [],
      managedBranchIds: [],
      passwordHash: hash,
      passwordSalt: salt,
      createdAt,
      approvedAt: createdAt,
      approvedBy: adminId,
    }
    const db: Database = {
      users: [admin],
      medicines: [],
      products: [],
      suppliers: [],
      branches: [],
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
        accountName: body.pharmacyName.trim(),
        pharmacyName: body.pharmacyName.trim(),
        branchName: body.branchName.trim(),
        companySlug,
        companyCode,
        businessLicense: body.businessLicense.trim(),
        mainBranchAddress: body.mainBranchAddress.trim(),
        logoDataUrl: '',
        primaryAdminId: adminId,
        nearExpiryDays: 90,
        approvalThreshold: 25000,
        subscriptionPlanId: 'smart-pharmacy',
        trialStartedAt: createdAt,
        trialEndsAt,
      },
    }
    db.branches = [{
      id: 'main',
      name: body.branchName.trim(),
      code: body.branchName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'MAIN',
      address: body.mainBranchAddress.trim(),
      managerName: '',
      managerUserId: '',
      phone: body.phone.trim(),
      active: true,
      createdAt,
    }]
    addAudit(db, adminId, 'Completed first-run RxLedger account setup', 'system', 'setup')
    const tenant = createTenantRecord(db, companySlug)
    tenant.code = companyCode
    tenant.businessLicense = body.businessLicense.trim()
    tenant.mainBranchAddress = body.mainBranchAddress.trim()
    tenant.superAdminName = admin.name
    tenant.superAdminEmail = admin.email
    tenant.superAdminPhone = admin.phone
    root.tenants.unshift(tenant)
    root.defaultSlug = tenant.slug
    await saveRootState(root)
    const session = await createSession(adminId)
    res.status(200).json({ ...session, db: sanitizeDatabase(db), currentUser: sanitizeDatabase(db).users[0] })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to set up workspace')
  }
}
