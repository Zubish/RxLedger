import { addAudit, addSecurityEvent, fail, getRequestIp, getRequestUserAgent, hashToken, id, isEmailConfigured, loadDatabase, nowIso, requireMethod, saveDatabase, sendSecurityEmail } from '../_shared.js'
import type { HandlerRequest, HandlerResponse, PasswordResetRequest } from '../_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as Partial<{ email: string; phone: string }>
    const db = await loadDatabase()
    const email = body.email?.trim().toLowerCase() ?? ''
    const phone = body.phone?.trim() ?? ''
    if (!email || !phone) {
      fail(res, 400, 'Email and phone are required')
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
      if (new Date(existing.expiresAt).getTime() <= Date.now()) {
        existing.status = 'expired'
        existing.resolvedAt = nowIso()
      } else {
        fail(res, 409, 'A password reset code is already active. Check your email or wait for it to expire.')
        return
      }
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString()
    let emailSent = false
    const request: PasswordResetRequest = {
      id: id('pwd'),
      userId: user.id,
      email,
      status: 'pending',
      requestedAt: nowIso(),
      expiresAt,
      codeHash: hashToken(code),
      emailSent: false,
    }
    try {
      const sent = await sendSecurityEmail(email, 'Your RxLedger password reset code', `Use this RxLedger password reset code within 15 minutes:\n\n${code}\n\nIf you did not request this, secure your account or contact your account admin.`)
      emailSent = sent.sent
      request.emailSent = emailSent
    } catch (error) {
      addSecurityEvent(db, {
        userId: user.id,
        email,
        type: 'security-email-failed',
        severity: 'warning',
        detail: error instanceof Error ? error.message : 'Unable to send password reset email.',
        ipAddress: getRequestIp(req),
        userAgent: getRequestUserAgent(req),
      })
    }
    db.passwordResetRequests.unshift(request)
    addSecurityEvent(db, {
      userId: user.id,
      email,
      type: 'password-reset-requested',
      severity: 'warning',
      detail: emailSent ? 'A password reset code was sent to the user email.' : 'A password reset was requested, but email is not configured yet.',
      ipAddress: getRequestIp(req),
      userAgent: getRequestUserAgent(req),
      metadata: { requestId: request.id, emailConfigured: isEmailConfigured() },
    })
    addAudit(db, user.id, 'Requested password reset code', 'user', user.id, undefined, {
      requestId: request.id,
      email,
    })
    await saveDatabase(db)
    res.status(200).json({ ok: true, emailConfigured: isEmailConfigured() })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to request password reset')
  }
}
