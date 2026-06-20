import {
  canAdmin,
  fail,
  getAuthenticatedUser,
  getCompanySlugFromRequest,
  jsonByteLength,
  loadTenantDatabase,
  logApiPerformance,
  requireMethod,
  setServerTiming,
} from "./_shared.js";
import type { HandlerRequest, HandlerResponse } from "./_shared.js";

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["GET"])) return;
  const startedAt = Date.now();
  try {
    const companySlug = getCompanySlugFromRequest(req);
    if (!companySlug) {
      fail(res, 400, "Choose a company portal before loading audit history");
      return;
    }
    const db = await loadTenantDatabase(companySlug);
    if (!db) {
      fail(res, 404, "Company portal not found");
      return;
    }
    const user = await getAuthenticatedUser(req, db);
    if (!user) {
      fail(res, 401, "Authentication required");
      return;
    }
    if (!canAdmin(user, db.settings.primaryAdminId)) {
      fail(res, 403, "Only the global admin can view the audit trail");
      return;
    }

    const response = { auditLogs: db.auditLogs };
    const totalMs = Date.now() - startedAt;
    setServerTiming(res, { total: totalMs });
    logApiPerformance(req, "/api/audit-history", {
      ok: true,
      totalMs,
      responseBytes: jsonByteLength(response),
    });
    res.status(200).json(response);
  } catch {
    logApiPerformance(req, "/api/audit-history", {
      ok: false,
      totalMs: Date.now() - startedAt,
    });
    fail(
      res,
      500,
      "Unable to load audit history",
    );
  }
}
