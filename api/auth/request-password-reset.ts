import { addAudit, fail, hashPassword, id, loadDatabase, nowIso, requireMethod, saveDatabase } from '../_shared.js'
import type { HandlerRequest, HandlerResponse, PasswordResetRequest } from '../_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as Partial<{ email: string; phone: string; password: string }>
    const db = await loadDatabase()
    const email = body.email?.trim().toLowerCase() ?? ''
    const phone = body.phone?.trim() ?? ''
    if (!email || !phone || !body.password) {
      fail(res, 400, 'Email, phone, and new password are required')
      return
    }
    if (body.password.length < 8) {
      fail(res, 400, 'Password must be at least 8 characters')
      return
    }

    const user = db.users.find((item) => item.email === email)
    if (!user || user.phone.trim() !== phone) {
      res.status(200).json({ ok: true })
      return
    }
    if (user.status === 'pending') {
      fail(res, 403, 'This account is still waiting for admin activation')
      return
    }

    const existing = db.passwordResetRequests.find((request) => request.userId === user.id && request.status === 'pending')
    if (existing) {
      fail(res, 409, 'A password reset request is already waiting for admin approval')
      return
    }

    const { salt, hash } = hashPassword(body.password)
    const request: PasswordResetRequest = {
      id: id('pwd'),
      userId: user.id,
      email,
      status: 'pending',
      requestedAt: nowIso(),
      pendingPasswordHash: hash,
      pendingPasswordSalt: salt,
    }
    db.passwordResetRequests.unshift(request)
    addAudit(db, user.id, 'Requested password reset approval', 'user', user.id, undefined, {
      requestId: request.id,
      email,
    })
    await saveDatabase(db)
    res.status(200).json({ ok: true })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to request password reset')
  }
}
