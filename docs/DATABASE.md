# TTC Fleet360 – Database Structure

PostgreSQL 16. The full, commented schema is in
[`backend/db/migrations/001_schema.sql`](../backend/db/migrations/001_schema.sql).

## Relationships

```
roles ──< role_permissions >── permissions
  │
  └──< users >── branches ──< locations
         │           └──< vehicles ──< trips
         │
         └──< audit_logs            (user_id kept even if the user is removed: SET NULL)

subscription_plans ──< subscriptions ──< subscription_renewals
company_profile   (exactly 1 row)
settings          (key/value rows)
```
`A ──< B` = one A has many B.

## Tables

| Table | Module | Purpose | Key columns |
|---|---|---|---|
| `permissions` | 3 | Fixed list of actions (seeded from `constants/permissions.js`) | `code` UNIQUE, `module` |
| `roles` | 3 | Named groups of permissions | `name` UNIQUE, `is_system` (cannot edit/delete) |
| `role_permissions` | 3 | Which permissions a role has | PK (`role_id`, `permission_id`) |
| `users` | 1, 2 | Login accounts | `email` UNIQUE (lower case), `password_hash` (bcrypt), `role_id`, `branch_id` (NULL = head office), `is_active`, `must_change_password`, `last_login_at` |
| `branches` | 4 | Company branches | `code` UNIQUE, `city`, `state`, `latitude/longitude` (map), `status` ACTIVE/INACTIVE |
| `locations` | 4 | Warehouses / hubs / offices of a branch | `branch_id`, `type`, `is_active` |
| `company_profile` | 5 | Company details, logo, GSTIN/PAN/CIN | `id` always 1 (CHECK) |
| `subscription_plans` | 6 | Plans we sell | `price_monthly`, `duration_days`, `features` JSONB, `is_popular` |
| `subscriptions` | 6 | Customer on a plan | `plan_id`, `start_date`, `end_date`, `status` ACTIVE/CANCELLED (EXPIRED is calculated) |
| `subscription_renewals` | 6 | Renewal history | `previous_end`, `new_end`, `amount`, `renewed_by` |
| `settings` | 7 | Key/value configuration | `key` PK, `value` JSONB, `category`, `value_type`, `options` |
| `audit_logs` | 8 | Append-only activity log | `action`, `entity_type`, `entity_id`, `description`, `details` JSONB, `ip_address`, `created_at` |
| `vehicles`, `trips` | Dashboard | Feed the Active Fleet card and Fleet Performance chart | `reg_number` UNIQUE, `delivered_on_time` |
| `schema_migrations` | – | Which migration files have run | `filename` |

## Design decisions (be ready to explain these in reviews)

1. **Expired status is not stored.** It is calculated from `end_date` in SQL, so it is always
   correct without a nightly job.
2. **Audit logs copy `user_email`.** If a user is deleted later, the log still shows who did it.
3. **Permissions are seeded, not created from the UI**, because backend code checks exact codes.
4. **Indexes** on foreign keys used in filters (`users.role_id`, `users.branch_id`),
   `audit_logs.created_at`, `subscriptions.end_date`.
5. **Money** uses `NUMERIC(10,2)`, never floating point columns.

## Changing the schema

Never edit `001_schema.sql` after it has been shared. Add a new file:
`backend/db/migrations/002_add_vehicle_capacity.sql`, then run `npm run db:migrate`.
Each file runs once; applied files are recorded in `schema_migrations`.
