/**
 * Module 1 (Authentication) + Module 3 (RBAC) tests
 */
const { app, db, request, resetDatabase, loginAs } = require('./helpers');

beforeAll(resetDatabase);
afterAll(() => db.pool.end());

describe('Module 1 - Authentication', () => {
  test('admin can log in and gets a token + permissions', async () => {
    const admin = await loginAs();
    expect(admin.token).toBeDefined();
    expect(admin.user.role_name).toBe('Super Admin');
    expect(admin.user.permissions).toContain('USER_CREATE');
    expect(admin.user.password_hash).toBeUndefined(); // never leak the hash
  });

  test('wrong password is rejected with a generic message', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'admin@ttcfleet360.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  test('protected route without token returns 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
  });

  test('token stops working after logout', async () => {
    const admin = await loginAs();
    expect((await admin.get('/api/auth/me')).status).toBe(200);
    expect((await admin.post('/api/auth/logout')).status).toBe(200);
    expect((await admin.get('/api/auth/me')).status).toBe(401);
  });

  test('account locks after 5 failed attempts', async () => {
    const admin = await loginAs();
    await admin.post('/api/users', {
      full_name: 'Lock Test', email: 'lock@test.com', password: 'Lock@1234', role_id: 1,
    });
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ email: 'lock@test.com', password: 'bad' });
    }
    // Even the CORRECT password is refused while locked
    const res = await request(app).post('/api/auth/login').send({ email: 'lock@test.com', password: 'Lock@1234' });
    expect(res.status).toBe(429);
  });

  test('change password: weak password rejected, strong accepted', async () => {
    const admin = await loginAs();
    await admin.post('/api/users', { full_name: 'Pwd User', email: 'pwd@test.com', password: 'First@123', role_id: 1 });
    const user = await loginAs('pwd@test.com', 'First@123');

    const weak = await user.post('/api/auth/change-password', { currentPassword: 'First@123', newPassword: 'abc' });
    expect(weak.status).toBe(400);

    const ok = await user.post('/api/auth/change-password', { currentPassword: 'First@123', newPassword: 'Second@123' });
    expect(ok.status).toBe(200);
    await expect(loginAs('pwd@test.com', 'Second@123')).resolves.toBeDefined();
  });
});

describe('Module 3 - Role-Based Access Control', () => {
  test('user with a limited role cannot create users (403)', async () => {
    const admin = await loginAs();
    const { body: roles } = await admin.get('/api/roles');
    const ops = roles.find((r) => r.name === 'Operations Executive');

    await admin.post('/api/users', { full_name: 'Ops Person', email: 'ops@test.com', password: 'Ops@12345', role_id: ops.id });
    const opsUser = await loginAs('ops@test.com', 'Ops@12345');

    expect((await opsUser.get('/api/users')).status).toBe(200);          // has USER_VIEW
    expect((await opsUser.post('/api/users', {})).status).toBe(403);      // no USER_CREATE
    expect((await opsUser.get('/api/audit-logs')).status).toBe(403);      // no AUDIT_VIEW
  });

  test('changing role permissions applies immediately', async () => {
    const admin = await loginAs();
    const created = await admin.post('/api/roles', { name: 'Viewer', permissions: ['DASHBOARD_VIEW'] });
    expect(created.status).toBe(201);

    await admin.post('/api/users', { full_name: 'View Er', email: 'viewer@test.com', password: 'View@1234', role_id: created.body.id });
    const viewer = await loginAs('viewer@test.com', 'View@1234');
    expect((await viewer.get('/api/branches')).status).toBe(403);

    await admin.put(`/api/roles/${created.body.id}`, { permissions: ['DASHBOARD_VIEW', 'BRANCH_VIEW'] });
    expect((await viewer.get('/api/branches')).status).toBe(200); // same token, new permission
  });

  test('system role cannot be edited, used role cannot be deleted', async () => {
    const admin = await loginAs();
    expect((await admin.put('/api/roles/1', { name: 'Hacked' })).status).toBe(400);
    const { body: roles } = await admin.get('/api/roles');
    const viewer = roles.find((r) => r.name === 'Viewer');
    expect((await admin.del(`/api/roles/${viewer.id}`)).status).toBe(409);
  });
});
