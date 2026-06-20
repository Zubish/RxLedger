import {
  fail,
  getDefaultTenantSlug,
  getCompanySlugFromRequest,
  loadTenantBootstrap,
  requireMethod,
} from "./_shared.js";
import type { HandlerRequest, HandlerResponse } from "./_shared.js";

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["GET"])) return;
  try {
    const requestedSlug = getCompanySlugFromRequest(req);
    const tenantSlug = requestedSlug || (await getDefaultTenantSlug());
    const tenant = tenantSlug ? await loadTenantBootstrap(tenantSlug) : null;
    res.status(200).json({
      hasUsers: Boolean(tenant?.hasUsers),
      tenantExists: Boolean(tenant),
      requestedSlug,
      settings: tenant
        ? tenant.settings
        : {
            softwareName: "RxLedger",
            accountName: "Pharmacy Account",
            pharmacyName: "RxLedger",
            branchName: "Main Branch",
            companySlug: requestedSlug,
            companyCode: "",
            businessLicense: "",
            mainBranchAddress: "",
            logoDataUrl: "",
            nearExpiryDays: 90,
            approvalThreshold: 25000,
          },
    });
  } catch (error) {
    fail(
      res,
      500,
      error instanceof Error
        ? error.message
        : "Unable to load application bootstrap",
    );
  }
}
