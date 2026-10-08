import {
  fail,
  loadTenantBootstrap,
  normalizeCompanySlug,
  requireMethod,
} from "../../server/_shared.js";
import type { HandlerRequest, HandlerResponse } from "../../server/_shared.js";

export default async function handler(
  req: HandlerRequest & {
    query?: Record<string, string | string[] | undefined>;
  },
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["GET"])) return;
  try {
    const raw = req.query?.slug;
    const slug = normalizeCompanySlug(
      Array.isArray(raw) ? raw[0] || "" : raw || "",
    );
    const owner = await loadTenantBootstrap(slug);
    res.status(200).json({
      slug,
      available: Boolean(slug) && !owner,
      claimedBy: owner ? owner.settings.accountName : "",
    });
  } catch (error) {
    fail(
      res,
      500,
      error instanceof Error ? error.message : "Unable to check workspace name",
    );
  }
}
