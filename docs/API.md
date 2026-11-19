# TTC Fleet360 – API Reference

Base URL: `http://localhost:5000/api` (through the frontend: `/api`)

## Conventions

* **Auth:** every route except `POST /auth/login` and `GET /health` needs
  `Authorization: Bearer <token>`.
* **Permission:** the code in the *Perm* column must be in the user's role, else **403**.
* **Errors** always look like:
  ```json
  { "error": { "message": "Please check the highlighted fields",
               "details": [{ "field": "email", "message": "Enter a valid email" }] } }
  ```
  | Status | Meaning |
  |---|---|
  | 400 | Validation failed / bad request |
  | 401 | Not logged in, token expired or logged out |
  | 403 | Logged in but role lacks the permission |
  | 404 | Record not found |
  | 409 | Duplicate value (e.g. email) or record in use |
  | 429 | Too many login attempts (account locked 15 min) |
* **Lists with pagination** accept `?page=1&limit=10` and return
  `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }`.
* Every create / update / delete / status change writes an **audit log** automatically.

---

## Module 1 – Authentication `/auth`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` (user includes `permissions[]`) |
| POST | `/auth/logout` | logged in | Blacklists the current token in Redis |
| GET | `/auth/me` | logged in | Current user + permissions |
| POST | `/auth/change-password` | logged in | `{ currentPassword, newPassword }`; new password: 8+ chars, upper, lower, number, symbol |

Example:
```bash
curl -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" \
     -d '{"email":"admin@ttcfleet360.com","password":"Admin@123"}'
```

## Module 2 – Users `/users`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| GET | `/users` | USER_VIEW | `?search=&role_id=&branch_id=&status=active\|inactive&page=&limit=` |
| GET | `/users/:id` | USER_VIEW | |
| POST | `/users` | USER_CREATE | `{ full_name, email, phone?, password?, role_id, branch_id? }`. No password → returns `tempPassword` (shown once) and user must change it at first login |
| PUT | `/users/:id` | USER_UPDATE | any of `full_name, email, phone, role_id, branch_id` |
| PATCH | `/users/:id/status` | USER_STATUS | `{ is_active: true\|false }` (cannot deactivate yourself) |
| POST | `/users/:id/reset-password` | USER_UPDATE | → `{ tempPassword }` |

## Module 3 – Roles & Permissions `/roles`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| GET | `/roles/permissions` | ROLE_VIEW | All 16 permission codes with module + description |
| GET | `/roles` | ROLE_VIEW or USER_VIEW | Roles with `user_count` and `permissions[]` |
| GET | `/roles/:id` | ROLE_VIEW | |
| POST | `/roles` | ROLE_MANAGE | `{ name, description?, permissions: ['USER_VIEW', ...] }` |
| PUT | `/roles/:id` | ROLE_MANAGE | same fields, all optional. System role (Super Admin) cannot be changed. Takes effect on the next request (cache cleared) |
| DELETE | `/roles/:id` | ROLE_MANAGE | Only if no users have this role |

## Module 4 – Branches & Locations `/branches`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| GET | `/branches` | BRANCH_VIEW or USER_VIEW | `?search=&status=ACTIVE\|INACTIVE` (includes `user_count`, `location_count`) |
| GET | `/branches/:id` | BRANCH_VIEW | Branch + `locations[]` |
| POST | `/branches` | BRANCH_MANAGE | `{ name, code, city, state, address?, pincode?, phone?, email?, latitude?, longitude? }` |
| PUT | `/branches/:id` | BRANCH_MANAGE | any branch field |
| PATCH | `/branches/:id/status` | BRANCH_MANAGE | `{ status: 'ACTIVE'\|'INACTIVE' }` |
| GET | `/branches/:id/users` | BRANCH_VIEW | Users in this branch |
| POST | `/branches/:id/users` | BRANCH_MANAGE | `{ user_ids: [1,2] }`: move users to this branch |
| POST | `/branches/:id/locations` | BRANCH_MANAGE | `{ name, type: WAREHOUSE\|HUB\|OFFICE\|PARKING, address?, city?, pincode? }` |
| PUT | `/branches/locations/:locId` | BRANCH_MANAGE | any location field + `is_active` |
| DELETE | `/branches/locations/:locId` | BRANCH_MANAGE | |

