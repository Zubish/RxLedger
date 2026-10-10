import { maintainPlatformTelemetry, maintainDuringActivity } from "./maintenance.js";
import {waitUntil} from "@vercel/functions";

import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  ownerStatus,
  requireOwner,
  trustedMutation,
} from "./auth.js";
import { getSql } from "../_shared.js";
import type { HandlerRequest, HandlerResponse } from "../_shared.js";
import { platformReport } from "./report.js";
const jwks = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);
export default async function handler(
  req: HandlerRequest & { query?: Record<string, string> },
  res: HandlerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  const mode = req.query?.mode || "status";
  const sql = getSql();
  try {
    if (mode === "probe") {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }
      const token = String(req.headers.authorization || "").replace(
        /^Bearer /,
        "",
      );
      const { payload } = await jwtVerify(token, jwks, {
        issuer: "https://token.actions.githubusercontent.com",
        audience: "rxledger-platform",
      });
      if (
        payload.repository !== "Zubish/RxLedger" ||
        payload.ref !== "refs/heads/master" ||
        payload.workflow_ref !==
          "Zubish/RxLedger/.github/workflows/platform-availability.yml@refs/heads/master"
      )
        throw new Error("PLATFORM_UNAUTHORIZED");
      const body = req.body as { ok?: boolean; duration?: number };
      const slot = Math.floor(Date.now() / 300000);
      await sql.query(
        "INSERT INTO platform_events(id,event,status,duration) VALUES($1,'probe',$2,$3) ON CONFLICT DO NOTHING",
        [
          "probe:" + slot,
          body.ok === true ? 200 : 500,
          Math.max(0, Math.min(30000, Number(body.duration) || 0)),
        ],
      );
      await maintainPlatformTelemetry();
      res.status(200).json({ ok: true });
      return;
    }
    if (mode === "status") {
      const owner = await ownerStatus(req);
      res.status(200).json({
        authenticated: Boolean(owner?.accessGranted),
        mfaRequired: Boolean(owner && !owner.accessGranted),
        mfaEnrolled: Boolean(owner?.session.user.twoFactorEnabled),
        user: owner
          ? { name: owner.session.user.name, email: owner.session.user.email }
          : undefined,
      });
      return;
    }
    if (mode === "enroll") { res.status(404).json({error:"Owner registration is closed"});return; }
    const owner = await requireOwner(req);
    if (mode === "report" && req.method === "GET") {
      waitUntil(maintainDuringActivity().catch(()=>console.warn("platform-maintenance-failed")));
      res
        .status(200)
        .json(await platformReport(new URLSearchParams(req.query)));
      return;
    }
    if (mode === "export" && req.method === "POST" && trustedMutation(req)) {
      await sql.query("INSERT INTO platform_audit(actor,event) VALUES($1,$2)", [
        owner.session.user.id,
        "directory-export",
      ]);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(404).json({ error: "Unavailable" });
  } catch (error) {
    const denied =
      error instanceof Error && error.message === "PLATFORM_UNAUTHORIZED";
    if(denied) await sql.query("INSERT INTO platform_audit(event) SELECT 'access-denied' WHERE (SELECT count(*) FROM platform_audit WHERE event='access-denied' AND at>now()-interval '1 minute')<60",[]).catch(()=>{});
    res.status(denied ? 401 : 503).json({
      error: denied
        ? "Owner authentication is required"
        : "Platform reporting is temporarily unavailable",
    });
  }
}
