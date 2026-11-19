/**
 * Test helpers.
 * Tests use a SEPARATE database (fleet360_test) that is wiped and
 * re-created before each test file, so tests never touch real data.
 */
process.env.NODE_ENV = 'test';
process.env.REDIS_URL = ''; // use the in-memory cache in tests

const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');
const migrate = require('../db/migrate');
const seed = require('../db/seed');

async function resetDatabase() {
  await migrate({ reset: true });
  await seed({ demo: false }); // core data: roles, admin, plans, settings
}

/** Log in and return an object with ready-to-use request helpers. */
async function loginAs(email = 'admin@ttcfleet360.com', password = 'Admin@123') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  const auth = (r) => r.set('Authorization', `Bearer ${res.body.token}`);
  return {
    token: res.body.token,
    user: res.body.user,
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
    patch: (url, body) => auth(request(app).patch(url)).send(body),
    del: (url) => auth(request(app).delete(url)),
  };
}

module.exports = { app, db, request, resetDatabase, loginAs };
