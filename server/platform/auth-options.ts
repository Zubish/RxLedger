import { Pool, neonConfig } from "@neondatabase/serverless";
import WebSocket from "ws";
neonConfig.webSocketConstructor = WebSocket;
import { twoFactor } from "better-auth/plugins/two-factor";
import type { BetterAuthOptions } from "better-auth";

export function platformAuthOptions(secret: string, connectionString: string) {
  return {
    appName: "RxLedger Platform",
    baseURL: process.env.RXLEDGER_APP_ORIGIN || "https://rxledger.vercel.app",
    basePath: "/api/platform-auth",
    secret,
    database: new Pool({
      connectionString,
      max: 2,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 12 },
    user: { modelName: "platform_auth_user" },
    account: { modelName: "platform_auth_account" },
    session: {
      modelName: "platform_auth_session",
      expiresIn: 1800,
      updateAge: 300,
      cookieCache: { enabled: false },
    },
    verification: { modelName: "platform_auth_verification" },
    advanced: {
      cookiePrefix: "rxledger_platform",
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for"] },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "platform_auth_rate_limit",
      window: 60,
      max: 10,
    },
    plugins: [
      twoFactor({
        issuer: "RxLedger Platform",
        twoFactorTable: "platform_auth_two_factor",
      }),
    ],
  } satisfies BetterAuthOptions;
}
