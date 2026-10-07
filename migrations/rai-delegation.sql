-- Additive migration. Apply explicitly before enabling RAI_DELEGATION_ENABLED.
-- Only hashes of opaque codes and grants are stored. Never store raw session tokens.
CREATE TABLE IF NOT EXISTS rai_authorization_codes (
  token_hash TEXT PRIMARY KEY,
  record JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rai_authorization_codes_expiry ON rai_authorization_codes (expires_at);
CREATE TABLE IF NOT EXISTS rai_delegated_grants (
  token_hash TEXT PRIMARY KEY,
  record JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS rai_delegated_grants_expiry ON rai_delegated_grants (expires_at);
-- Schedule expiry cleanup before rollout (not a user-data retention mechanism):
-- DELETE FROM rai_authorization_codes WHERE expires_at <= now();
-- DELETE FROM rai_delegated_grants WHERE expires_at <= now();
