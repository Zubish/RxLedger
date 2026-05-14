import { addAudit, createSession, fail, hashPassword, id, loadDatabase, nowIso, requireMethod, sanitizeDatabase, saveDatabase } from './_shared.js'
import type { HandlerRequest, HandlerResponse, User } from './_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as Partial<{
      pharmacyName: string
      branchName: string
      name: string
      email: string
      phone: string
      password: string
    }>
    const db = await loadDatabase()
    if (db.users.length > 0) {
      fail(res, 409, 'Workspace has already been set up')
      return
    }
    if (!body.pharmacyName || !body.branchName || !body.name || !body.email || !body.phone || !body.password) {
      fail(res, 400, 'All setup fields are required')
      return
    }
    if (body.password.length < 8) {
      fail(res, 400, 'Password must be at least 8 characters')
      return
    }
    const { salt, hash } = hashPassword(body.password)
    const adminId = id('usr')
    const createdAt = nowIso()
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
    db.users = [admin]
    db.branches = [{
      id: 'main',
      name: body.branchName.trim(),
      code: body.branchName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 12) || 'MAIN',
      address: '',
      managerName: '',
      managerUserId: '',
      phone: body.phone.trim(),
      active: true,
      createdAt,
    }]
    db.settings.softwareName = 'RxLedger'
    db.settings.accountName = body.pharmacyName.trim()
    db.settings.pharmacyName = body.pharmacyName.trim()
    db.settings.branchName = body.branchName.trim()
    db.settings.primaryAdminId = adminId
    addAudit(db, adminId, 'Completed first-run RxLedger account setup', 'system', 'setup')
    await saveDatabase(db)
    const session = await createSession(adminId)
    res.status(200).json({ ...session, db: sanitizeDatabase(db), currentUser: sanitizeDatabase(db).users[0] })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to set up workspace')
  }
}
