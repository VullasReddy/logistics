/**
 * branches.service.js  (Module 4 - Branch and Location Management)
 * -------------------
 * Branches (Hyderabad Central Hub, ...), their locations (warehouses,
 * hubs, offices) and which users work at which branch.
 */
const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { buildUpdate } = require('../../utils/sql');

const BRANCH_FIELDS = ['name', 'code', 'city', 'state', 'address', 'pincode', 'phone', 'email', 'latitude', 'longitude', 'status'];
const LOCATION_FIELDS = ['name', 'type', 'address', 'city', 'pincode', 'is_active'];

/* ------------------------------ Branches ------------------------------ */

async function list({ search, status } = {}) {
  const where = [];
  const values = [];
  if (search) {
    values.push(`%${search}%`);
    where.push(`(b.name ILIKE $${values.length} OR b.code ILIKE $${values.length} OR b.city ILIKE $${values.length})`);
  }
  if (status) {
    values.push(status.toUpperCase());
    where.push(`b.status = $${values.length}`);
  }
  const { rows } = await db.query(
    `SELECT b.*,
            (SELECT COUNT(*)::int FROM users u WHERE u.branch_id = b.id)     AS user_count,
            (SELECT COUNT(*)::int FROM locations l WHERE l.branch_id = b.id) AS location_count
       FROM branches b
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY b.city, b.name`,
    values,
  );
  return rows;
}

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM branches WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Branch not found');
  const branch = rows[0];
  branch.locations = (await db.query('SELECT * FROM locations WHERE branch_id = $1 ORDER BY name', [id])).rows;
  return branch;
}

async function create(data) {
  const { rows } = await db.query(
    `INSERT INTO branches (name, code, city, state, address, pincode, phone, email, latitude, longitude, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'ACTIVE')) RETURNING id`,
    [data.name, data.code, data.city, data.state, data.address || null, data.pincode || null,
      data.phone || null, data.email || null, data.latitude ?? null, data.longitude ?? null, data.status || null],
  );
  return getById(rows[0].id);
}

async function update(id, data) {
  const before = await getById(id);
  const { setClause, values } = buildUpdate(data, BRANCH_FIELDS);
  if (setClause) {
    values.push(id);
    await db.query(`UPDATE branches SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`, values);
  }
  return { before, after: await getById(id) };
}

/* -------------------------- Branch users -------------------------- */

async function listUsers(branchId) {
  await getById(branchId);
  const { rows } = await db.query(
    `SELECT u.id, u.full_name, u.email, u.is_active, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.branch_id = $1 ORDER BY u.full_name`,
    [branchId],
  );
  return rows;
}

/** Move the given users to this branch (branch-wise user allocation). */
async function allocateUsers(branchId, userIds) {
  const branch = await getById(branchId);
  const { rowCount } = await db.query(
    'UPDATE users SET branch_id = $1, updated_at = NOW() WHERE id = ANY($2::int[])',
    [branchId, userIds],
  );
  return { branch, moved: rowCount };
}

/* ------------------------------ Locations ------------------------------ */

async function getLocation(locationId) {
  const { rows } = await db.query('SELECT * FROM locations WHERE id = $1', [locationId]);
  if (!rows[0]) throw ApiError.notFound('Location not found');
  return rows[0];
}

async function addLocation(branchId, data) {
  await getById(branchId);
  const { rows } = await db.query(
    `INSERT INTO locations (branch_id, name, type, address, city, pincode)
     VALUES ($1, $2, COALESCE($3, 'WAREHOUSE'), $4, $5, $6) RETURNING *`,
    [branchId, data.name, data.type || null, data.address || null, data.city || null, data.pincode || null],
  );
  return rows[0];
}

async function updateLocation(locationId, data) {
  const before = await getLocation(locationId);
  const { setClause, values } = buildUpdate(data, LOCATION_FIELDS);
  if (setClause) {
    values.push(locationId);
    await db.query(`UPDATE locations SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`, values);
  }
  return { before, after: await getLocation(locationId) };
}

async function deleteLocation(locationId) {
  const location = await getLocation(locationId);
  await db.query('DELETE FROM locations WHERE id = $1', [locationId]);
  return location;
}

module.exports = {
  list, getById, create, update, listUsers, allocateUsers,
  addLocation, updateLocation, deleteLocation,
};
