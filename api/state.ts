import { fail, getAuthenticatedUser, loadDatabase, requireMethod, sanitizeDatabase } from './_shared'
import type { HandlerRequest, HandlerResponse } from './_shared'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['GET'])) return
  try {
    const db = await loadDatabase()
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      fail(res, 401, 'Authentication required')
      return
    }
    const clean = sanitizeDatabase(db)
    res.status(200).json({ db: clean, currentUser: clean.users.find((item) => item.id === user.id) })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to load state')
  }
}
