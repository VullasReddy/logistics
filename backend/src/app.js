/**
 * app.js
 * ------
 * Builds the Express application: security middleware, all module
 * routes, and the error handler. It does NOT start listening - that is
 * server.js - so tests can import the app without opening a port.
 *
 * Request flow:
 *   helmet/cors/json  ->  route  ->  authenticate  ->  requirePermission
 *   ->  validate  ->  handler  ->  (on error) errorHandler
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config/env');
const db = require('./config/db');
const cache = require('./config/redis');
const errorHandler = require('./middleware/errorHandler');
const { LOCAL_DIR } = require('./utils/storage');

const app = express();

app.set('trust proxy', 1); // behind nginx / AWS load balancer: read the real client IP
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } })); // secure HTTP headers
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
if (config.env !== 'test') app.use(morgan('dev')); // request log in the console

// Locally stored uploads (only used when S3 is not configured)
app.use('/uploads', express.static(LOCAL_DIR));

// Health check for Docker / AWS load balancer
app.get('/api/health', async (req, res) => {
  await db.query('SELECT 1');
  res.json({ status: 'ok', cache: cache.mode, time: new Date().toISOString() });
});

// ---- Module routes ----
app.use('/api/auth', require('./modules/auth/auth.routes'));                       // Module 1
app.use('/api/users', require('./modules/users/users.routes'));                    // Module 2
app.use('/api/roles', require('./modules/roles/roles.routes'));                    // Module 3
app.use('/api/branches', require('./modules/branches/branches.routes'));           // Module 4
app.use('/api/company', require('./modules/company/company.routes'));              // Module 5
app.use('/api/subscriptions', require('./modules/subscriptions/subscriptions.routes')); // Module 6
app.use('/api/settings', require('./modules/settings/settings.routes'));           // Module 7
app.use('/api/audit-logs', require('./modules/audit/audit.routes'));               // Module 8
app.use('/api/dashboard', require('./modules/dashboard/dashboard.routes'));

// Unknown /api route -> 404 JSON
app.use('/api', (req, res) => res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } }));

app.use(errorHandler); // must be last

module.exports = app;
