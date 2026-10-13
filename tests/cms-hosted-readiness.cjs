const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('all eight migrations work without superuser or database ownership', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  const name = (await db.query('SELECT current_database() AS name')).rows[0].name;
  await db.exec(`CREATE ROLE readiness_admin LOGIN CREATEROLE NOSUPERUSER NOCREATEDB NOBYPASSRLS;
    GRANT CREATE ON DATABASE "${name.replaceAll('"', '""')}" TO readiness_admin;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; SET ROLE readiness_admin;`);
  const preflight = await db.exec(fs.readFileSync('supabase/verification/hosted-preflight.sql', 'utf8'));
  for (const [check, passed] of Object.entries(preflight[0].rows[0])) assert.equal(passed, true, `preflight: ${check}`);
  for (const file of fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  await db.exec(fs.readFileSync('supabase/preview-migrations/202610120008_preview_auth.sql', 'utf8'));
  await db.exec(fs.readFileSync('supabase/configuration/preview-logins.sql', 'utf8'));
  await db.exec('RESET ROLE; SET ROLE portfolio_cms_preview_app;');
  for (const file of ['preview-runtime.sql', 'preview-auth.sql']) {
    const result = (await db.query(fs.readFileSync(`supabase/verification/${file}`, 'utf8'))).rows[0].result;
    for (const [check, passed] of Object.entries(result)) assert.equal(passed, true, `${file}: ${check}`);
  }
  await assert.rejects(db.query('SELECT * FROM preview_auth.sessions'), e => e.code === '42501');
  await assert.rejects(db.query('SELECT * FROM cms.portfolio_revisions'), e => e.code === '42501');
});
