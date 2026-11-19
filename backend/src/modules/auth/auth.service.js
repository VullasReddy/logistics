/**
 * auth.service.js  (Module 1 - Admin Login and Authentication)
 * ---------------
 * Business logic for login, logout and password management.
 * Routes (auth.routes.js) only handle HTTP; the real work happens here.
 *
 * Security features:
 *   - Passwords stored as bcrypt hashes (never plain text)
 *   - Account locked for 15 min after 5 wrong passwords (Redis counter)
 *   - Every token has a unique id (jti) so it can be blacklisted on logout
 *   - Same error message for "wrong email" and "wrong password", so an
 *     attacker cannot find out which emails exist
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const cache = require('../../config/redis');
const config = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { getRolePermissions } = require('../../middleware/auth');

const BCRYPT_ROUNDS = 10;

/** Create a signed JWT for a user. */
function createToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role_id, jti: crypto.randomUUID() }, // jti = unique token id
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

/** The user object we send to the frontend (no password hash!). */
async function publicUser(userId) {
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role_id, r.name AS role_name,
            u.branch_id, b.name AS branch_name, u.must_change_password, u.last_login_at
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN branches b ON b.id = u.branch_id
      WHERE u.id = $1`,
    [userId],
  );
  const user = rows[0];
  user.permissions = await getRolePermissions(user.role_id);
  return user;
}

/**
 * Check email + password. Returns { token, user } or throws.
 * `onFail` is called so the route can write a LOGIN_FAILED audit log.
 */
async function login(email, password, onFail) {
  const lockKey = `login-fail:${email}`;
  const { maxLoginAttempts, lockMinutes } = config.security;

  // 1. Is this email temporarily locked?
  const failures = Number(await cache.get(lockKey)) || 0;
  if (failures >= maxLoginAttempts) {
    throw ApiError.tooMany(`Too many failed attempts. Try again after ${lockMinutes} minutes.`);
  }

  // 2. Find the user and compare the password with the stored hash.
  const { rows } = await db.query(
    'SELECT id, email, password_hash, is_active, role_id FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  const passwordOk = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!user || !passwordOk) {
    await cache.incr(lockKey, lockMinutes * 60);
    await onFail(user);
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.is_active) {
    throw ApiError.forbidden('Your account is deactivated. Contact your administrator.');
  }

  // 3. Success: clear the failure counter, remember the login time, issue a token.
  await cache.del(lockKey);
  await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  return { token: createToken(user), user: await publicUser(user.id) };
}

/**
 * Logout = put the token id on a blacklist until the token would have
 * expired anyway. After that the token is useless, so Redis can forget it.
 */
async function logout(token) {
  const secondsLeft = Math.max(1, token.exp - Math.floor(Date.now() / 1000));
  await cache.set(`bl:${token.jti}`, '1', secondsLeft);
}

/** Logged-in user changes their own password. */
async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect');
  if (currentPassword === newPassword) throw ApiError.badRequest('New password must be different from the current one');

  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.query(
    'UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2',
    [hash, userId],
  );
}

/** Generate a readable temporary password, e.g. "Tmp#4821kQ". Used by admin reset. */
function generateTempPassword() {
  const digits = crypto.randomInt(1000, 9999);
  const letters = crypto.randomBytes(2).toString('hex').slice(0, 2);
  return `Tmp#${digits}${letters}Q`;
}

module.exports = {
  login, logout, changePassword, publicUser, generateTempPassword, BCRYPT_ROUNDS,
};
