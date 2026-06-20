import {
  canAdmin,
  fail,
  getAuthenticatedUser,
  getCompanySlugFromRequest,
  jsonByteLength,
  loadTenantDatabase,
  logApiPerformance,
  requireMethod,
  sanitizeDatabase,
  setServerTiming,
} from "./_shared.js";
import type { HandlerRequest, HandlerResponse } from "./_shared.js";

export default async function handler(
  req: HandlerRequest & {
    query?: Record<string, string | string[] | undefined>;
  },
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["GET"])) return;
  const startedAt = Date.now();
  let loadMs = 0;
  let authMs = 0;
  try {
    const companySlug = getCompanySlugFromRequest(req);
    if (!companySlug) {
      fail(res, 400, "Choose a company portal before loading state");
      return;
    }
    const loadStartedAt = Date.now();
    const db = await loadTenantDatabase(companySlug);
    loadMs = Date.now() - loadStartedAt;
    if (!db) {
      fail(res, 404, "Company portal not found");
      return;
    }
    const authStartedAt = Date.now();
    const user = await getAuthenticatedUser(req, db);
    authMs = Date.now() - authStartedAt;
    if (!user) {
      fail(res, 401, "Authentication required");
      return;
    }
    const rawScope = req.query?.scope;
    const scope = String(Array.isArray(rawScope) ? rawScope[0] || "" : rawScope || "");
    if (scope === "audit") {
      if (!canAdmin(user, db.settings.primaryAdminId)) {
        fail(res, 403, "Only the global admin can view the audit trail");
        return;
      }
      const response = { auditLogs: db.auditLogs };
      const totalMs = Date.now() - startedAt;
      const responseBytes = jsonByteLength(response);
      setServerTiming(res, { load: loadMs, auth: authMs, total: totalMs });
      logApiPerformance(req, "/api/state", {
        ok: true,
        scope,
        loadMs,
        authMs,
        totalMs,
        responseBytes,
      });
      res.status(200).json(response);
      return;
    }
    const clean = sanitizeDatabase(db);
    clean.auditLogs = [];
    const response = {
      db: clean,
      currentUser: clean.users.find((item) => item.id === user.id),
    };
    const totalMs = Date.now() - startedAt;
    const responseBytes = jsonByteLength(response);
    setServerTiming(res, { load: loadMs, auth: authMs, total: totalMs });
    logApiPerformance(req, "/api/state", {
      ok: true,
      scope: "workspace",
      loadMs,
      authMs,
      totalMs,
      responseBytes,
    });
    res.status(200).json(response);
  } catch (error) {
    logApiPerformance(req, "/api/state", {
      ok: false,
      scope: "workspace",
      loadMs,
      authMs,
      totalMs: Date.now() - startedAt,
    });
    fail(
      res,
      500,
      error instanceof Error ? error.message : "Unable to load state",
    );
  }
}
