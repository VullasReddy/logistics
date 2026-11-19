/**
 * auth.js  (Module 1 + Module 3 middleware)
 * -------
 * Two middlewares that protect routes:
 *
 *   authenticate          -> "Are you logged in?"   (checks the JWT)
 *   requirePermission(p)  -> "Are you allowed?"     (checks the role's permissions)
 *
 * Example:
 *   router.post('/', authenticate, requirePermission('USER_CREATE'), handler)
 */
const jwt = require('jsonwebtoken');
const config = require('../config/env');
const db = require('../config/db');
const cache = require('../config/redis');
const ApiError = require('../utils/ApiError');

const PERM_CACHE_SECONDS = 300; // permissions are cached for 5 minutes

/**
 * Load the permission codes of a role.
 * Cached in Redis so we don't hit the database on every request.
 * The roles module clears this cache whenever a role is changed.
 */
async function getRolePermissions(roleId) {
  const key = `perms:role:${roleId}`;
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);

  const { rows } = await db.query(
    `SELECT p.code FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1`,
    [roleId],
  );
  const codes = rows.map((r) => r.code);
  await cache.set(key, JSON.stringify(codes), PERM_CACHE_SECONDS);
  return codes;
}

/** Check the "Authorization: Bearer <token>" header. */
async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret); // throws if expired or tampered
  } catch {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  // Was this token logged out? (blacklist is written by POST /auth/logout)
  if (await cache.get(`bl:${payload.jti}`)) {
    throw ApiError.unauthorized('Session ended, please log in again');
  }

  // Re-read the user so a deactivated user is blocked immediately,
  // even if their token has not expired yet.
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.role_id, u.branch_id, u.is_active,
            u.must_change_password, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [payload.sub],
  );
  const user = rows[0];
  if (!user || !user.is_active) throw ApiError.unauthorized('Account is inactive');

  user.permissions = await getRolePermissions(user.role_id);
  req.user = user;
  req.token = { jti: payload.jti, exp: payload.exp };
  next();
}

/**
 * Allow the request only if the user's role has AT LEAST ONE of the
 * given permission codes.
 */
function requirePermission(...codes) {
  return (req, res, next) => {
    const has = req.user && codes.some((c) => req.user.permissions.includes(c));
    if (!has) throw ApiError.forbidden();
    next();
  };
}

module.exports = { authenticate, requirePermission, getRolePermissions };
