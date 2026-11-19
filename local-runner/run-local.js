/**
 * run-local.js
 * ------------
 * One command to run TTC Fleet360 on a laptop with ONLY Node.js installed.
 * (Used by START.bat on Windows and start.sh on Mac/Linux.)
 *
 * What it does:
 *   1. Starts PostgreSQL using PGlite (real PostgreSQL compiled to
 *      WebAssembly - no installer, no native files, works on any OS).
 *      Data is kept in local-runner/.pglite-data. It listens on port 5433 so it
 *      never clashes with a PostgreSQL you may already have on 5432.
 *   2. Starts the backend (port 5000). It creates the tables and, the first
 *      time, the demo data.
 *   3. Starts the frontend dev server (port 5173) and opens the browser.
 *
 * Redis is not needed: the backend uses its in-memory fallback.
 * Press Ctrl+C in this window to stop everything.
 *
 * NOTE: this is for development/demo on one machine. Production uses a real
 * PostgreSQL server (see docker-compose.yml).
 */
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(__dirname, '.pglite-data');
const isWindows = process.platform === 'win32';
const children = [];

function run(name, command, args, cwd, env = {}) {
  const child = spawn(command, args, {
    cwd, env: { ...process.env, ...env }, stdio: 'inherit', shell: isWindows,
  });
  child.on('exit', (code) => console.log(`[${name}] stopped (code ${code})`));
  children.push(child);
  return child;
}

function openBrowser(url) {
  const cmd = isWindows ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = isWindows ? ['/c', 'start', '', url] : [url];
  spawn(cmd, args, { stdio: 'ignore', detached: true }).on('error', () => {});
}

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  console.log('\n=== TTC Fleet360 - local start ===\n');

  // 1. Database (PGlite + a socket server so the normal "pg" driver can connect)
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  console.log('[db] Starting PostgreSQL (PGlite)...');
  const db = await PGlite.create(DATA_DIR);
  // Try 5433, 5434, ... until one is free (a leftover process may hold 5433).
  let server;
  let PG_PORT = 5433;
  for (; PG_PORT < 5460; PG_PORT++) {
    server = new PGLiteSocketServer({ db, port: PG_PORT, host: '127.0.0.1', maxConnections: 4 });
    try { await server.start(); break; } catch (err) {
      if (err.code !== 'EADDRINUSE') throw err;
      console.log(`[db] port ${PG_PORT} is busy, trying ${PG_PORT + 1}...`);
    }
  }
  const DB_URL = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`;
  console.log(`[db] PostgreSQL running on port ${PG_PORT}`);

  const stopAll = async () => {
    console.log('\nStopping...');
    children.forEach((c) => { try { c.kill(); } catch { /* ignore */ } });
    await server.stop().catch(() => {});
    await db.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stopAll);
  process.on('SIGTERM', stopAll);

  // 2. Backend (migrations + seed run automatically on start)
  run('backend', 'node', ['src/server.js'], path.join(ROOT, 'backend'), {
    DATABASE_URL: DB_URL,
    DB_POOL_MAX: '1',         // PGlite runs one session at a time
    REDIS_URL: '',
    PORT: '5000',
    NODE_ENV: 'development',
    SEED_DEMO: 'true',
    CORS_ORIGIN: 'http://localhost:5173',
  });
  if (!(await waitFor('http://localhost:5000/api/health', 120))) {
    console.error('\n[backend] did not start. Read the messages above.');
    return stopAll();
  }

  // 3. Frontend
  run('frontend', 'npx', ['vite', '--port', '5173', '--strictPort'], path.join(ROOT, 'frontend'));
  if (await waitFor('http://localhost:5173', 90)) {
    console.log('\n==============================================');
    console.log(' TTC Fleet360 is running:  http://localhost:5173');
    console.log(' Login: admin@ttcfleet360.com / Admin@123');
    console.log(' Keep this window open. Ctrl+C to stop.');
    console.log('==============================================\n');
    if (!process.env.NO_BROWSER) openBrowser('http://localhost:5173');
  }
}

main().catch((err) => {
  console.error('\nCould not start:', err?.stack || err?.message || err);
  process.exit(1);
});