## Module 5 – Company Profile `/company`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| GET | `/company` | COMPANY_VIEW or DASHBOARD_VIEW | Single profile row |
| PUT | `/company` | COMPANY_UPDATE | `name, legal_name, tagline, email, phone, website, address, city, state, country, pincode, gstin, pan, cin, registration_date`. GSTIN / PAN / CIN format validated |
| POST | `/company/logo` | COMPANY_UPDATE | `multipart/form-data`, field **logo**, PNG/JPG/WEBP ≤ 2 MB → S3 (or local disk) |

## Module 6 – Subscriptions `/subscriptions`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| GET | `/subscriptions/plans` | SUBSCRIPTION_VIEW or DASHBOARD_VIEW | Plans + `active_users`, `active_subscriptions` |
| POST | `/subscriptions/plans` | SUBSCRIPTION_MANAGE | `{ name, price_monthly, duration_days?, max_users?, max_vehicles?, features?: [], is_popular?, is_active? }` |
| PUT | `/subscriptions/plans/:id` | SUBSCRIPTION_MANAGE | any plan field |
| GET | `/subscriptions/renewals/upcoming` | SUBSCRIPTION_VIEW or DASHBOARD_VIEW | `?days=30`: active subscriptions ending soon |
| GET | `/subscriptions` | SUBSCRIPTION_VIEW | `?search=&plan_id=&status=ACTIVE\|EXPIRING\|EXPIRED\|CANCELLED&page=` |
| GET | `/subscriptions/:id` | SUBSCRIPTION_VIEW | + `renewals[]` history |
| POST | `/subscriptions` | SUBSCRIPTION_MANAGE | `{ customer_name, customer_email?, plan_id, active_users?, start_date, end_date?, auto_renew? }`. No end date → one plan period |
| PUT | `/subscriptions/:id` | SUBSCRIPTION_MANAGE | any field (end ≥ start) |
| POST | `/subscriptions/:id/renew` | SUBSCRIPTION_MANAGE | `{ plan_id?, periods? }`. Extends from the old end date, or from today if already expired |
| POST | `/subscriptions/:id/cancel` | SUBSCRIPTION_MANAGE | |

Every subscription row has two calculated fields: `days_left` and `computed_status`.
`EXPIRING` means it ends within `notify.renewal_reminder_days` (a setting, default 7).

## Module 7 – Settings `/settings`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| GET | `/settings` | SETTINGS_VIEW | `{ APPLICATION: [...], NOTIFICATION: [...], OPERATIONAL: [...], PREFERENCE: [...] }` |
| PUT | `/settings` | SETTINGS_UPDATE | `{ values: { "app.timezone": "UTC", "notify.sms_enabled": true } }`. Each value is checked against its type; all-or-nothing |

## Module 8 – Audit Logs `/audit-logs`

| Method | Path | Perm | Body / Notes |
|---|---|---|---|
| GET | `/audit-logs` | AUDIT_VIEW | `?search=&action=LOGIN,LOGOUT&user_id=&entity_type=USER&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&limit=` |
| GET | `/audit-logs/report` | AUDIT_VIEW | `?from=&to=` → per-day counts per action (default last 7 days) |
| GET | `/audit-logs/export` | AUDIT_VIEW | Same filters as list → CSV file (max 10,000 rows) |

Actions: `LOGIN, LOGOUT, LOGIN_FAILED, CREATE, UPDATE, DELETE, PASSWORD_CHANGE, STATUS_CHANGE`.
There is no edit or delete endpoint on purpose.

## Dashboard `/dashboard`

| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/dashboard` | DASHBOARD_VIEW | `stats, fleetPerformance, branchDistribution, branchPins, recentActivities, plans, upcomingRenewals` |
| GET | `/dashboard/search?q=` | DASHBOARD_VIEW | Users, branches, vehicles (only what the user may view) |
| GET | `/health` | public | `{ status: 'ok', cache: 'redis'\|'memory' }` |
