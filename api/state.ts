import {
  fail,
  getAuthenticatedUser,
  getCompanySlugFromRequest,
  loadTenantDatabase,
  requireMethod,
  sanitizeDatabase,
} from "./_shared.js";
import type { HandlerRequest, HandlerResponse } from "./_shared.js";

export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["GET"])) return;
  try {
    const companySlug = getCompanySlugFromRequest(req);
    if (!companySlug) {
      fail(res, 400, "Choose a company portal before loading state");
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
    const clean = sanitizeDatabase(db);
    res.status(200).json({
      db: clean,
      currentUser: clean.users.find((item) => item.id === user.id),
    });
  } catch (error) {
    fail(
      res,
      500,
      error instanceof Error ? error.message : "Unable to load state",
    );
  }
}
