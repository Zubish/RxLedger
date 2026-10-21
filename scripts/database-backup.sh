#!/usr/bin/env bash
# Requires PostgreSQL clients and age. Never enable shell tracing here.
set -euo pipefail
umask 077

fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ -n "${BACKUP_DATABASE_URL:-}" ]] || fail 'BACKUP_DATABASE_URL is required.'
[[ -n "${BACKUP_AGE_RECIPIENT:-}" ]] || fail 'BACKUP_AGE_RECIPIENT is required.'
[[ -n "${BACKUP_OUTPUT_DIR:-}" ]] || fail 'BACKUP_OUTPUT_DIR is required.'
for tool in pg_dump pg_restore age python3; do
  command -v "$tool" >/dev/null || fail "Required tool missing: $tool"
done

# Validate without echoing credentials; require an explicit direct TLS connection.
python3 - <<'PY' || exit 1
import os,sys
from urllib.parse import urlsplit,parse_qs
try:
    u=urlsplit(os.environ['BACKUP_DATABASE_URL'])
    valid=(u.scheme in ('postgres','postgresql') and u.hostname and
           '-pooler' not in u.hostname and u.path not in ('','/') and
           parse_qs(u.query).get('sslmode',[''])[0] in ('require','verify-ca','verify-full'))
except Exception:
    valid=False
if not valid:
    sys.exit('Backup requires a direct PostgreSQL URL with TLS enabled.')
p=os.path.realpath(os.environ['BACKUP_OUTPUT_DIR'])
if any(x in p.split(os.sep) for x in ('public_html','www','dist','.git')):
    sys.exit('Backup output must be outside any web root or Git internals.')
PY

mkdir -p "$BACKUP_OUTPUT_DIR"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
stamp=$(date -u +%Y%m%dT%H%M%SZ)
name="rxledger-${stamp}-$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Parsed libpq environment avoids putting credentials into process arguments.
# pg_dump takes one consistent database snapshot, including non-public schemas.
if ! python3 - "$work/database.dump" 2>"$work/private-error" <<'PY'
import os,subprocess,sys
from urllib.parse import urlsplit,parse_qs,unquote
u=urlsplit(os.environ['BACKUP_DATABASE_URL'])
q=parse_qs(u.query)
allowed={'sslmode':'PGSSLMODE','channel_binding':'PGCHANNELBINDING',
         'sslrootcert':'PGSSLROOTCERT','sslcert':'PGSSLCERT','sslkey':'PGSSLKEY',
         'options':'PGOPTIONS'}
if set(q)-set(allowed):
    sys.exit('Unsupported connection option; configure the direct backup URL explicitly.')
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
env.update(PGHOST=unquote(u.hostname),PGPORT=str(u.port or 5432),
           PGDATABASE=unquote(u.path.lstrip('/')),PGUSER=unquote(u.username or ''),
           PGPASSWORD=unquote(u.password or ''),PGCONNECT_TIMEOUT='30')
env.update({allowed[k]:v[0] for k,v in q.items()})
sys.exit(subprocess.run(['pg_dump','--format=custom','--no-owner','--no-acl',
    '--lock-wait-timeout=30000','--file='+sys.argv[1]],env=env).returncode)
PY
then
  fail 'Database dump failed; no backup published. Inspect connection/permissions privately.'
fi
[[ -s "$work/database.dump" ]] || fail 'Database dump was empty.'
pg_restore --list "$work/database.dump" >"$work/toc" 2>"$work/private-error" \
  || fail 'Database archive validation failed; no backup published.'
[[ -s "$work/toc" ]] || fail 'Database archive has no table of contents.'
age --recipient "$BACKUP_AGE_RECIPIENT" --output "$work/database.dump.age" \
  "$work/database.dump" 2>"$work/private-error" \
  || fail 'Backup encryption failed; no backup published.'

python3 - "$work" "$name" "$started" <<'PY'
import hashlib,json,pathlib,sys,datetime
p=pathlib.Path(sys.argv[1])
digest=hashlib.file_digest((p/'database.dump.age').open('rb'),'sha256').hexdigest()
manifest={'format':'rxledger-pg-dump-age-v1','name':sys.argv[2],
 'snapshotStartedAt':sys.argv[3], 'completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'sha256':digest,'archiveCheck':'pg_restore --list passed',
 'restoreVerified':False}
(p/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
PY
# Publish the directory atomically; only encrypted bytes and nonclinical metadata.
mkdir "$work/publish"
mv "$work/database.dump.age" "$work/manifest.json" "$work/publish/"
staging=$(mktemp -d "$BACKUP_OUTPUT_DIR/.pending-XXXXXXXX")
cp "$work/publish/"* "$staging/"
mv "$staging" "$BACKUP_OUTPUT_DIR/$name"
printf 'Encrypted database backup published: %s\n' "$name"
printf 'Archive structure checked; a successful restore still needs separate verification.\n'
