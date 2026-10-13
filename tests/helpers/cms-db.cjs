const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
async function createDatabase({ phase = 1 } = {}) {
  const db = new PGlite();
  try {
    for (const file of fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
      if (phase === 1 && file.slice(0, 12) > '202610120003') continue;
      await db.exec(fs.readFileSync(`supabase/migrations/${file}`, 'utf8'));
    }
    return db;
  } catch (error) { await db.close(); throw error; }
}
async function asRole(db, role, action) {
  if (!['portfolio_cms_seed', 'portfolio_cms_runtime', 'portfolio_cms_owner', 'cms_test_anon'].includes(role)) throw new Error('Unexpected test role');
  await db.exec(`SET ROLE ${role}`);
  try { return await action(); } finally { await db.exec('RESET ROLE'); }
}
module.exports = { createDatabase, asRole };
