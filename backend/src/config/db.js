/**
 * db.js
 * -----
 * One shared PostgreSQL connection pool for the whole app.
 *
 * Usage in a service file:
 *   const db = require('../../config/db');
 *   const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
 *
 * ALWAYS use $1, $2 ... placeholders for values. Never build SQL by
 * joining strings with user input - that causes SQL injection.
 */
const { Pool, types } = require('pg');
const config = require('./env');

// By default `pg` returns NUMERIC columns as strings (to avoid precision loss).
// Our prices are small, so we convert them to JavaScript numbers.
types.setTypeParser(1700, (value) => parseFloat(value)); // 1700 = NUMERIC
// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting).
types.setTypeParser(1082, (value) => value); // 1082 = DATE

// DB_POOL_MAX=1 is used by the local runner (PGlite handles one session at a time).
const pool = new Pool({ connectionString: config.databaseUrl, max: Number(process.env.DB_POOL_MAX) || 10 });

/** Run a single query. */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run several queries inside ONE transaction.
 * If anything throws, every change is rolled back.
 *
 *   await db.transaction(async (client) => {
 *     await client.query('INSERT ...');
 *     await client.query('UPDATE ...');
 *   });
 */
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // give the connection back to the pool
  }
}

module.exports = { query, transaction, pool };
