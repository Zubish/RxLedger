import { fail, loadDatabase, requireMethod, sanitizeDatabase } from './_shared'
import type { HandlerRequest, HandlerResponse } from './_shared'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['GET'])) return
  try {
    const db = await loadDatabase()
    res.status(200).json({
      hasUsers: db.users.length > 0,
      settings: sanitizeDatabase(db).settings,
    })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to load application bootstrap')
  }
}
