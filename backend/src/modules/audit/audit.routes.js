/**
 * audit.routes.js  (Module 8 - Audit Logs and User Activity Monitoring)
 * ---------------
 * Logs are WRITTEN by every module through utils/audit.js.
 * This file only READS them. There is no update or delete on purpose:
 * an audit log you can edit is not an audit log.
 *
 *   GET /api/audit-logs          AUDIT_VIEW  list with filters (see below)
 *   GET /api/audit-logs/report   AUDIT_VIEW  date-wise counts per action (?from=&to=)
 *   GET /api/audit-logs/export   AUDIT_VIEW  same filters as list, as a CSV file
 *
 * Filters: search, action (one or comma list e.g. LOGIN,LOGOUT),
 *          user_id, entity_type, from (YYYY-MM-DD), to (YYYY-MM-DD), page, limit
 */
const express = require('express');
const db = require('../../config/db');
const { authenticate, requirePermission } = require('../../middleware/auth');
const { pagination, paged } = require('../../utils/sql');

const router = express.Router();
router.use(authenticate, requirePermission('AUDIT_VIEW'));

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');

/** Build the WHERE part shared by list and export. */
function buildFilters(q) {
  const where = [];
  const values = [];
  if (q.search) {
    values.push(`%${q.search}%`);
    where.push(`(a.description ILIKE $${values.length} OR a.user_email ILIKE $${values.length})`);
  }
  if (q.action) {
    values.push(String(q.action).toUpperCase().split(','));
    where.push(`a.action = ANY($${values.length})`);
  }
  if (q.user_id) {
    values.push(Number(q.user_id));
    where.push(`a.user_id = $${values.length}`);
  }
  if (q.entity_type) {
    values.push(String(q.entity_type).toUpperCase());
    where.push(`a.entity_type = $${values.length}`);
  }
  // Dates are compared in Indian time, so "today" means today in India.
  if (isDate(q.from)) {
    values.push(q.from);
    where.push(`(a.created_at AT TIME ZONE 'Asia/Kolkata')::date >= $${values.length}::date`);
  }
  if (isDate(q.to)) {
    values.push(q.to);
    where.push(`(a.created_at AT TIME ZONE 'Asia/Kolkata')::date <= $${values.length}::date`);
  }
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

const SELECT = `SELECT a.id, a.user_id, a.user_email, u.full_name AS user_name, a.action, a.entity_type,
                       a.entity_id, a.description, a.details, a.ip_address, a.user_agent, a.created_at
                  FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id`;

router.get('/', async (req, res) => {
  const { whereSql, values } = buildFilters(req.query);
  const page = pagination(req.query);
  const total = (await db.query(`SELECT COUNT(*)::int AS total FROM audit_logs a ${whereSql}`, values)).rows[0].total;
  const { rows } = await db.query(
    `${SELECT} ${whereSql} ORDER BY a.created_at DESC, a.id DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, page.limit, page.offset],
  );
  res.json(paged(rows, total, page));
});

router.get('/report', async (req, res) => {
  // Default: last 7 days
  const to = isDate(req.query.to) ? req.query.to : new Date().toISOString().slice(0, 10);
  const from = isDate(req.query.from) ? req.query.from
    : new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const { rows } = await db.query(
    `SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date::text AS day, action, COUNT(*)::int AS count
       FROM audit_logs
      WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $1::date AND $2::date
      GROUP BY 1, 2 ORDER BY 1`,
    [from, to],
  );

  // Turn rows into one object per day: { day: '2026-11-19', LOGIN: 4, UPDATE: 2, total: 6 }
  const days = {};
  for (const r of rows) {
    days[r.day] ||= { day: r.day, total: 0 };
    days[r.day][r.action] = r.count;
    days[r.day].total += r.count;
  }
  res.json({ from, to, days: Object.values(days) });
});

router.get('/export', async (req, res) => {
  const { whereSql, values } = buildFilters(req.query);
  const { rows } = await db.query(`${SELECT} ${whereSql} ORDER BY a.created_at DESC LIMIT 10000`, values);

  // CSV: wrap every value in quotes and double any quotes inside it.
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = ['Date & Time', 'User', 'Email', 'Action', 'Entity', 'Entity ID', 'Description', 'IP Address'];
  const lines = rows.map((r) => [
    new Date(r.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    r.user_name, r.user_email, r.action, r.entity_type, r.entity_id, r.description, r.ip_address,
  ].map(cell).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
  res.send([header.map(cell).join(','), ...lines].join('\n'));
});

module.exports = router;
