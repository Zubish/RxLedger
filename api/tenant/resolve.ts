import { fail, loadRootState, normalizeCompanySlug, requireMethod } from '../_shared.js'
import type { HandlerRequest, HandlerResponse } from '../_shared.js'

export default async function handler(req: HandlerRequest & { query?: Record<string, string | string[] | undefined> }, res: HandlerResponse) {
  if (!requireMethod(req, res, ['GET'])) return
  try {
    const raw = req.query?.q
    const value = String(Array.isArray(raw) ? raw[0] || '' : raw || '').trim()
    const normalized = value.toLowerCase()
    const slug = normalizeCompanySlug(value)
    const root = await loadRootState()
    const tenant = root.tenants.find((item) => item.code.toLowerCase() === normalized || item.name.toLowerCase() === normalized || item.slug === slug)
    if (!tenant) {
      res.status(404).json({ error: 'Company not found' })
      return
    }
    res.status(200).json({ slug: tenant.slug })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to find company')
  }
}
