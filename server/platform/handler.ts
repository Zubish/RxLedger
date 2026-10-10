import { maintainPlatformTelemetry } from "./maintenance.js";
import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  getPlatformAuth,
  requestHeaders,
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
        authenticated: Boolean(owner?.mfaVerified),
        mfaRequired: Boolean(owner && !owner.mfaVerified),
        mfaEnrolled: Boolean(owner?.session.user.twoFactorEnabled),
        user: owner
          ? { name: owner.session.user.name, email: owner.session.user.email }
          : undefined,
      });
      return;
    }
    if (mode === "enroll") {
      if (req.method !== "POST" || !trustedMutation(req)) {
        res.status(403).json({ error: "Invalid request" });
        return;
      }
      const body = req.body as {
        token?: string;
        email?: string;
        password?: string;
        name?: string;
      };
      if (
        !body.token ||
        !/^[a-f0-9]{64}$/.test(body.token) ||
        !body.email ||
        !body.password ||
        body.password.length < 12
      ) {
        res.status(400).json({
          error:
            "A valid invitation, email and password of at least 12 characters are required",
        });
        return;
      }
      const tokenHash = createHash("sha256").update(body.token).digest("hex");
      const claimed = await sql.query(
        "UPDATE platform_invites SET consumed_at=now() WHERE token_hash=$1 AND consumed_at IS NULL AND expires_at>now() AND NOT EXISTS(SELECT 1 FROM platform_owners) AND EXISTS(SELECT 1 FROM platform_config WHERE owner_email IS NULL OR lower(owner_email)=lower($2)) RETURNING token_hash",
        [tokenHash, body.email],
      );
      if (!claimed.length) {
        res.status(403).json({ error: "Invitation expired or already used" });
        return;
      }
      try {
        const auth = await getPlatformAuth();
        const result = await auth.api.signUpEmail({
          body: {
            email: body.email,
            password: body.password,
            name: body.name?.slice(0, 80) || "Platform owner",
          },
          headers: requestHeaders(req),
          asResponse: true,
        });
        if (!result.ok) {
          await sql.query(
            "UPDATE platform_invites SET consumed_at=NULL WHERE token_hash=$1",
            [tokenHash],
          );
          res.status(result.status).json(await result.json());
          return;
        }
        const data = (await result.json()) as { user: { id: string } };
        await sql.query("INSERT INTO platform_owners(user_id) VALUES($1)", [
          data.user.id,
        ]);
        res.setHeader("Set-Cookie", result.headers.getSetCookie());
        res.status(200).json({ ok: true, mfaRequired: true });
        return;
      } catch (error) {
        await sql.query(
          "UPDATE platform_invites SET consumed_at=NULL WHERE token_hash=$1",
          [tokenHash],
        );
        throw error;
      }
    }
    const owner = await requireOwner(req);
    if (mode === "report" && req.method === "GET") {
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
        ? "Owner authentication and two-factor verification are required"
        : "Platform reporting is temporarily unavailable",
    });
  }
}
