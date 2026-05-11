import { addAudit, fail, hashPassword, id, loadDatabase, nowIso, requireMethod, saveDatabase } from '../_shared.js'
import type { HandlerRequest, HandlerResponse, User } from '../_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as Partial<{ name: string; email: string; phone: string; password: string }>
    const db = await loadDatabase()
    if (!body.name || !body.email || !body.phone || !body.password) {
      fail(res, 400, 'All registration fields are required')
      return
    }
    if (body.password.length < 8) {
      fail(res, 400, 'Password must be at least 8 characters')
      return
    }
    const email = body.email.trim().toLowerCase()
    if (db.users.some((user) => user.email === email)) {
      fail(res, 409, 'An account already exists for this email address')
      return
    }
    const { salt, hash } = hashPassword(body.password)
    const user: User = {
      id: id('usr'),
      name: body.name.trim(),
      email,
      phone: body.phone.trim(),
      role: 'viewer',
      status: 'pending',
      branchIds: [],
      managedBranchIds: [],
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: nowIso(),
    }
    db.users.push(user)
    addAudit(db, user.id, 'Submitted staff access request', 'user', user.id, undefined, {
      name: user.name,
      email: user.email,
      status: user.status,
    })
    await saveDatabase(db)
    res.status(200).json({ ok: true })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to register user')
  }
}
