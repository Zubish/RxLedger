import { getSql } from "../_shared.js";
export async function platformReport(params: URLSearchParams) {
  const sql = getSql();
  const days = [1, 7, 30].includes(Number(params.get("days")))
    ? Number(params.get("days"))
    : 7;
  const includeDemo = params.get("demo") === "true";
  const page = Math.max(1, Math.min(10000, Number(params.get("page")) || 1));
  const limit = 25;
  const search = (params.get("search") || "").slice(0, 120);
  const category = ["pharmacy", "demo", "internal"].includes(
    params.get("kind") || "",
  )
    ? params.get("kind")
    : "";
  const sinceValue = params.get("since") || "";
  const since =
    /^\d{4}-\d{2}-\d{2}$/.test(sinceValue) &&
    Number.isFinite(Date.parse(sinceValue))
      ? sinceValue
      : "";
  const activity = ["active", "inactive"].includes(params.get("activity") || "")
    ? params.get("activity")
    : "";
  const activation = ["activated", "not-activated"].includes(
    params.get("activation") || "",
  )
    ? params.get("activation")
    : "";
  const directoryFilter = (
    dateParam: number,
    activityParam: number,
    activationParam: number,
    daysParam: number,
  ) =>
    " AND ($" +
    dateParam +
    "='' OR t.created_at>=NULLIF($" +
    dateParam +
    ",'')::timestamptz) AND ($" +
    activationParam +
    "='' OR (m.activated_at IS NOT NULL)=($" +
    activationParam +
    "='activated')) AND ($" +
    activityParam +
    "='' OR EXISTS(SELECT 1 FROM platform_events activity_event WHERE activity_event.workspace=t.slug AND activity_event.event IN ('page_visit','operation') AND activity_event.at>=now()-($" +
    daysParam +
    "*interval '1 day'))=($" +
    activityParam +
    "='active'))";
  const window = "at >= now()-($1 * interval '1 day')";
  const filter = " AND ($2 OR kind='pharmacy')";
  const [
    config,
    counts,
    rows,
    total,
    usage,
    daily,
    routes,
    vitals,
    errors,
    probes,
  ] = await Promise.all([
    sql.query("SELECT started_at FROM platform_config WHERE id=1", []),
    sql.query(
      "SELECT count(*)::int total,count(*) FILTER(WHERE coalesce(m.kind,'pharmacy')='pharmacy')::int pharmacy,count(*) FILTER(WHERE m.kind='demo')::int demo,count(*) FILTER(WHERE m.kind='internal')::int internal,count(*) FILTER(WHERE coalesce(m.kind,'pharmacy')='pharmacy' AND t.created_at>=now()-($1*interval '1 day'))::int new FROM tenant_state t LEFT JOIN platform_workspace_meta m ON m.slug=t.slug",
      [days],
    ),
    sql.query(
      "SELECT t.slug,coalesce(t.data->'settings'->>'accountName',t.slug) name,coalesce(m.kind,'pharmacy') kind,t.created_at, jsonb_array_length(coalesce(t.data->'branches','[]'::jsonb))::int branches,(SELECT count(*)::int FROM jsonb_array_elements(coalesce(t.data->'users','[]'::jsonb)) u WHERE u->>'status'='active') staff,coalesce(m.last_activity,max(e.at) FILTER(WHERE e.event IN ('page_visit','operation'))) last_activity,count(e.id) FILTER(WHERE e.event='page_visit')::int visits,count(e.id) FILTER(WHERE e.event='operation')::int operations,(m.activated_at IS NOT NULL) activated FROM tenant_state t LEFT JOIN platform_workspace_meta m ON m.slug=t.slug LEFT JOIN platform_events e ON e.workspace=t.slug AND e.at>=now()-($1*interval '1 day') WHERE ($2='' OR t.slug ILIKE '%'||$2||'%' OR t.data->'settings'->>'accountName' ILIKE '%'||$2||'%') AND ($3='' OR coalesce(m.kind,'pharmacy')=$3)" +
        directoryFilter(6, 7, 8, 1) +
        " GROUP BY t.slug,m.slug,m.kind ORDER BY t.created_at DESC,t.slug LIMIT $4 OFFSET $5",
      [
        days,
        search,
        category,
        limit,
        (page - 1) * limit,
        since,
        activity,
        activation,
      ],
    ),
    sql.query(
      "SELECT count(*)::int total FROM tenant_state t LEFT JOIN platform_workspace_meta m ON m.slug=t.slug WHERE ($1='' OR t.slug ILIKE '%'||$1||'%' OR t.data->'settings'->>'accountName' ILIKE '%'||$1||'%') AND ($2='' OR coalesce(m.kind,'pharmacy')=$2)" +
        directoryFilter(3, 4, 5, 6),
      [search, category, since, activity, activation, days],
    ),
    sql.query(
      "SELECT page,count(*)::int visits,count(DISTINCT workspace)::int workspaces FROM platform_events WHERE " +
        window +
        filter +
        " AND event='page_visit' GROUP BY page ORDER BY visits DESC",
      [days, includeDemo],
    ),
    sql.query(
      "SELECT at::date::text date,count(*) FILTER(WHERE event='page_visit')::int visits,count(*) FILTER(WHERE event='operation')::int operations,count(DISTINCT workspace) FILTER(WHERE event IN ('page_visit','operation'))::int active FROM platform_events WHERE " +
        window +
        filter +
        " GROUP BY at::date ORDER BY at::date",
      [days, includeDemo],
    ),
    sql.query(
      "SELECT route,action,count(*)::int samples,count(*) FILTER(WHERE status>=500)::int failures,percentile_cont(0.5) WITHIN GROUP(ORDER BY duration) p50,percentile_cont(0.95) WITHIN GROUP(ORDER BY duration) p95,count(*) FILTER(WHERE status BETWEEN 400 AND 499)::int rejected,avg(load_ms) load_ms,avg(auth_ms) auth_ms,avg(save_ms) save_ms,avg(bytes) average_bytes FROM platform_events WHERE " +
        window +
        filter +
        " AND event='api' GROUP BY route,action ORDER BY samples DESC LIMIT 50",
      [days, includeDemo],
    ),
    sql.query(
      "SELECT device,vital name,count(*)::int samples,percentile_cont(0.75) WITHIN GROUP(ORDER BY value) p75 FROM platform_events WHERE " +
        window +
        filter +
        " AND event='web_vital' GROUP BY device,vital",
      [days, includeDemo],
    ),
    sql.query(
      'SELECT error_group AS "group",page,release,count(*)::int occurrences FROM platform_events WHERE ' +
        window +
        filter +
        " AND event='browser_error' GROUP BY error_group,page,release ORDER BY occurrences DESC LIMIT 25",
      [days, includeDemo],
    ),
    sql.query(
      "SELECT count(*)::int observed,count(*) FILTER(WHERE status=200)::int successes FROM platform_events WHERE " +
        window +
        " AND event='probe'",
      [days],
    ),
  ]);
  const active = await sql.query(
    "SELECT count(*) FILTER(WHERE event='api')::int samples,count(*) FILTER(WHERE event='api' AND status>=500)::int failures,count(DISTINCT workspace) FILTER(WHERE event IN ('page_visit','operation'))::int active,count(DISTINCT workspace) FILTER(WHERE event='operation' AND action IN ('recordSale','receiveStock'))::int activated,percentile_cont(0.95) WITHIN GROUP(ORDER BY duration) FILTER(WHERE event='api') p95 FROM platform_events WHERE " +
      window +
      filter,
    [days, includeDemo],
  );
  const start = String(config[0].started_at);
  const expected = Math.max(
    0,
    Math.floor(
      (Date.now() -
        Math.max(new Date(start).getTime(), Date.now() - days * 86400000)) /
        300000,
    ),
  );
  const observed = Number(probes[0].observed);
  const successes = Number(probes[0].successes);
  return {
    generatedAt: new Date().toISOString(),
    measurementStartedAt: start,
    release: process.env.VERCEL_GIT_COMMIT_SHA || "local",
    days,
    includeDemo,
    counts: {
      ...counts[0],
      newPharmacies: counts[0].new,
      active: active[0].active,
      activated: active[0].activated,
    },
    workspacePage: {
      rows: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        createdAt: r.created_at,
        branches: r.branches,
        activeStaff: r.staff,
        lastActivity: r.last_activity,
        activated: Boolean(r.activated),
        visits: r.visits,
        operations: r.operations,
      })),
      total: total[0].total,
      page,
      limit,
    },
    usage,
    daily,
    health: {
      routes: routes.map((r) => ({
        ...r,
        averageBytes: r.average_bytes,
        rejected: r.rejected,
        loadMs: r.load_ms,
        authMs: r.auth_ms,
        saveMs: r.save_ms,
      })),
      samples: active[0].samples,
      failures: active[0].failures,
      p95: active[0].p95,
      devices: vitals,
      errors,
      availability: {
        expected,
        observed,
        successes,
        missing: Math.max(0, expected - observed),
        percentage:
          expected > 0 && observed >= expected
            ? (100 * successes) / observed
            : null,
      },
    },
  };
}
