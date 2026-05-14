import { addAudit, addSecurityEvent, deleteOtherSessions, fail, getCompanySlugFromRequest, getRequestIp, getRequestUserAgent, hashPassword, hashToken, loadTenantDatabase, nowIso, requireMethod, saveTenantDatabase, sendSecurityEmail } from '../_shared.js'
import type { HandlerRequest, HandlerResponse } from '../_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as Partial<{ email: string; code: string; password: string }>
    const email = body.email?.trim().toLowerCase() ?? ''
    const code = body.code?.trim() ?? ''
    if (!email || !code || !body.password) {
      fail(res, 400, 'Email, code, and new password are required')
      return
    }
    if (body.password.length < 8) {
      fail(res, 400, 'Password must be at least 8 characters')
      return
    }

    const companySlug = getCompanySlugFromRequest(req)
    if (!companySlug) {
      fail(res, 400, 'Choose a company portal before resetting password')
      return
    }
    const db = await loadTenantDatabase(companySlug)
    if (!db) {
      fail(res, 404, 'Company portal not found')
      return
    }
    const user = db.users.find((item) => item.email === email)
    if (!user) {
      fail(res, 400, 'Invalid or expired password reset code')
      return
    }
    const request = db.passwordResetRequests.find((item) => item.userId === user.id && item.status === 'pending')
    if (!request || !request.codeHash || request.expiresAt < nowIso() || request.codeHash !== hashToken(code)) {
      if (request && request.expiresAt < nowIso()) request.status = 'expired'
      await saveTenantDatabase(companySlug, db)
      fail(res, 400, 'Invalid or expired password reset code')
      return
    }

    const { salt, hash } = hashPassword(body.password)
    user.passwordHash = hash
    user.passwordSalt = salt
    request.status = 'completed'
    request.resolvedAt = nowIso()
    delete request.codeHash
    addSecurityEvent(db, {
      userId: user.id,
      email,
      type: 'password-reset-completed',
      severity: 'warning',
      detail: 'The account password was changed using email verification.',
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
      metadata: { requestId: request.id },
    })
    addAudit(db, user.id, 'Completed password reset', 'user', user.id, undefined, { requestId: request.id })
    await saveTenantDatabase(companySlug, db)
    await deleteOtherSessions(user.id)
    try {
      await sendSecurityEmail(email, 'Your RxLedger password was changed', 'Your RxLedger account password was changed using a verification code. If this was not you, contact your account admin immediately.')
    } catch {
      // The security event has already been stored; email sending will activate once configured.
    }
    res.status(200).json({ ok: true })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to complete password reset')
  }
}
