import { ensureSchema, getSql } from '../_shared.js';
import type { CodeRecord, DelegationStore, GrantRecord } from './delegation.js';

// Tables are provisioned by the reviewed SQL migration, not during requests.
export function createDelegationStore(): DelegationStore {
  const sql = getSql();
  return {
    async saveCode(key, value) {
      await sql`INSERT INTO rai_authorization_codes (token_hash, record, expires_at)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${new Date(value.expiresAt).toISOString()})`;
    },
    async takeCode(key) {
      const rows = await sql`DELETE FROM rai_authorization_codes WHERE token_hash = ${key} RETURNING record`;
      return rows[0]?.record as CodeRecord | undefined;
    },
    async saveGrant(key, value) {
      await sql`INSERT INTO rai_delegated_grants (token_hash, record, expires_at)
        VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${new Date(value.expiresAt).toISOString()})`;
    },
    async getGrant(key) {
      const rows = await sql`SELECT record FROM rai_delegated_grants WHERE token_hash = ${key} AND expires_at > now()`;
      return rows[0]?.record as GrantRecord | undefined;
    },
    async revokeGrant(key) {
      await sql`DELETE FROM rai_delegated_grants WHERE token_hash = ${key}`;
    },
    async sessionActive(sessionHash, userId) {
      await ensureSchema();
      const rows = await sql`SELECT 1 FROM sessions WHERE token_hash = ${sessionHash} AND user_id = ${userId}
        AND expires_at > now() AND last_seen_at > now() - interval '30 minutes'`;
      return rows.length === 1;
    }
  };
}
