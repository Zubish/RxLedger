import {maintainDuringActivity} from "./maintenance.js";
import { randomUUID } from "node:crypto";
import { getSql, getCompanySlugFromRequest } from "../_shared.js";
import type { HandlerRequest } from "../_shared.js";
import { actionNames, coreActions } from "../../src/platform/contracts.js";
export async function recordApi(
  req: HandlerRequest,
  route: string,
  metrics: Record<string, string | number | boolean>,
) {
  if (!["state", "action", "/api/state", "/api/action"].includes(route)) return;
  const workspace = getCompanySlugFromRequest(req);
  if (!workspace) return;
  const action = actionNames.find((a) => a === metrics.action) || "";
  await getSql().query(
    "INSERT INTO platform_events(id,workspace,kind,event,route,action,release,status,duration,bytes,load_ms,auth_ms,save_ms) SELECT $1,t.slug,coalesce(m.kind,'pharmacy'),'api',$3,$4,$5,$6,$7,$8,$9,$10,$11 FROM tenant_state t LEFT JOIN platform_workspace_meta m ON m.slug=t.slug WHERE t.slug=$2 ON CONFLICT DO NOTHING",
    [
      randomUUID(),
      workspace,
      route,
      action,
      process.env.VERCEL_GIT_COMMIT_SHA || "local",
      Number(metrics.status) || (metrics.ok === false ? 500 : 200),
      Number(metrics.totalMs) || 0,
      Number(metrics.responseBytes) || 0,
      Number(metrics.loadMs) || 0,
      Number(metrics.authMs) || 0,
      Number(metrics.saveMs) || 0,
    ],
  );
  if (
    route.includes("action") &&
    metrics.ok === true &&
    coreActions.includes(action as (typeof coreActions)[number]) &&
    metrics.operationId
  ) {
    await getSql().query(
      "INSERT INTO platform_events(id,workspace,kind,event,action,release) SELECT $1,t.slug,coalesce(m.kind,'pharmacy'),'operation',$3,$4 FROM tenant_state t LEFT JOIN platform_workspace_meta m ON m.slug=t.slug WHERE t.slug=$2 ON CONFLICT DO NOTHING",
      [
        "op:" + String(metrics.operationId),
        workspace,
        action,
        process.env.VERCEL_GIT_COMMIT_SHA || "local",
      ],
    );
    await getSql().query(
      "INSERT INTO platform_workspace_meta(slug,kind,activated_at,last_activity) SELECT slug,'pharmacy',CASE WHEN $2 IN ('recordSale','receiveStock') THEN now() END,now() FROM tenant_state WHERE slug=$1 ON CONFLICT(slug) DO UPDATE SET activated_at=coalesce(platform_workspace_meta.activated_at,excluded.activated_at),last_activity=excluded.last_activity",
      [workspace, action],
    );
  }
  await maintainDuringActivity();

}
