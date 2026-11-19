/**
 * subscriptions.service.js  (Module 6 - Subscription Management)
 * ------------------------
 * Plans (Basic / Premium / Enterprise) and customer subscriptions.
 *
 * Status of a subscription is CALCULATED, not stored, so it is always
 * correct without a nightly job:
 *   CANCELLED -> cancelled by admin
 *   EXPIRED   -> end_date is in the past
 *   EXPIRING  -> ends within the "renewal reminder" days (setting, default 7)
 *   ACTIVE    -> everything else
 */
const db = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const { buildUpdate, pagination, paged } = require('../../utils/sql');

/* -------------------------------- Plans -------------------------------- */

async function listPlans() {
  const { rows } = await db.query(
    `SELECT p.*,
            COUNT(s.id) FILTER (WHERE s.status = 'ACTIVE' AND s.end_date >= CURRENT_DATE)::int AS active_subscriptions,
            COALESCE(SUM(s.active_users) FILTER (WHERE s.status = 'ACTIVE' AND s.end_date >= CURRENT_DATE), 0)::int AS active_users
       FROM subscription_plans p
       LEFT JOIN subscriptions s ON s.plan_id = p.id
      GROUP BY p.id
      ORDER BY p.price_monthly`,
  );
  return rows;
}

async function getPlan(id) {
  const { rows } = await db.query('SELECT * FROM subscription_plans WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Plan not found');
  return rows[0];
}

