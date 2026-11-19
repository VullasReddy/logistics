/**
 * users.service.js  (Module 2 - User Creation and Management)
 * ----------------
 * Database work for users. All SQL for users lives here.
 */
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { buildUpdate, pagination, paged } = require('../../utils/sql');
const { generateTempPassword, BCRYPT_ROUNDS } = require('../auth/auth.service');

// Columns we return for a user. Never select password_hash here.
const USER_COLUMNS = `
  u.id, u.full_name, u.email, u.phone, u.is_active, u.must_change_password,
  u.last_login_at, u.created_at, u.updated_at,
  u.role_id, r.name AS role_name, u.branch_id, b.name AS branch_name`;

const FROM_USERS = `
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN branches b ON b.id = u.branch_id`;

/**
 * List users with search + filters + pagination.
 * Filters: search (name/email/phone), role_id, branch_id, status (active|inactive)
 */
async function list(query) {
  const where = [];  // list of SQL conditions, joined with AND
  const values = []; // values for $1, $2, ... in the same order

  if (query.search) {
    values.push(`%${query.search}%`);
    const p = `$${values.length}`; // the same value is used for all three columns
    where.push(`(u.full_name ILIKE ${p} OR u.email ILIKE ${p} OR u.phone ILIKE ${p})`);
  }
  if (query.role_id) {
    values.push(Number(query.role_id));
    where.push(`u.role_id = $${values.length}`);
  }
  if (query.branch_id) {
    values.push(Number(query.branch_id));
    where.push(`u.branch_id = $${values.length}`);
  }
  if (query.status === 'active') where.push('u.is_active = TRUE');
  if (query.status === 'inactive') where.push('u.is_active = FALSE');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const page = pagination(query);

  const totalResult = await db.query(`SELECT COUNT(*)::int AS total ${FROM_USERS} ${whereSql}`, values);
  const { rows } = await db.query(
    `SELECT ${USER_COLUMNS} ${FROM_USERS} ${whereSql}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, page.limit, page.offset],
  );
  return paged(rows, totalResult.rows[0].total, page);
}

async function getById(id) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} ${FROM_USERS} WHERE u.id = $1`, [id]);
  if (!rows[0]) throw ApiError.notFound('User not found');
  return rows[0];
}

/**
 * Create a user. If no password is given, a temporary one is generated,
 * returned ONCE to the admin, and the user must change it at first login.
 */
async function create(data) {
  const tempPassword = data.password ? null : generateTempPassword();
  const hash = await bcrypt.hash(data.password || tempPassword, BCRYPT_ROUNDS);

  const { rows } = await db.query(
    `INSERT INTO users (full_name, email, phone, password_hash, role_id, branch_id, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [data.full_name, data.email, data.phone || null, hash, data.role_id, data.branch_id || null, !data.password],
  );
  const user = await getById(rows[0].id);
  return { user, tempPassword };
}

async function update(id, data) {
  const before = await getById(id);
  const { setClause, values } = buildUpdate(data, ['full_name', 'email', 'phone', 'role_id', 'branch_id']);
  if (!setClause) return { before, after: before };

  values.push(id);
  await db.query(`UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`, values);
  return { before, after: await getById(id) };
}

async function setStatus(id, isActive, currentUserId) {
  if (Number(id) === currentUserId && !isActive) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }
  await getById(id); // 404 if missing
  await db.query('UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2', [isActive, id]);
  return getById(id);
}

/** Admin resets someone's password -> returns a new temporary password. */
async function resetPassword(id) {
  const user = await getById(id);
  const tempPassword = generateTempPassword();
  const hash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
  await db.query(
    'UPDATE users SET password_hash = $1, must_change_password = TRUE, updated_at = NOW() WHERE id = $2',
    [hash, id],
  );
  return { user, tempPassword };
}

/** Throw a clear 400 if a role or branch id does not exist. */
async function checkReferences({ role_id: roleId, branch_id: branchId }) {
  if (roleId) {
    const { rowCount } = await db.query('SELECT 1 FROM roles WHERE id = $1', [roleId]);
    if (!rowCount) throw ApiError.badRequest('Selected role does not exist');
  }
  if (branchId) {
    const { rowCount } = await db.query('SELECT 1 FROM branches WHERE id = $1', [branchId]);
    if (!rowCount) throw ApiError.badRequest('Selected branch does not exist');
  }
}

module.exports = { list, getById, create, update, setStatus, resetPassword, checkReferences };
