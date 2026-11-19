/**
 * server.js
 * ---------
 * Entry point: `npm start` (or `npm run dev` for auto-restart).
 * Applies pending DB migrations, makes sure core data exists, then
 * starts the HTTP server.
 */
const app = require('./app');
const config = require('./config/env');
const migrate = require('../db/migrate');
const seed = require('../db/seed');

async function start() {
  await migrate();
  // Core data only (roles, admin, settings). Demo data: `npm run db:seed`.
  await seed({ demo: process.env.SEED_DEMO === 'true' });

  app.listen(config.port, () => {
    console.log(`TTC Fleet360 API running on http://localhost:${config.port}  (env: ${config.env})`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
