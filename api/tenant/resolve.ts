import {
  fail,
  normalizeCompanySlug,
  requireMethod,
  resolveTenantSlug,
} from "../../server/_shared.js";
import type { HandlerRequest, HandlerResponse } from "../../server/_shared.js";

function extractWorkspaceLookup(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (url.pathname && url.pathname !== "/") {
      return url.pathname.split("/").filter(Boolean)[0] || trimmed;
    }
    return url.hostname === trimmed ? trimmed : url.hostname;
  } catch {
    return trimmed.replace(/^\/+/, "").split("/").filter(Boolean)[0] || trimmed;
  }
}

export default async function handler(
  req: HandlerRequest & {
    query?: Record<string, string | string[] | undefined>;
  },
  res: HandlerResponse,
) {
  if (!requireMethod(req, res, ["GET"])) return;
  try {
    const raw = req.query?.q;
    const value = String(Array.isArray(raw) ? raw[0] || "" : raw || "").trim();
    const lookupValue = extractWorkspaceLookup(value);
    const normalized = value.toLowerCase();
    const normalizedLookup = lookupValue.toLowerCase();
    const slug = normalizeCompanySlug(lookupValue);
    const tenant =
      (await resolveTenantSlug(normalized)) ||
      (await resolveTenantSlug(normalizedLookup)) ||
      (await resolveTenantSlug(slug));
    if (!tenant) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    res.status(200).json({ slug: tenant });
  } catch (error) {
    fail(
      res,
      500,
      error instanceof Error ? error.message : "Unable to find company",
    );
  }
}
