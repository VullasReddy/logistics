/**
 * roles.service.js  (Module 3 - Role-Based Access Control)
 * ----------------
 * A role = name + list of permission codes.
 * Users get permissions ONLY through their role.
 *
 * Rules:
 *   - System roles (Super Admin) cannot be edited or deleted.
 *   - A role that still has users cannot be deleted.
 *   - After any change, the role's permission cache is cleared so the
 *     new permissions apply on the very next request.
 */
const db = require('../../config/db');
const cache = require('../../config/redis');
const ApiError = require('../../utils/ApiError');

/** All permissions, for the checkbox grid in the UI. */
async function listPermissions() {
  const { rows } = await db.query('SELECT id, code, module, description FROM permissions ORDER BY module, id');
  return rows;
}

async function list() {
  const { rows } = await db.query(
    `SELECT r.id, r.name, r.description, r.is_system, r.created_at, r.updated_at,
            (SELECT COUNT(*)::int FROM users u WHERE u.role_id = r.id) AS user_count,
            COALESCE(ARRAY_AGG(p.code ORDER BY p.id) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id
      GROUP BY r.id
      ORDER BY r.is_system DESC, r.name`,
  );
  return rows;
}

async function getById(id) {
  const roles = await list();
  const role = roles.find((r) => r.id === Number(id));
  if (!role) throw ApiError.notFound('Role not found');
  return role;
}

/** Replace the role's permissions with the given list of codes. */
async function savePermissions(client, roleId, codes) {
  const { rows } = await client.query('SELECT id FROM permissions WHERE code = ANY($1)', [codes]);
  if (rows.length !== codes.length) throw ApiError.badRequest('One or more permission codes are invalid');

  await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
  await client.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT $1, UNNEST($2::int[])`,
    [roleId, rows.map((r) => r.id)],
  );
}

async function create({ name, description, permissions }) {
  const id = await db.transaction(async (client) => {
    const { rows } = await client.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
      [name, description || null],
    );
    await savePermissions(client, rows[0].id, permissions);
    return rows[0].id;
  });
  return getById(id);
}

async function update(id, { name, description, permissions }) {
  const before = await getById(id);
  if (before.is_system) throw ApiError.badRequest('System roles cannot be changed');

  await db.transaction(async (client) => {
    await client.query(
      `UPDATE roles SET name = COALESCE($1, name), description = COALESCE($2, description),
              updated_at = NOW() WHERE id = $3`,
      [name ?? null, description ?? null, id],
    );
    if (permissions) await savePermissions(client, id, permissions);
  });
  await cache.del(`perms:role:${id}`); // new permissions apply immediately
  return { before, after: await getById(id) };
}

async function remove(id) {
  const role = await getById(id);
  if (role.is_system) throw ApiError.badRequest('System roles cannot be deleted');
  if (role.user_count > 0) {
    throw ApiError.conflict(`This role is assigned to ${role.user_count} user(s). Move them to another role first.`);
  }
  await db.query('DELETE FROM roles WHERE id = $1', [id]);
  await cache.del(`perms:role:${id}`);
  return role;
}

module.exports = { listPermissions, list, getById, create, update, remove };
