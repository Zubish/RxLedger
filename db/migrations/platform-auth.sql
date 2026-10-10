-- Generated from installed Better Auth schema; review before applying.
CREATE TABLE IF NOT EXISTS "platform_auth_user" (
  id text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "twoFactorEnabled" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "platform_auth_session" (
  id text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "platform_auth_user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "platform_auth_session_userId_idx" ON "platform_auth_session"("userId");

CREATE TABLE IF NOT EXISTS "platform_auth_account" (
  id text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "platform_auth_user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_auth_account_userId_idx" ON "platform_auth_account"("userId");

CREATE TABLE IF NOT EXISTS "platform_auth_verification" (
  id text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL,
  "updatedAt" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_auth_verification_identifier_idx" ON "platform_auth_verification"("identifier");

CREATE TABLE IF NOT EXISTS "platform_auth_two_factor" (
  id text PRIMARY KEY,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES "platform_auth_user"("id") ON DELETE CASCADE,
  "verified" boolean DEFAULT true,
  "failedVerificationCount" bigint DEFAULT 0,
  "lockedUntil" timestamptz
);

CREATE INDEX IF NOT EXISTS "platform_auth_two_factor_secret_idx" ON "platform_auth_two_factor"("secret");

CREATE INDEX IF NOT EXISTS "platform_auth_two_factor_userId_idx" ON "platform_auth_two_factor"("userId");

CREATE TABLE IF NOT EXISTS "platform_auth_rate_limit" (
  id text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "count" bigint NOT NULL,
  "lastRequest" bigint NOT NULL
);
