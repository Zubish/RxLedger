import {
  getPlatformAuth,
  requestHeaders,
  mergedCookies,
  trustedMutation,
  ownerStatus,
} from "./auth.js";
import { getSql } from "../_shared.js";
import type { HandlerRequest, HandlerResponse } from "../_shared.js";
const allowed = [
  "sign-in/email",
  "sign-in/username",
  "sign-out",
  "get-session",
  "two-factor/enable",
  "two-factor/verify-totp",
  "two-factor/verify-backup-code",
];
export default async function handler(
  req: HandlerRequest & { query?: Record<string, string> },
  res: HandlerResponse,
) {
  res.setHeader("Cache-Control", "no-store");
  const route = req.query?.authRoute || "";
  if (!allowed.includes(route)) {
    res.status(404).json({ error: "Unavailable" });
    return;
  }
  if (req.method !== "GET" && !trustedMutation(req)) {
    res.status(403).json({ error: "Invalid origin" });
    return;
  }
  if ((req.body as { trustDevice?: boolean })?.trustDevice) {
    res.status(400).json({ error: "Trusted devices are disabled" });
    return;
  }
  try {
    if (route === "two-factor/enable") {
      const owner = await ownerStatus(req);
      if (!owner || owner.session.user.twoFactorEnabled) {
        res.status(403).json({
          error:
            "Authenticator setup is allowed only for initial owner enrollment",
        });
        return;
      }
    }
    const auth = await getPlatformAuth();
    const headers = requestHeaders(req);
    let targetRoute=route;
    let body=req.body;
    if(route === "sign-in/username") {
      if(req.method !== "POST") {res.status(405).json({error:"Method not allowed"});return;}
      const credentials=req.body as {username?:unknown;password?:unknown};
      const username=typeof credentials?.username === 'string'?credentials.username.trim().slice(0,80):'';
      const rows=await getSql().query('SELECT u.email FROM platform_owners o JOIN platform_auth_user u ON u.id=o.user_id WHERE lower(o.username)=lower($1) AND o.enabled=true',[username]);
      targetRoute="sign-in/email";
      body={email:rows[0]?.email || "unknown-owner@rxledger.invalid",password:typeof credentials?.password === "string"?credentials.password:""};
    }
    const response = await auth.handler(
      new Request(
        (process.env.RXLEDGER_APP_ORIGIN || "https://rxledger.vercel.app") +
          "/api/platform-auth/" +
          targetRoute,
        {
          method: req.method,
          headers,
          body:
            req.method === "GET" ? undefined : JSON.stringify(body || {}),
        },
      ),
    );
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    if (
      response.ok &&
      ["two-factor/verify-totp", "two-factor/verify-backup-code"].includes(
        route,
      )
    ) {
      const session = await auth.api.getSession({
        headers: mergedCookies(headers, cookies),
      });
      if (session)
        await getSql().query(
          "INSERT INTO platform_mfa_sessions(session_id,expires_at) SELECT $1,$2 FROM platform_owners WHERE user_id=$3 AND enabled=true ON CONFLICT(session_id) DO UPDATE SET verified_at=now(),expires_at=excluded.expires_at",
          [session.session.id, session.session.expiresAt, session.user.id],
        );
    }
    if (route !== "get-session")
      await getSql().query("INSERT INTO platform_audit(event) VALUES($1)", [
        route + ":" + response.status,
      ]);
    res.status(response.status).json(await response.json());
  } catch {
    res
      .status(503)
      .json({ error: "Platform sign-in is temporarily unavailable" });
  }
}
