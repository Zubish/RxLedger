import {
  fail,
  getDefaultTenantSlug,
  getCompanySlugFromRequest,
  loadTenantBootstrap,
  requireMethod,
} from "../server/_shared.js";
import type { HandlerRequest, HandlerResponse } from "../server/_shared.js";

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
        ? {softwareName:tenant.settings.softwareName,accountName:tenant.settings.accountName,pharmacyName:tenant.settings.pharmacyName,branchName:tenant.settings.branchName,companySlug:tenant.settings.companySlug,companyCode:tenant.settings.companyCode,businessLicense:tenant.settings.businessLicense,mainBranchAddress:tenant.settings.mainBranchAddress,logoDataUrl:tenant.settings.logoDataUrl}
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
