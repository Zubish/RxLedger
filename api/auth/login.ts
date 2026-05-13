import { addSecurityEvent, createSession, fail, getDeviceId, getRequestIp, getRequestUserAgent, loadDatabase, nowIso, requireMethod, sanitizeDatabase, saveDatabase, sendSecurityEmail, verifyPassword } from '../_shared.js'
import type { HandlerRequest, HandlerResponse } from '../_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const body = req.body as Partial<{ email: string; password: string }>
    const db = await loadDatabase()
    const user = db.users.find((item) => item.email === body.email?.trim().toLowerCase())
    if (!user || !body.password || !verifyPassword(body.password, user)) {
      fail(res, 401, 'Invalid email or password')
      return
    }
    if (user.status === 'pending') {
      fail(res, 403, 'Your account is waiting for admin approval')
      return
    }
    if (user.status === 'suspended') {
      fail(res, 403, 'Your account is suspended')
      return
    }
    const deviceId = getDeviceId(req)
    const userAgent = getRequestUserAgent(req)
    const ipAddress = getRequestIp(req)
    const knownDevice = user.knownDevices?.find((device) => device.id === deviceId)
    if (knownDevice) {
      knownDevice.lastSeenAt = nowIso()
    } else {
      user.knownDevices = [...(user.knownDevices ?? []), {
        id: deviceId,
        label: userAgent || 'Unknown device',
        firstSeenAt: nowIso(),
        lastSeenAt: nowIso(),
      }]
      addSecurityEvent(db, {
        userId: user.id,
        email: user.email,
        type: 'new-device-login',
        severity: 'warning',
        detail: 'A sign-in was detected from a new device or browser.',
        ipAddress,
        userAgent,
        metadata: { deviceId },
      })
      try {
        await sendSecurityEmail(user.email, 'New RxLedger sign-in detected', `A new sign-in to your RxLedger account was detected.\n\nDevice: ${userAgent || 'Unknown'}\nIP: ${ipAddress || 'Unknown'}\n\nIf this was not you, sign in and use Secure my account.`)
      } catch (error) {
        addSecurityEvent(db, {
          userId: user.id,
          email: user.email,
          type: 'security-email-failed',
          severity: 'warning',
          detail: error instanceof Error ? error.message : 'Unable to send new-device email alert.',
          ipAddress,
          userAgent,
        })
      }
    }
    await saveDatabase(db)
    const session = await createSession(user.id)
    const clean = sanitizeDatabase(db)
    res.status(200).json({ ...session, db: clean, currentUser: clean.users.find((item) => item.id === user.id) })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to log in')
  }
}
