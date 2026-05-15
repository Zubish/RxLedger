import { fail, loadRootState, normalizeCompanySlug, requireMethod } from '../_shared.js'
import type { HandlerRequest, HandlerResponse } from '../_shared.js'

export default async function handler(req: HandlerRequest & { query?: Record<string, string | string[] | undefined> }, res: HandlerResponse) {
  if (!requireMethod(req, res, ['GET'])) return
  try {
    const raw = req.query?.slug
    const slug = normalizeCompanySlug(Array.isArray(raw) ? raw[0] || '' : raw || '')
    const root = await loadRootState()
    const owner = root.tenants.find((tenant) => tenant.slug === slug)
    res.status(200).json({
      slug,
      available: Boolean(slug) && !owner,
      claimedBy: owner ? owner.name : '',
    })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to check workspace name')
  }
}
