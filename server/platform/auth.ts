import { betterAuth } from "better-auth";
import { platformAuthOptions } from "./auth-options.js";
import { getConnectionString, getSql } from "../_shared.js";
import type { HandlerRequest } from "../_shared.js";

const createAuth = (secret: string) =>
  betterAuth(platformAuthOptions(secret, getConnectionString()));
let authPromise: Promise<ReturnType<typeof createAuth>> | undefined;
export function getPlatformAuth() {
  if (!authPromise)
    authPromise = (async () => {
      const rows = await getSql().query(
        "SELECT auth_secret FROM platform_config WHERE id=1",
        [],
      );
      if (!rows[0]?.auth_secret)
        throw new Error("Platform configuration is unavailable");
      return createAuth(String(rows[0].auth_secret));
    })().catch((error) => {
      authPromise = undefined;
      throw error;
    });
  return authPromise!;
}

export function requestHeaders(req: HandlerRequest) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined)
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  return headers;
}

export function trustedMutation(req: HandlerRequest) {
  const origin = req.headers.origin;
  const expected =
    process.env.RXLEDGER_APP_ORIGIN || "https://rxledger.vercel.app";
  return (
    origin === expected ||
    (process.env.NODE_ENV !== "production" &&
      origin === "http://localhost:5173")
  );
}

export async function ownerStatus(req: HandlerRequest) {
  const auth = await getPlatformAuth();
  const session = await auth.api.getSession({ headers: requestHeaders(req) });
  if (!session) return null;
  const rows = await getSql().query(
    "SELECT o.user_id, o.require_mfa, m.session_id FROM platform_owners o LEFT JOIN platform_mfa_sessions m ON m.session_id=$2 AND m.expires_at>now() WHERE o.user_id=$1 AND o.enabled=true",
    [session.user.id, session.session.id],
  );
  if (!rows.length) return null;
  return {
    session,
    accessGranted: rows[0].require_mfa === false || (Boolean(rows[0].session_id) && Boolean(session.user.twoFactorEnabled)),
    mfaVerified:
      Boolean(rows[0].session_id) &&
      Boolean(
        (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
      ),
  };
}

export async function requireOwner(req: HandlerRequest) {
  const owner = await ownerStatus(req);
  if (!owner || !owner.accessGranted) throw new Error("PLATFORM_UNAUTHORIZED");
  return owner;
}

export function mergedCookies(headers: Headers, cookies: string[]) {
  const map = new Map(
    (headers.get("cookie") || "").split(";").map((value) => {
      const [key, ...rest] = value.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  for (const cookie of cookies) {
    const [pair] = cookie.split(";");
    const [key, ...rest] = pair.split("=");
    map.set(key, rest.join("="));
  }
  const merged = new Headers(headers);
  merged.set(
    "cookie",
    [...map]
      .filter(([key]) => key)
      .map(([key, value]) => key + "=" + value)
      .join("; "),
  );
  return merged;
}
