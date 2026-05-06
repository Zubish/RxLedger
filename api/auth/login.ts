import { createSession, fail, loadDatabase, requireMethod, sanitizeDatabase, verifyPassword } from '../_shared'
import type { HandlerRequest, HandlerResponse } from '../_shared'

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
    const session = await createSession(user.id)
    const clean = sanitizeDatabase(db)
    res.status(200).json({ ...session, db: clean, currentUser: clean.users.find((item) => item.id === user.id) })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to log in')
  }
}
