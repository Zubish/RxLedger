import { accessibleBranchIds, primaryAdminIdForDatabase, scopeDatabaseForUser } from "../server/branch-scope.js";
import {
  canAdmin,
  fail,
  getAuthenticatedUser,
  getCompanySlugFromRequest,
  jsonByteLength,
  loadTenantAuthDatabase,
  loadTenantDatabase,
  loadTenantLedgerPage,
  loadTenantSalesPage,
  logApiPerformance,
  trackApi,
  requireMethod,
  sanitizeDatabase,
  setServerTiming,
} from "../server/_shared.js";
import type { HandlerRequest, HandlerResponse } from "../server/_shared.js";

export default async function handler(
  req: HandlerRequest & {
    query?: Record<string, string | string[] | undefined>;
  },
  res: HandlerResponse,
) {
  trackApi(req, res, "/api/state");
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
    const rawScope = req.query?.scope;
    const scope = String(Array.isArray(rawScope) ? rawScope[0] || "" : rawScope || "");
    if (scope === "sales") {
      const authLoadStartedAt = Date.now();
      const authDb = await loadTenantAuthDatabase(companySlug);
      loadMs = Date.now() - authLoadStartedAt;
      if (!authDb) {
        fail(res, 404, "Company portal not found");
        return;
      }
      const authStartedAt = Date.now();
      const user = await getAuthenticatedUser(req, authDb);
      authMs = Date.now() - authStartedAt;
      if (!user) {
        fail(res, 401, "Authentication required");
        return;
      }
      const rawLimit = req.query?.limit;
      const rawCursor = req.query?.cursor;
      const limit = Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit);
      const cursor = String(
        Array.isArray(rawCursor) ? rawCursor[0] || "" : rawCursor || "",
      );
      const salesLoadStartedAt = Date.now();
      const page = await loadTenantSalesPage(companySlug, { cursor, limit, branchIds: accessibleBranchIds(user, primaryAdminIdForDatabase(authDb)) });
      loadMs += Date.now() - salesLoadStartedAt;
      if (!page) {
        fail(res, 404, "Company portal not found");
        return;
      }
      const totalMs = Date.now() - startedAt;
      const responseBytes = jsonByteLength(page);
      setServerTiming(res, { load: loadMs, auth: authMs, total: totalMs });
      logApiPerformance(req, "/api/state", {
        ok: true,
        scope,
        loadMs,
        authMs,
        totalMs,
        responseBytes,
      });
      res.status(200).json(page);
      return;
    }
    if (scope === "ledger") {
      const authLoadStartedAt = Date.now();
      const authDb = await loadTenantAuthDatabase(companySlug);
      loadMs = Date.now() - authLoadStartedAt;
      if (!authDb) {
        fail(res, 404, "Company portal not found");
        return;
      }
      const authStartedAt = Date.now();
      const user = await getAuthenticatedUser(req, authDb);
      authMs = Date.now() - authStartedAt;
      if (!user) {
        fail(res, 401, "Authentication required");
        return;
      }
      const rawLimit = req.query?.limit;
      const rawCursor = req.query?.cursor;
      const limit = Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit);
      const cursor = String(
        Array.isArray(rawCursor) ? rawCursor[0] || "" : rawCursor || "",
      );
      const ledgerLoadStartedAt = Date.now();
      const page = await loadTenantLedgerPage(companySlug, { cursor, limit, branchIds: accessibleBranchIds(user, primaryAdminIdForDatabase(authDb)) });
      loadMs += Date.now() - ledgerLoadStartedAt;
      if (!page) {
        fail(res, 404, "Company portal not found");
        return;
      }
      const totalMs = Date.now() - startedAt;
      const responseBytes = jsonByteLength(page);
      setServerTiming(res, { load: loadMs, auth: authMs, total: totalMs });
      logApiPerformance(req, "/api/state", {
        ok: true,
        scope,
        loadMs,
        authMs,
        totalMs,
        responseBytes,
      });
      res.status(200).json(page);
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
    if (scope === "audit") {
      if (!canAdmin(user, primaryAdminIdForDatabase(db))) {
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
    const clean = scopeDatabaseForUser(sanitizeDatabase(db), user);
    clean.auditLogs = [];
    clean.sales = [];
    clean.ledger = [];
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
