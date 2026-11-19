/**
 * dashboard.routes.js
 * -------------------
 * Everything the Dashboard page shows, in ONE request:
 *
 *   GET /api/dashboard        DASHBOARD_VIEW
 *   GET /api/dashboard/search?q=   global search box (users, branches, vehicles)
 *
 * Growth % on the stat cards = items created in the last 30 days
 * compared with the total 30 days ago.
 */
const express = require('express');
const db = require('../../config/db');
const { authenticate, requirePermission } = require('../../middleware/auth');
const subscriptions = require('../subscriptions/subscriptions.service');

const router = express.Router();
router.use(authenticate, requirePermission('DASHBOARD_VIEW'));

/** % growth: new items in last 30 days vs. how many existed before that. */
const growthSql = (table, extraWhere = 'TRUE') => `
  SELECT COUNT(*)::int AS total,
         ROUND(100.0 * COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')
               / NULLIF(COUNT(*) FILTER (WHERE created_at <  NOW() - INTERVAL '30 days'), 0), 1) AS growth
    FROM ${table} WHERE ${extraWhere}`;

router.get('/', async (req, res) => {
  const [users, branches, fleet, subs, performance, distribution, activities, plans, renewals] = await Promise.all([
    db.query(growthSql('users')),
    db.query(growthSql('branches')),
    db.query(growthSql('vehicles', 'is_active = TRUE')),
    db.query(growthSql('subscriptions', "status = 'ACTIVE' AND end_date >= CURRENT_DATE")),

    // Fleet performance: trips per month for the last 6 months + % delivered on time
    db.query(`
      SELECT TO_CHAR(m.month, 'Mon') AS month,
             COUNT(t.id)::int AS total_trips,
             COALESCE(ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.delivered_on_time) / NULLIF(COUNT(t.id), 0)), 0)::int AS on_time_percent,
             COUNT(t.id) FILTER (WHERE t.delivered_on_time)::int AS on_time_trips
        FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '5 months',
                             date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS m(month)
        LEFT JOIN trips t ON date_trunc('month', t.trip_date) = m.month
       GROUP BY m.month ORDER BY m.month`),

    // Branch distribution: share of users per city (top 3 + Others)
    db.query(`
      SELECT b.city, COUNT(u.id)::int AS users,
             AVG(b.latitude)::float AS latitude, AVG(b.longitude)::float AS longitude
        FROM branches b LEFT JOIN users u ON u.branch_id = b.id
       GROUP BY b.city ORDER BY users DESC`),

    db.query(`
      SELECT a.id, a.action, a.entity_type, a.description, a.user_email, u.full_name AS user_name, a.created_at
        FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.action NOT IN ('LOGIN', 'LOGOUT', 'LOGIN_FAILED')
       ORDER BY a.created_at DESC LIMIT 5`),

    subscriptions.listPlans(),
    subscriptions.upcomingRenewals(30),
  ]);

  // Top 3 cities by users, everything else grouped as "Others"
  const cities = distribution.rows;
  const totalUsers = cities.reduce((sum, c) => sum + c.users, 0) || 1;
  const top = cities.slice(0, 3).map((c) => ({ ...c, percent: Math.round((100 * c.users) / totalUsers) }));
  const othersUsers = cities.slice(3).reduce((sum, c) => sum + c.users, 0);
  const branchDistribution = [...top, { city: 'Others', users: othersUsers, percent: 100 - top.reduce((s, c) => s + c.percent, 0) }];

  const card = (r) => ({ total: r.rows[0].total, growth: Number(r.rows[0].growth) || 0 });

  res.json({
    stats: {
      users: card(users),
      branches: card(branches),
      activeFleet: card(fleet),
      subscriptions: card(subs),
    },
    fleetPerformance: performance.rows,
    branchDistribution,
    branchPins: cities.filter((c) => c.latitude != null), // for the map
    recentActivities: activities.rows,
    plans: plans.filter((p) => p.is_active),
    upcomingRenewals: renewals.slice(0, 5),
  });
});

router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ users: [], branches: [], vehicles: [] });
  const like = `%${q}%`;
  const perms = req.user.permissions;

  // Only search what this user is allowed to see.
  const [users, branches, vehicles] = await Promise.all([
    perms.includes('USER_VIEW')
      ? db.query('SELECT id, full_name, email FROM users WHERE full_name ILIKE $1 OR email ILIKE $1 ORDER BY full_name LIMIT 5', [like])
      : { rows: [] },
    perms.includes('BRANCH_VIEW')
      ? db.query('SELECT id, name, code, city FROM branches WHERE name ILIKE $1 OR code ILIKE $1 OR city ILIKE $1 ORDER BY name LIMIT 5', [like])
      : { rows: [] },
    db.query('SELECT id, reg_number, model FROM vehicles WHERE reg_number ILIKE $1 OR model ILIKE $1 ORDER BY reg_number LIMIT 5', [like]),
  ]);
  res.json({ users: users.rows, branches: branches.rows, vehicles: vehicles.rows });
});

module.exports = router;
