/**
 * seed.js
 * -------
 * Fills the database with starting data.
 *
 *   Core data (always): permissions, the 4 default roles, the admin
 *                       user, company profile, plans, settings.
 *   Demo data (default, skip with --core-only): 12 branches, ~120 users,
 *                       subscriptions, vehicles, trips, sample activity -
 *                       so the dashboard looks like the design.
 *
 * Safe to run again: permissions are "upserted", everything else is
 * only inserted when the table is empty.
 *
 * Default logins created:
 *   admin@ttcfleet360.com   / Admin@123     (Super Admin)
 *   every demo user         / Welcome@123
 */
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const { PERMISSIONS, ALL_CODES } = require('../src/constants/permissions');

const ADMIN_EMAIL = 'admin@ttcfleet360.com';
const ADMIN_PASSWORD = 'Admin@123';
const DEMO_PASSWORD = 'Welcome@123';

// Which permissions each default role gets.
const DEFAULT_ROLES = [
  { name: 'Super Admin', description: 'Full access to everything', is_system: true, perms: ALL_CODES },
  {
    name: 'Branch Manager', description: 'Manages users and details of their branch', is_system: false,
    perms: ['DASHBOARD_VIEW', 'USER_VIEW', 'USER_CREATE', 'USER_UPDATE', 'USER_STATUS', 'BRANCH_VIEW', 'COMPANY_VIEW', 'SUBSCRIPTION_VIEW'],
  },
  {
    name: 'Operations Executive', description: 'Day-to-day operations, read-only on admin data', is_system: false,
    perms: ['DASHBOARD_VIEW', 'USER_VIEW', 'BRANCH_VIEW', 'COMPANY_VIEW'],
  },
  {
    name: 'Auditor', description: 'Can review audit logs and reports only', is_system: false,
    perms: ['DASHBOARD_VIEW', 'AUDIT_VIEW', 'USER_VIEW', 'BRANCH_VIEW'],
  },
];

