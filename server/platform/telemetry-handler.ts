import {
  getSql,
  getCompanySlugFromRequest,
  loadTenantAuthDatabase,
  getAuthenticatedUser,
} from "../_shared.js";
import type { HandlerRequest, HandlerResponse } from "../_shared.js";
import { trustedMutation } from "./auth.js";
import { validateBrowserEvent } from "./event-validation.js";
export default async function handler(
  req: HandlerRequest,
  res: HandlerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST" || !trustedMutation(req)) {
    res.status(403).json({ error: "Invalid request" });
    return;
  }
  const event = validateBrowserEvent(req.body);
  if (!event) {
    res.status(400).json({ error: "Invalid event" });
    return;
  }
  try {
    const slug = getCompanySlugFromRequest(req);
    const db = await loadTenantAuthDatabase(slug);
    if (!db || !(await getAuthenticatedUser(req, db))) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    await getSql().query(
      "INSERT INTO platform_events(id,workspace,kind,event,page,device,release,vital,value,error_group) SELECT $1,t.slug,coalesce(m.kind,'pharmacy'),$3,$4,$5,$6,$7,$8,$9 FROM tenant_state t LEFT JOIN platform_workspace_meta m ON m.slug=t.slug WHERE t.slug=$2 AND (SELECT count(*) FROM platform_events WHERE workspace=$2 AND at>now()-interval '1 minute' AND event IN ('page_visit','web_vital','browser_error'))<120 ON CONFLICT(id) DO UPDATE SET value=excluded.value WHERE platform_events.event='web_vital' AND excluded.event='web_vital' AND platform_events.workspace=excluded.workspace",
      [
        event.id,
        slug,
        event.event,
        event.page,
        event.device,
        process.env.VERCEL_GIT_COMMIT_SHA || "local",
        event.vital || null,
        event.value ?? null,
        event.group || null,
      ],
    );
    if (event.event === "page_visit")
      await getSql().query(
        "INSERT INTO platform_workspace_meta(slug,kind,last_activity) SELECT slug,'pharmacy',now() FROM tenant_state WHERE slug=$1 ON CONFLICT(slug) DO UPDATE SET last_activity=excluded.last_activity",
        [slug],
      );
    res.status(200).json({ ok: true });
  } catch {
    res.status(503).json({ error: "Collection unavailable" });
  }
}
