import { fail, getCompanySlugFromRequest, loadRootState, loadTenantDatabase, requireMethod, sanitizeDatabase, saveRootState } from './_shared.js'
import type { HandlerRequest, HandlerResponse } from './_shared.js'

export default async function handler(req: HandlerRequest, res: HandlerResponse) {
  if (!requireMethod(req, res, ['GET'])) return
  try {
    const root = await loadRootState()
    await saveRootState(root)
    const requestedSlug = getCompanySlugFromRequest(req)
    const tenant = requestedSlug ? root.tenants.find((item) => item.slug === requestedSlug) : root.tenants.find((item) => item.slug === root.defaultSlug) || root.tenants[0]
    const db = tenant ? await loadTenantDatabase(tenant.slug) : null
    res.status(200).json({
      hasUsers: Boolean(db && db.users.length > 0),
      tenantExists: Boolean(tenant),
      requestedSlug,
      settings: db ? sanitizeDatabase(db).settings : {
        softwareName: 'RxLedger',
        accountName: 'Pharmacy Account',
        pharmacyName: 'RxLedger',
        branchName: 'Main Branch',
        companySlug: requestedSlug,
        companyCode: '',
        businessLicense: '',
        mainBranchAddress: '',
        logoDataUrl: '',
        nearExpiryDays: 90,
        approvalThreshold: 25000,
      },
    })
  } catch (error) {
    fail(res, 500, error instanceof Error ? error.message : 'Unable to load application bootstrap')
  }
}
