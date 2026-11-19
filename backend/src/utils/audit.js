/**
 * audit.js  (Module 8 helper)
 * --------
 * One function every module calls to write an audit log row.
 *
 *   await audit.log(req, {
 *     action: 'CREATE', entityType: 'BRANCH', entityId: branch.id,
 *     description: `Created branch ${branch.name}`,
 *   });
 *
 * `req` gives us WHO did it (req.user), and from WHERE (IP, browser).
 * Logging must never break the real request, so errors are only printed.
 */
const db = require('../config/db');

async function log(req, { action, entityType = null, entityId = null, description, details = null, user = null }) {
  // `user` lets the login route log before req.user exists.
  const actor = user || req.user || {};
  try {
    await db.query(
      `INSERT INTO audit_logs
         (user_id, user_email, action, entity_type, entity_id, description, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        actor.id || null,
        actor.email || null,
        action,
        entityType,
        entityId != null ? String(entityId) : null,
        description,
        details ? JSON.stringify(details) : null,
        req.ip || null,
        (req.get && req.get('user-agent') ? req.get('user-agent').slice(0, 255) : null),
      ],
    );
  } catch (err) {
    console.error('[audit] could not write log:', err.message);
  }
}

/**
 * Compare an old row and the new values, return only fields that changed.
 * Used so the log says exactly what was edited:
 *   { city: { from: 'Hyderabad', to: 'Secunderabad' } }
 */
function diff(before, after) {
  const changes = {};
  for (const key of Object.keys(after)) {
    if (key === 'password' || key === 'password_hash') continue; // never log passwords
    const oldVal = before ? before[key] : undefined;
    if (JSON.stringify(oldVal) !== JSON.stringify(after[key])) {
      changes[key] = { from: oldVal ?? null, to: after[key] ?? null };
    }
  }
  return changes;
}

module.exports = { log, diff };
