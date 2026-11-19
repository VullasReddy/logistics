/**
 * Modules 2, 4, 5, 6, 7, 8 tests
 */
const { db, resetDatabase, loginAs } = require('./helpers');

let admin;
beforeAll(async () => {
  await resetDatabase();
  admin = await loginAs();
});
afterAll(() => db.pool.end());

describe('Module 2 - Users', () => {
  test('create user without password returns a temporary password', async () => {
    const res = await admin.post('/api/users', { full_name: 'Sai Prakash', email: 'SAI@Test.com', role_id: 1 });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('sai@test.com'); // stored in lower case
    expect(res.body.user.must_change_password).toBe(true);
    expect(res.body.tempPassword).toMatch(/^Tmp#/);
  });

  test('duplicate email is rejected with 409', async () => {
    const res = await admin.post('/api/users', { full_name: 'Copy', email: 'sai@test.com', role_id: 1 });
    expect(res.status).toBe(409);
  });

  test('validation errors list the bad fields', async () => {
    const res = await admin.post('/api/users', { full_name: 'X', email: 'not-an-email', role_id: 1, phone: '123' });
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['full_name', 'email', 'phone']));
  });

  test('search, edit and deactivate a user', async () => {
    const list = await admin.get('/api/users?search=sai');
    expect(list.body.data).toHaveLength(1);
    const id = list.body.data[0].id;

    const edited = await admin.put(`/api/users/${id}`, { phone: '9876543210' });
    expect(edited.body.phone).toBe('9876543210');

    const off = await admin.patch(`/api/users/${id}/status`, { is_active: false });
    expect(off.body.is_active).toBe(false);
    expect((await admin.get('/api/users?status=inactive')).body.data.map((u) => u.id)).toContain(id);
  });

  test('admin cannot deactivate themselves', async () => {
    const res = await admin.patch(`/api/users/${admin.user.id}/status`, { is_active: false });
    expect(res.status).toBe(400);
  });
});

describe('Module 4 - Branches and Locations', () => {
  let branchId;
  test('create branch, add location, allocate users, change status', async () => {
    const b = await admin.post('/api/branches', { name: 'Hyderabad Hub', code: 'hyd01', city: 'Hyderabad', state: 'Telangana', pincode: '500081' });
    expect(b.status).toBe(201);
    expect(b.body.code).toBe('HYD01'); // upper-cased
    branchId = b.body.id;

    const loc = await admin.post(`/api/branches/${branchId}/locations`, { name: 'Shamshabad Warehouse', type: 'WAREHOUSE' });
    expect(loc.status).toBe(201);

    const alloc = await admin.post(`/api/branches/${branchId}/users`, { user_ids: [admin.user.id] });
    expect(alloc.status).toBe(200);
    expect((await admin.get(`/api/branches/${branchId}/users`)).body).toHaveLength(1);

    const st = await admin.patch(`/api/branches/${branchId}/status`, { status: 'INACTIVE' });
    expect(st.body.status).toBe('INACTIVE');
  });

  test('invalid pincode is rejected', async () => {
    const res = await admin.post('/api/branches', { name: 'Bad', code: 'BAD01', city: 'X', state: 'Y', pincode: '12' });
    expect(res.status).toBe(400);
  });
});

describe('Module 5 - Company Profile', () => {
  test('update profile with valid GSTIN, reject invalid PAN', async () => {
    const ok = await admin.put('/api/company', { name: 'TTC Fleet360', gstin: '36AABCT1234F1Z5' });
    expect(ok.status).toBe(200);
    const bad = await admin.put('/api/company', { pan: '12345' });
    expect(bad.status).toBe(400);
  });

  test('upload logo (stored locally when S3 is not configured)', async () => {
    const png = Buffer.from('89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63F8CFC0F01F0005000201E2214BC10000000049454E44AE426082', 'hex');
    const res = await admin.post('/api/company/logo').attach('logo', png, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.logo_url).toMatch(/^\/uploads\/logos\/.+\.png$/);
  });
});

describe('Module 6 - Subscriptions', () => {
  let subId;
  test('create subscription: end date defaults to one plan period', async () => {
    const { body: plans } = await admin.get('/api/subscriptions/plans');
    const basic = plans.find((p) => p.name === 'Basic');
    const res = await admin.post('/api/subscriptions', { customer_name: 'Acme Corp', plan_id: basic.id, start_date: '2026-01-01' });
    expect(res.status).toBe(201);
    expect(res.body.end_date).toBe('2026-01-31');
    expect(res.body.computed_status).toBe('EXPIRED'); // ended in the past
    subId = res.body.id;
  });

  test('renewing an expired subscription starts from today and is tracked', async () => {
    const res = await admin.post(`/api/subscriptions/${subId}/renew`, { periods: 2 });
    expect(res.status).toBe(200);
    expect(res.body.computed_status).toBe('ACTIVE');
    expect(res.body.days_left).toBe(60);
    expect(res.body.renewals).toHaveLength(1);
    expect(res.body.renewals[0].amount).toBe(999 * 2);
  });

  test('end date before start date is rejected', async () => {
    const res = await admin.post('/api/subscriptions', { customer_name: 'X Ltd', plan_id: 1, start_date: '2026-05-10', end_date: '2026-05-01' });
    expect(res.status).toBe(400);
  });

  test('create and modify a plan', async () => {
    const p = await admin.post('/api/subscriptions/plans', { name: 'Starter', price_monthly: 499, features: ['5 vehicles'] });
    expect(p.status).toBe(201);
    const u = await admin.put(`/api/subscriptions/plans/${p.body.id}`, { price_monthly: 599 });
    expect(u.body.price_monthly).toBe(599);
  });
});

describe('Module 7 - Settings', () => {
  test('valid change saved, wrong type rejected', async () => {
    const ok = await admin.put('/api/settings', { values: { 'notify.renewal_reminder_days': 10, 'pref.theme': 'dark' } });
    expect(ok.status).toBe(200);
    const bad = await admin.put('/api/settings', { values: { 'pref.theme': 'purple' } });
    expect(bad.status).toBe(400);
    const { body } = await admin.get('/api/settings');
    expect(body.PREFERENCE.find((s) => s.key === 'pref.theme').value).toBe('dark');
  });
});

describe('Module 8 - Audit Logs', () => {
  test('actions above were logged and can be filtered', async () => {
    const all = await admin.get('/api/audit-logs?limit=100');
    const actions = all.body.data.map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['LOGIN', 'CREATE', 'UPDATE', 'STATUS_CHANGE']));

    const logins = await admin.get('/api/audit-logs?action=LOGIN,LOGOUT');
    expect(logins.body.data.every((a) => ['LOGIN', 'LOGOUT'].includes(a.action))).toBe(true);
  });

  test('date-wise report and CSV export', async () => {
    const report = await admin.get('/api/audit-logs/report');
    expect(report.body.days.length).toBeGreaterThan(0);
    const csv = await admin.get('/api/audit-logs/export');
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text.split('\n')[0]).toContain('Date & Time');
  });
});

describe('Dashboard', () => {
  test('returns all sections', async () => {
    const res = await admin.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(expect.arrayContaining(
      ['stats', 'fleetPerformance', 'branchDistribution', 'recentActivities', 'plans', 'upcomingRenewals']));
    expect(res.body.fleetPerformance).toHaveLength(6);
  });
});