const SETTINGS = [
  // key, value, category, label, type, options
  ['app.name', 'TTC Fleet360', 'APPLICATION', 'Application name', 'string'],
  ['app.timezone', 'Asia/Kolkata', 'APPLICATION', 'Time zone', 'select', ['Asia/Kolkata', 'Asia/Dubai', 'UTC']],
  ['app.date_format', 'DD/MM/YYYY', 'APPLICATION', 'Date format', 'select', ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']],
  ['app.currency', 'INR', 'APPLICATION', 'Currency', 'select', ['INR', 'USD']],
  ['notify.email_enabled', true, 'NOTIFICATION', 'Email notifications', 'boolean'],
  ['notify.sms_enabled', false, 'NOTIFICATION', 'SMS notifications', 'boolean'],
  ['notify.renewal_reminder_days', 7, 'NOTIFICATION', 'Remind before renewal (days)', 'number'],
  ['notify.admin_email', 'admin@ttcfleet360.com', 'NOTIFICATION', 'Admin alert email', 'string'],
  ['ops.working_hours_start', '09:00', 'OPERATIONAL', 'Working hours start', 'string'],
  ['ops.working_hours_end', '18:00', 'OPERATIONAL', 'Working hours end', 'string'],
  ['ops.max_trip_hours', 12, 'OPERATIONAL', 'Max driving hours per trip', 'number'],
  ['ops.auto_assign_vehicles', false, 'OPERATIONAL', 'Auto-assign vehicles to trips', 'boolean'],
  ['pref.theme', 'light', 'PREFERENCE', 'Theme', 'select', ['light', 'dark']],
  ['pref.language', 'English', 'PREFERENCE', 'Language', 'select', ['English', 'Telugu', 'Hindi']],
  ['pref.items_per_page', 10, 'PREFERENCE', 'Rows per page in tables', 'number'],
];

// 12 demo branches. `users` = how many demo users to create there.
const BRANCHES = [
  ['Hyderabad Central Hub', 'HYD01', 'Hyderabad', 'Telangana', 17.385, 78.4867, 16],
  ['Hyderabad Gachibowli', 'HYD02', 'Hyderabad', 'Telangana', 17.4401, 78.3489, 14],
  ['Hyderabad Uppal Depot', 'HYD03', 'Hyderabad', 'Telangana', 17.4058, 78.5591, 12],
  ['Bengaluru Whitefield', 'BLR01', 'Bengaluru', 'Karnataka', 12.9698, 77.75, 14],
  ['Bengaluru Peenya', 'BLR02', 'Bengaluru', 'Karnataka', 13.0285, 77.5197, 12],
  ['Bengaluru Hosur Road', 'BLR03', 'Bengaluru', 'Karnataka', 12.8917, 77.6387, 10],
  ['Chennai Guindy', 'CHE01', 'Chennai', 'Tamil Nadu', 13.0067, 80.2206, 13],
  ['Chennai Ambattur', 'CHE02', 'Chennai', 'Tamil Nadu', 13.1143, 80.1548, 11],
  ['Vijayawada Hub', 'VJA01', 'Vijayawada', 'Andhra Pradesh', 16.5062, 80.648, 6],
  ['Mumbai Bhiwandi', 'MUM01', 'Mumbai', 'Maharashtra', 19.2813, 73.0483, 5],
  ['Pune Chakan', 'PUN01', 'Pune', 'Maharashtra', 18.7606, 73.8636, 4],
  ['Delhi Okhla', 'DEL01', 'New Delhi', 'Delhi', 28.5355, 77.271, 2],
];

const FIRST = ['Rahul', 'Priya', 'Arjun', 'Sneha', 'Kiran', 'Divya', 'Ravi', 'Anjali', 'Suresh', 'Lakshmi',
  'Vikram', 'Meena', 'Aditya', 'Pooja', 'Naveen', 'Keerthi', 'Manoj', 'Swathi', 'Ganesh', 'Bhavana'];
const LAST = ['Kumar', 'Reddy', 'Sharma', 'Rao', 'Naidu', 'Iyer', 'Patel', 'Varma', 'Gupta', 'Nair'];

/** Date helper: 'YYYY-MM-DD' for today + n days. */
function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function isEmpty(table) {
  const { rows } = await db.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n === 0;
}

async function seedCore() {
  // 1. Permissions - insert new ones, update descriptions of existing ones.
  for (const p of PERMISSIONS) {
    await db.query(
      `INSERT INTO permissions (code, module, description) VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description`,
      [p.code, p.module, p.description],
    );
  }

  // 2. Roles + their permissions
  if (await isEmpty('roles')) {
    for (const role of DEFAULT_ROLES) {
      const { rows } = await db.query(
        'INSERT INTO roles (name, description, is_system) VALUES ($1, $2, $3) RETURNING id',
        [role.name, role.description, role.is_system],
      );
      await db.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, id FROM permissions WHERE code = ANY($2)`,
        [rows[0].id, role.perms],
      );
    }
  }
  // Super Admin must always have every permission (also new ones).
  await db.query(
    `INSERT INTO role_permissions (role_id, permission_id)
     SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Super Admin'
     ON CONFLICT DO NOTHING`,
  );

  // 3. Admin user
  if (await isEmpty('users')) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role_id)
       VALUES ('Admin', $1, '9000000000', $2, (SELECT id FROM roles WHERE name = 'Super Admin'))`,
      [ADMIN_EMAIL, hash],
    );
  }

  // 4. Company profile (single row)
  await db.query(
    `INSERT INTO company_profile (id, name, legal_name, tagline, email, phone, website, address, city, state, pincode, gstin, pan, cin, registration_date)
     VALUES (1, 'TTC Fleet360', 'TTC Logistics Private Limited', 'Logistics & Fleet Management',
             'contact@ttcfleet360.com', '040-40001234', 'https://ttcfleet360.com',
             'Plot 42, HITEC City', 'Hyderabad', 'Telangana', '500081',
             '36AABCT1234F1Z5', 'AABCT1234F', 'U63030TG2020PTC123456', '2020-06-15')
     ON CONFLICT (id) DO NOTHING`,
  );

  // 5. Subscription plans
  if (await isEmpty('subscription_plans')) {
    const plans = [
      ['Basic', 'For small fleets getting started', 999, 30, 10, 10, ['Up to 10 vehicles', 'Basic reports', 'Email support'], false],
      ['Premium', 'For growing logistics teams', 2499, 30, 50, 50, ['Up to 50 vehicles', 'Advanced reports', 'Priority support', 'Branch management'], true],
      ['Enterprise', 'For large multi-branch operations', 4999, 30, 500, 500, ['Unlimited branches', 'Custom reports', 'Dedicated manager', 'API access'], false],
    ];
    for (const p of plans) {
      await db.query(
        `INSERT INTO subscription_plans (name, description, price_monthly, duration_days, max_users, max_vehicles, features, is_popular)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [p[0], p[1], p[2], p[3], p[4], p[5], JSON.stringify(p[6]), p[7]],
      );
    }
  }

  // 6. Settings
  for (const [key, value, category, label, type, options] of SETTINGS) {
    await db.query(
      `INSERT INTO settings (key, value, category, label, value_type, options)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value), category, label, type, options ? JSON.stringify(options) : null],
    );
  }
}