async function createPlan(data) {
  const { rows } = await db.query(
    `INSERT INTO subscription_plans (name, description, price_monthly, duration_days, max_users, max_vehicles, features, is_popular, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [data.name, data.description || null, data.price_monthly, data.duration_days ?? 30, data.max_users ?? 10,
      data.max_vehicles ?? 10, JSON.stringify(data.features || []), data.is_popular ?? false, data.is_active ?? true],
  );
  return rows[0];
}

async function updatePlan(id, data) {
  const before = await getPlan(id);
  const input = { ...data };
  if (input.features) input.features = JSON.stringify(input.features); // JSONB column
  const { setClause, values } = buildUpdate(input,
    ['name', 'description', 'price_monthly', 'duration_days', 'max_users', 'max_vehicles', 'features', 'is_popular', 'is_active']);
  if (setClause) {
    values.push(id);
    await db.query(`UPDATE subscription_plans SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`, values);
  }
  return { before, after: await getPlan(id) };
}

/* ---------------------------- Subscriptions ---------------------------- */

/** Read the reminder window from settings (falls back to 7 days). */
async function reminderDays() {
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'notify.renewal_reminder_days'");
  return Number(rows[0]?.value) || 7;
}

// SQL that adds the calculated status and days_left to each row.
// $1 is always the reminder window in days.
const SUB_SELECT = `
  SELECT s.*, p.name AS plan_name, p.price_monthly,
         (s.end_date - CURRENT_DATE) AS days_left,
         CASE
           WHEN s.status = 'CANCELLED'                 THEN 'CANCELLED'
           WHEN s.end_date < CURRENT_DATE              THEN 'EXPIRED'
           WHEN s.end_date <= CURRENT_DATE + $1::int   THEN 'EXPIRING'
           ELSE 'ACTIVE'
         END AS computed_status
    FROM subscriptions s
    JOIN subscription_plans p ON p.id = s.plan_id`;

/** List with filters: search, plan_id, status (ACTIVE | EXPIRING | EXPIRED | CANCELLED). */
async function list(query) {
  const values = [await reminderDays()];
  const where = [];
  if (query.search) {
    values.push(`%${query.search}%`);
    where.push(`(x.customer_name ILIKE $${values.length} OR x.customer_email ILIKE $${values.length})`);
  }
  if (query.plan_id) {
    values.push(Number(query.plan_id));
    where.push(`x.plan_id = $${values.length}`);
  }
  if (query.status) {
    values.push(String(query.status).toUpperCase());
    where.push(`x.computed_status = $${values.length}`);
  }
  // Wrap SUB_SELECT as "x" so we can filter on the calculated status.
  const base = `FROM (${SUB_SELECT}) x ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
  const page = pagination(query);

  const total = (await db.query(`SELECT COUNT(*)::int AS total ${base}`, values)).rows[0].total;
  const { rows } = await db.query(
    `SELECT * ${base} ORDER BY x.end_date ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, page.limit, page.offset],
  );
  return paged(rows, total, page);
}

async function getById(id) {
  const { rows } = await db.query(`${SUB_SELECT} WHERE s.id = $2`, [await reminderDays(), id]);
  if (!rows[0]) throw ApiError.notFound('Subscription not found');
  const sub = rows[0];
  sub.renewals = (await db.query(
    `SELECT r.*, p.name AS plan_name, u.full_name AS renewed_by_name
       FROM subscription_renewals r
       JOIN subscription_plans p ON p.id = r.plan_id
       LEFT JOIN users u ON u.id = r.renewed_by
      WHERE r.subscription_id = $1 ORDER BY r.renewed_at DESC`,
    [id],
  )).rows;
  return sub;
}

/** Subscriptions ending in the next N days (for the dashboard + renewals page). */
async function upcomingRenewals(days = 30) {
  const { rows } = await db.query(
    `${SUB_SELECT}
      WHERE s.status = 'ACTIVE' AND s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $2::int
      ORDER BY s.end_date`,
    [await reminderDays(), days],
  );
  return rows;
}

async function create(data) {
  const plan = await getPlan(data.plan_id);
  // If no end date is given, the subscription lasts one plan period.
  const { rows } = await db.query(
    `INSERT INTO subscriptions (customer_name, customer_email, plan_id, active_users, start_date, end_date, auto_renew)
     VALUES ($1, $2, $3, $4, $5::date, COALESCE($6::date, $5::date + $7::int), $8) RETURNING id`,
    [data.customer_name, data.customer_email || null, plan.id, data.active_users ?? 0,
      data.start_date, data.end_date || null, plan.duration_days, data.auto_renew ?? false],
  );
  return getById(rows[0].id);
}

async function update(id, data) {
  const before = await getById(id);
  if (data.plan_id) await getPlan(data.plan_id);
  const { setClause, values } = buildUpdate(data,
    ['customer_name', 'customer_email', 'plan_id', 'active_users', 'start_date', 'end_date', 'auto_renew']);
  if (setClause) {
    values.push(id);
    await db.query(`UPDATE subscriptions SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}`, values);
  }
  return { before, after: await getById(id) };
}

/**
 * Renew for `periods` plan periods (default 1).
 * The new period starts from the old end date, or from today if it already expired,
 * so the customer never loses days and never gets free days.
 * Optionally switch plan (upgrade / downgrade) at renewal.
 */
async function renew(id, { plan_id: planId, periods = 1 }, userId) {
  const sub = await getById(id);
  if (sub.status === 'CANCELLED') throw ApiError.badRequest('Cancelled subscriptions cannot be renewed');
  const plan = await getPlan(planId || sub.plan_id);
  if (!plan.is_active) throw ApiError.badRequest('This plan is no longer active');

  const amount = plan.price_monthly * periods;
  await db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE subscriptions
          SET end_date = GREATEST(end_date, CURRENT_DATE) + $1::int,
              plan_id = $2, updated_at = NOW()
        WHERE id = $3
      RETURNING end_date`,
      [plan.duration_days * periods, plan.id, id],
    );
    await client.query(
      `INSERT INTO subscription_renewals (subscription_id, plan_id, previous_end, new_end, amount, renewed_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, plan.id, sub.end_date, rows[0].end_date, amount, userId],
    );
  });
  return getById(id);
}

async function cancel(id) {
  await getById(id);
  await db.query("UPDATE subscriptions SET status = 'CANCELLED', auto_renew = FALSE, updated_at = NOW() WHERE id = $1", [id]);
  return getById(id);
}

module.exports = {
  listPlans, getPlan, createPlan, updatePlan,
  list, getById, upcomingRenewals, create, update, renew, cancel,
};
