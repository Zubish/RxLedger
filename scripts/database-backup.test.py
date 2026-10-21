"""Synthetic backup safety tests; real age encryption, simulated PostgreSQL clients."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().with_name('database-backup.sh')


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        for name, code in {
            'pg_dump': '''#!/usr/bin/env python3
import os,sys
if os.environ.get('FAIL_DUMP'): sys.exit(1)
assert os.environ['PGHOST']=='db.example'
assert os.environ['PGDATABASE']=='test'
assert os.environ['PGUSER']=='test'
assert os.environ['PGPASSWORD']=='private-test-password'
assert os.environ['PGSSLMODE']=='require'
assert not any('postgresql://' in arg for arg in sys.argv)
for arg in sys.argv:
 if arg.startswith('--file='): open(arg[7:],'wb').write(b'PGDMP synthetic pharmacy fixture')
''',
            'pg_restore': '''#!/usr/bin/env python3
import os,sys
if os.environ.get('FAIL_VALIDATE'): sys.exit(1)
print('synthetic table of contents')
''',
        }.items():
            p = self.bin / name
            p.write_text(code)
            p.chmod(0o700)
        self.env = dict(os.environ,
            PATH=str(self.bin) + os.pathsep + os.environ['PATH'],
            TMPDIR=str(self.root),
            BACKUP_DATABASE_URL='postgresql://test:private-test-password@db.example/test?sslmode=require',
            BACKUP_OUTPUT_DIR=str(self.root / 'output'))
        key = self.root / 'recovery.key'
        subprocess.run(['age-keygen', '-o', str(key)], check=True, capture_output=True)
        self.key = key
        recipient = subprocess.check_output(['age-keygen', '-y', str(key)], text=True).strip()
        self.env['BACKUP_AGE_RECIPIENT'] = recipient

    def run_backup(self, **changes):
        return subprocess.run(['bash', str(SCRIPT)], env=dict(self.env, **changes),
                              capture_output=True, text=True)

    def test_encrypted_roundtrip_and_metadata(self):
        result = self.run_backup()
        self.assertEqual(result.returncode, 0, result.stderr)
        backup, = list((self.root / 'output').iterdir())
        self.assertEqual({p.name for p in backup.iterdir()}, {'database.dump.age', 'manifest.json'})
        archive = backup / 'database.dump.age'
        manifest = json.loads((backup / 'manifest.json').read_text())
        self.assertEqual(hashlib.sha256(archive.read_bytes()).hexdigest(), manifest['sha256'])
        self.assertFalse(manifest['restoreVerified'])
        self.assertNotIn(b'pharmacy', archive.read_bytes())
        self.assertEqual(subprocess.check_output(['age', '-d', '-i', str(self.key), str(archive)]),
                         b'PGDMP synthetic pharmacy fixture')
        self.assertEqual(archive.stat().st_mode & 0o777, 0o600)
        self.assertNotIn('private-test-password', result.stdout + result.stderr)

    def test_wrong_key_and_corruption_are_rejected(self):
        self.assertEqual(self.run_backup().returncode, 0)
        archive, = (self.root / 'output').glob('*/database.dump.age')
        other = self.root / 'other.key'
        subprocess.run(['age-keygen', '-o', str(other)], check=True, capture_output=True)
        self.assertNotEqual(subprocess.run(['age', '-d', '-i', str(other), str(archive)],
                           capture_output=True).returncode, 0)
        b = bytearray(archive.read_bytes())
        b[-1] ^= 1
        archive.write_bytes(b)
        self.assertNotEqual(subprocess.run(['age', '-d', '-i', str(self.key), str(archive)],
                           capture_output=True).returncode, 0)

    def test_failures_publish_nothing_and_cleanup_plaintext(self):
        for changes in ({'FAIL_DUMP': '1'}, {'FAIL_VALIDATE': '1'},
                        {'BACKUP_AGE_RECIPIENT': 'invalid-recipient'}):
            with self.subTest(changes=changes):
                result = self.run_backup(**changes)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(list((self.root / 'output').iterdir()), [])
                self.assertEqual(list(self.root.glob('tmp.*/database.dump')), [])
                self.assertNotIn('private-test-password', result.stdout + result.stderr)

    def test_configuration_guards(self):
        for changes in ({'BACKUP_DATABASE_URL': ''},
                        {'BACKUP_DATABASE_URL': 'postgresql://db-pooler.example/db?sslmode=require'},
                        {'BACKUP_DATABASE_URL': 'postgresql://db.example/db'},
                        {'BACKUP_DATABASE_URL': 'postgresql://db.example/db?sslmode=require&host=override'},
                        {'BACKUP_OUTPUT_DIR': str(self.root / 'public_html' / 'backups')}):
            with self.subTest(changes=changes):
                self.assertNotEqual(self.run_backup(**changes).returncode, 0)


if __name__ == '__main__':
    if not shutil.which('age') or not shutil.which('age-keygen'):
        raise SystemExit('Install age and age-keygen before running backup tests.')
    unittest.main()
