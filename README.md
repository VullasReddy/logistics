# TTC Fleet360 – Logistics and Fleet Management System

A centralized web platform to manage company operations: admin login, users, roles &
permissions, branches & locations, company profile, subscriptions, system settings and
audit logs.

**Team:** Vullas · Chanikya · Sai Prakash · Ameen

| Layer      | Technology |
|------------|------------|
| Frontend   | React 19 + Vite, React Router, Recharts, lucide icons |
| Backend    | Node.js 22 + Express 5 (REST API) |
| Database   | PostgreSQL 16 (plain SQL with `pg`, no ORM: every query is visible) |
| Cache      | Redis (token blacklist, login lock counters, permission cache) |
| Auth       | JWT + Role-Based Access Control (16 permissions) |
| Storage    | AWS S3 (MinIO locally) for the company logo |
| DevOps     | Docker, docker-compose, GitHub Actions CI |

---

## 0. Easiest: one click (Windows) – needs only Node.js

Double-click **START.bat** (Mac/Linux: `./start.sh`).
First run installs packages (5–10 min), later runs take ~20 seconds.
It starts a built-in PostgreSQL (PGlite, no install needed), the backend and the
frontend, then opens **http://localhost:5173**. Keep the black window open.

## 1. Quick start with Docker

```bash
docker compose up --build
```

Open **http://localhost:8080** and log in with:

| Email | Password | Role |
|-------|----------|------|
| admin@ttcfleet360.com | Admin@123 | Super Admin |
| rahul.kumar0@ttcfleet360.com | Welcome@123 | Branch Manager (demo) |
| priya.kumar1@ttcfleet360.com | Welcome@123 | Operations Executive (demo) |

## 2. Run without Docker (for development)

You need **Node.js 20+**, **PostgreSQL** and (optionally) **Redis** installed.

```bash
# 1. Create the database (once)
psql -U postgres -c "CREATE USER fleet WITH PASSWORD 'fleet' CREATEDB;"
psql -U postgres -c "CREATE DATABASE fleet360 OWNER fleet;"
psql -U postgres -c "CREATE DATABASE fleet360_test OWNER fleet;"

# 2. Backend  (terminal 1)
cd backend
cp .env.example .env          # then edit if your DB password is different
npm install
npm run db:reset              # creates tables + demo data
npm run dev                   # API on http://localhost:5000

# 3. Frontend (terminal 2)
cd frontend
npm install
npm run dev                   # app on http://localhost:5173
```

No Redis? Leave `REDIS_URL` empty in `.env`. The app then uses an in-memory cache (fine
for one developer machine).

## 3. Tests

```bash
cd backend
npm test        # 26 API tests: auth, RBAC, all modules (uses fleet360_test DB)
```

## 4. Folder structure

```
ttc-fleet360/
├── backend/
│   ├── db/
│   │   ├── migrations/001_schema.sql   ← every table, with comments
│   │   ├── migrate.js                  ← runs migrations in order
│   │   └── seed.js                     ← roles, admin, plans, settings, demo data
│   ├── src/
│   │   ├── config/        env.js, db.js, redis.js
│   │   ├── constants/     permissions.js  (master list of permission codes)
│   │   ├── middleware/    auth.js (JWT + permissions), validate.js, errorHandler.js
│   │   ├── utils/         audit.js, storage.js (S3/local), sql.js, ApiError.js
│   │   ├── modules/       one folder per module (see table below)
│   │   ├── app.js         Express app (routes + middleware)
│   │   └── server.js      starts the server
│   └── tests/             Jest + Supertest
├── frontend/
│   └── src/
│       ├── api/client.js            axios + token handling
│       ├── context/AuthContext.jsx  logged-in user, can('PERMISSION')
│       ├── components/              Layout, ProtectedRoute, ui.jsx, Artwork, IndiaMap
│       ├── pages/                   one page per module
│       └── styles/global.css        design system (colours, cards, tables, forms)
├── docs/            API.md, DATABASE.md, CONTRIBUTING.md
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## 5. Modules → files

| # | Module | Backend | Frontend page |
|---|--------|---------|---------------|
| 1 | Admin Login & Authentication | `modules/auth/`, `middleware/auth.js` | `Login.jsx`, `AccountSettings.jsx`, `ProtectedRoute.jsx` |
| 2 | User Creation & Management | `modules/users/` | `Users.jsx` |
| 3 | Role-Based Access Control | `modules/roles/`, `constants/permissions.js` | `Roles.jsx` |
| 4 | Branch & Location Management | `modules/branches/` | `Branches.jsx` |
| 5 | Company Profile | `modules/company/`, `utils/storage.js` | `Company.jsx` |
| 6 | Subscription Management | `modules/subscriptions/` | `Subscriptions.jsx` |
| 7 | Configuration & Settings | `modules/settings/` | `Configuration.jsx` |
| 8 | Audit Logs & Activity | `modules/audit/`, `utils/audit.js` | `AuditLogs.jsx` |
| – | Dashboard + global search | `modules/dashboard/` | `Dashboard.jsx`, `Layout.jsx` |

## 6. How a request flows (read this first!)

```
Browser ──► React page ──► api/client.js (adds JWT) ──► /api/...
   ──► Express route ──► authenticate (valid token? not logged out? user active?)
   ──► requirePermission('USER_CREATE') (role has it?)
   ──► validate(schema) (body correct?)
   ──► handler / service (SQL) ──► audit.log(...) ──► JSON response
   (any thrown error ──► errorHandler ──► { error: { message, details } })
```

More: [API reference](docs/API.md) · [Database](docs/DATABASE.md) · [Team rules](docs/CONTRIBUTING.md)

---
Map outline: [@svg-maps/india](https://github.com/VictorCazanave/svg-maps) by Victor Cazanave, CC BY 4.0.
