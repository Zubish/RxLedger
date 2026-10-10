import { getSql } from "../_shared.js";
/** Raw observations: 30 days. Anonymous-content-free workspace daily activity: 12 months. */
export async function maintainPlatformTelemetry() {
  const sql = getSql();
  // The job runs once per UTC day. Roll up before pruning; retries are idempotent.
  const claimed = await sql.query(
    "INSERT INTO platform_maintenance(day) VALUES(current_date) ON CONFLICT DO NOTHING RETURNING day",
    [],
  );
  if (!claimed.length) return;
  try {
    await sql.query(
      "INSERT INTO platform_daily(day,workspace,kind,page,visits,operations) SELECT at::date,workspace,kind,page,count(*) FILTER(WHERE event='page_visit'),count(*) FILTER(WHERE event='operation') FROM platform_events WHERE workspace IS NOT NULL AND at<current_date AND at>=now()-interval '30 days' AND event IN ('page_visit','operation') GROUP BY at::date,workspace,kind,page ON CONFLICT(day,workspace,kind,page) DO UPDATE SET visits=excluded.visits,operations=excluded.operations",
      [],
    );
    await sql.query(
      "DELETE FROM platform_events WHERE at<now()-interval '30 days'",
      [],
    );
    await sql.query(
      "DELETE FROM platform_daily WHERE day<current_date-interval '12 months'",
      [],
    );
    await sql.query(
      "DELETE FROM platform_audit WHERE at<now()-interval '12 months'",
      [],
    );
    await sql.query(
      "DELETE FROM platform_mfa_sessions WHERE expires_at<now()",
      [],
    );
    await sql.query(
      'DELETE FROM platform_auth_session WHERE "expiresAt"<now()',
      [],
    );
    await sql.query(
      'DELETE FROM platform_auth_verification WHERE "expiresAt"<now()',
      [],
    );
    await sql.query(
      'DELETE FROM platform_auth_rate_limit WHERE "lastRequest"<$1',
      [Date.now() - 86400000],
    );
  } catch (error) {
    await sql.query(
      "DELETE FROM platform_maintenance WHERE day=current_date",
      [],
    );
    throw error;
  }
}

let nextMaintenance=0;
/** Keep retention working during app activity if the external scheduler is unavailable. */
export function maintainDuringActivity(){
 if(Date.now()<nextMaintenance)return Promise.resolve();
 nextMaintenance=Date.now()+3600000;
 return maintainPlatformTelemetry().catch(error=>{nextMaintenance=0;throw error;});
}
