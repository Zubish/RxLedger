"""Isolated real PostgreSQL backup/restore; never reads a production URL."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import quote

SCRIPT = Path(__file__).resolve().with_name('database-backup.sh')


def run(*args, env=None):
    result = subprocess.run(args, env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} failed: {result.stderr}')
    return result.stdout


def main():
    for binary in ('initdb', 'pg_ctl', 'psql', 'createdb', 'pg_dump', 'pg_restore', 'age', 'age-keygen'):
        if not shutil.which(binary):
            raise SystemExit('Required test tool missing: ' + binary)
    with tempfile.TemporaryDirectory(prefix='rx-backup-pg-') as temp:
        root = Path(temp)
        data = root / 'pgdata'
        sock = root / 'socket'
        sock.mkdir()
        # Only a private Unix socket, no TCP listener, synthetic test data only.
        run('initdb', '-D', str(data), '-A', 'trust', '-U', 'backup_test', '--no-locale')
        run('pg_ctl', '-D', str(data), '-l', str(root / 'server.log'), '-o',
            f"-k {sock} -p 55472 -c listen_addresses=''", '-w', 'start')
        try:
            conn = ['-h', str(sock), '-p', '55472', '-U', 'backup_test']
            run('createdb', *conn, 'source')
            run('createdb', *conn, 'restored')
            sql = """
CREATE TABLE tenant_state (id text PRIMARY KEY, data jsonb NOT NULL);
INSERT INTO tenant_state VALUES ('synthetic', '{"patients":[{"name":"Test Patient","age":44}],"sales":[{"totalMinor":150000}],"stock":28}');
CREATE SCHEMA platform_test;
CREATE TABLE platform_test.audit (id integer PRIMARY KEY, event text);
INSERT INTO platform_test.audit VALUES (1, 'synthetic access change');
"""
            run('psql', *conn, '-d', 'source', '-v', 'ON_ERROR_STOP=1', '-c', sql)
            key = root / 'recovery.key'
            run('age-keygen', '-o', str(key))
            recipient = run('age-keygen', '-y', str(key)).strip()
            # TLS parameter is validated by the runner; libpq ignores it on Unix sockets.
            url = f'postgresql://backup_test@{quote(str(sock), safe="")}:55472/source?sslmode=require'
            env = dict(os.environ, BACKUP_DATABASE_URL=url,
                       BACKUP_AGE_RECIPIENT=recipient, BACKUP_OUTPUT_DIR=str(root / 'output'))
            run('bash', str(SCRIPT), env=env)
            backup, = (root / 'output').iterdir()
            archive = backup / 'database.dump.age'
            manifest = json.loads((backup / 'manifest.json').read_text())
            assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
            dump = root / 'restored.dump'
            run('age', '-d', '-i', str(key), '-o', str(dump), str(archive))
            run('pg_restore', *conn, '-d', 'restored', '--exit-on-error',
                '--single-transaction', '--no-owner', '--no-acl', str(dump))
            for query in ('SELECT id,data::text FROM tenant_state ORDER BY id',
                          'SELECT * FROM platform_test.audit ORDER BY id'):
                expected = run('psql', *conn, '-d', 'source', '-At', '-c', query)
                actual = run('psql', *conn, '-d', 'restored', '-At', '-c', query)
                assert expected and expected == actual, 'Restored content mismatch'
            print('Real PostgreSQL backup → age encryption → decryption → empty-database restore passed; public and non-public synthetic contents matched.')
        finally:
            run('pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop')


if __name__ == '__main__':
    main()
