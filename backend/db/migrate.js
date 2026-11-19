/**
 * migrate.js
 * ----------
 * Runs every .sql file in db/migrations in name order (001_, 002_, ...).
 * Each file runs only once: applied files are remembered in the
 * `schema_migrations` table.
 *
 *   npm run db:migrate            -> apply new migrations
 *   node db/migrate.js --reset    -> DROP everything, then apply all (dev only!)
 */
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function migrate({ reset = false } = {}) {
  if (reset) {
    console.log('Resetting database (dropping all tables)...');
    await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }

  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(200) PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await db.query('SELECT filename FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
    });
    console.log(`Applied ${file}`);
  }
  console.log('Migrations up to date.');
}

module.exports = migrate;

// Run directly from the command line
if (require.main === module) {
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => db.pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}