async function seedDemo() {
  if (!(await isEmpty('branches'))) return; // demo data already there

  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const { rows: roles } = await db.query('SELECT id, name FROM roles');
  const roleId = (name) => roles.find((r) => r.name === name).id;

  // Branches, one location each, and their users
  let userNo = 0;
  for (const [name, code, city, state, lat, lng, userCount] of BRANCHES) {
    const status = code === 'DEL01' ? 'INACTIVE' : 'ACTIVE';
    const { rows } = await db.query(
      `INSERT INTO branches (name, code, city, state, address, pincode, phone, email, latitude, longitude, status)
       VALUES ($1, $2, $3, $4, $5, '500001', '9876500000', $6, $7, $8, $9) RETURNING id`,
      [name, code, city, state, `${name}, ${city}`, `${code.toLowerCase()}@ttcfleet360.com`, lat, lng, status],
    );
    const branchId = rows[0].id;
    await db.query(
      `INSERT INTO locations (branch_id, name, type, address, city) VALUES ($1, $2, 'WAREHOUSE', $3, $4)`,
      [branchId, `${code} Main Warehouse`, `${name}, ${city}`, city],
    );

    for (let i = 0; i < userCount; i++) {
      const first = FIRST[userNo % FIRST.length];
      const last = LAST[Math.floor(userNo / FIRST.length) % LAST.length];
      const role = i === 0 ? 'Branch Manager' : (i % 9 === 0 ? 'Auditor' : 'Operations Executive');
      await db.query(
        `INSERT INTO users (full_name, email, phone, password_hash, role_id, branch_id, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - ($8 || ' days')::interval)`,
        [`${first} ${last}`, `${first}.${last}${userNo}@ttcfleet360.com`.toLowerCase(),
          `98${String(10000000 + userNo * 7919).slice(0, 8)}`, demoHash, roleId(role), branchId,
          userNo % 17 !== 5, // a few inactive users
          String(userNo % 180)],
      );
      userNo++;
    }
  }
  // Total users = 1 admin + 119 demo = 120 (matches the design)

  // Subscriptions: [customer, plan, activeUsers, startOffset, endOffset]
  const { rows: plans } = await db.query('SELECT id, name, price_monthly FROM subscription_plans');
  const planId = (n) => plans.find((p) => p.name === n).id;
  const subs = [
    ['Acme Corp', 'Premium', 120, -27, 3], ['Tech Solutions', 'Basic', 40, -23, 7],
    ['Logistics Ltd', 'Basic', 35, -20, 10], ['Speedway Movers', 'Enterprise', 300, -10, 20],
    ['Godavari Transports', 'Premium', 210, -15, 15], ['Deccan Cargo', 'Premium', 180, -5, 25],
    ['Krishna Freight', 'Enterprise', 420, -2, 28], ['Southern Express', 'Basic', 60, -40, -10],
    ['Metro Couriers', 'Premium', 260, -1, 29], ['Bharat Haulage', 'Enterprise', 400, -12, 18],
    ['Coastal Logistics', 'Premium', 300, -8, 22], ['Nizam Carriers', 'Basic', 75, -3, 27],
  ];
  for (const [customer, plan, users, start, end] of subs) {
    await db.query(
      `INSERT INTO subscriptions (customer_name, customer_email, plan_id, active_users, start_date, end_date, auto_renew)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [customer, `billing@${customer.toLowerCase().replace(/\s+/g, '')}.com`, planId(plan), users,
        dayOffset(start), dayOffset(end), plan === 'Enterprise'],
    );
  }

  // Vehicles (8 active, 2 in maintenance) and trips for the last 6 months
  const { rows: branchRows } = await db.query('SELECT id FROM branches ORDER BY id');
  const vehicleIds = [];
  for (let i = 0; i < 10; i++) {
    const { rows } = await db.query(
      `INSERT INTO vehicles (reg_number, model, type, branch_id, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [`TS09AB${1000 + i}`, i % 2 ? 'Tata Prima 5530' : 'Ashok Leyland 4825', i % 3 ? 'TRUCK' : 'TRAILER',
        branchRows[i % branchRows.length].id, i < 8],
    );
    vehicleIds.push(rows[0].id);
  }
  const tripsPerMonth = [52, 63, 71, 80, 79, 94];   // oldest -> current month
  const onTimeRate = [0.78, 0.8, 0.84, 0.86, 0.88, 0.93];
  for (let m = 0; m < 6; m++) {
    const monthsAgo = 5 - m;
    for (let t = 0; t < tripsPerMonth[m]; t++) {
      await db.query(
        `INSERT INTO trips (vehicle_id, trip_date, delivered_on_time)
         VALUES ($1, (date_trunc('month', CURRENT_DATE) - ($2 || ' months')::interval + ($3 || ' days')::interval)::date, $4)`,
        [vehicleIds[t % vehicleIds.length], String(monthsAgo), String(t % 18), t < Math.round(tripsPerMonth[m] * onTimeRate[m])],
      );
    }
  }

  // A few sample activity rows so "Recent Activities" is not empty on first run
  await db.query(
    `INSERT INTO audit_logs (user_id, user_email, action, entity_type, description, created_at)
     SELECT u.id, u.email, x.action, x.entity, x.description, NOW() - x.ago::interval
       FROM users u,
            (VALUES ('UPDATE', 'SETTINGS',     'Updated system settings',                      '15 minutes'),
                    ('UPDATE', 'SUBSCRIPTION', 'Renewed Premium Plan for Acme Corp',           '10 minutes'),
                    ('UPDATE', 'BRANCH',       'Updated branch details: Bengaluru Whitefield', '5 minutes'),
                    ('CREATE', 'USER',         'Created user Rahul Kumar',                     '2 minutes'))
            AS x(action, entity, description, ago)
      WHERE u.email = $1`,
    [ADMIN_EMAIL],
  );

  // Spread creation dates over the past months so the "growth %" cards
  // on the dashboard show realistic numbers.
  await db.query("UPDATE branches SET created_at = NOW() - ((id * 23) || ' days')::interval");
  await db.query("UPDATE vehicles SET created_at = NOW() - ((id * 19) || ' days')::interval");
  await db.query("UPDATE subscriptions SET created_at = NOW() - ((id * 11) || ' days')::interval");
}

async function seed({ demo = true } = {}) {
  await seedCore();
  if (demo) await seedDemo();
  console.log(`Seed complete (${demo ? 'core + demo' : 'core only'}).`);
}

module.exports = seed;

if (require.main === module) {
  seed({ demo: !process.argv.includes('--core-only') })
    .then(() => db.pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}
