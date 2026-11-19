# Team Guide – Coding Standards & Git Workflow

## Module ownership (suggested)

| Member | Modules | Backend folders | Frontend pages |
|---|---|---|---|
| Vullas | 1. Auth, 3. RBAC | `modules/auth`, `modules/roles`, `middleware/auth.js` | `Login`, `AccountSettings`, `Roles`, `ProtectedRoute` |
| Chanikya | 2. Users, 4. Branches | `modules/users`, `modules/branches` | `Users`, `Branches` |
| Sai Prakash | 5. Company, 6. Subscriptions | `modules/company`, `modules/subscriptions`, `utils/storage.js` | `Company`, `Subscriptions` |
| Ameen | 7. Settings, 8. Audit Logs, Dashboard | `modules/settings`, `modules/audit`, `modules/dashboard`, `utils/audit.js` | `Configuration`, `AuditLogs`, `Dashboard` |

Shared files (`app.js`, `Layout.jsx`, `global.css`, `001_schema.sql`): change only after telling the team.

## Git workflow

```
main      ← always working, protected (only via pull request)
develop   ← integration branch
feature/<module>-<short-name>    e.g. feature/users-reset-password
```

1. `git checkout develop && git pull`
2. `git checkout -b feature/branches-location-map`
3. Small commits: `feat(branches): add location type filter`
   (types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`)
4. Before pushing: `cd backend && npm test` and `cd frontend && npm run build`
5. Open a pull request to `develop`. **One other member must review** before merge.
6. CI (GitHub Actions) must be green.

## Coding standards

**Naming**
* Files: backend `users.routes.js` / `users.service.js`; frontend pages `PascalCase.jsx`
* Variables & functions `camelCase`; DB tables & columns `snake_case`; constants `UPPER_CASE`
* Permission codes: `<MODULE>_<ACTION>` e.g. `BRANCH_MANAGE`

**Backend**
* Routes do HTTP only (validate → call service → audit → respond). SQL lives in the service.
* Always use `$1, $2` placeholders. Never put user input into an SQL string.
* Validate every request body with a Zod schema (`validate(schema)`).
* Protect every route: `authenticate` + `requirePermission('...')`.
* Throw `ApiError.badRequest(...)` etc. No `res.status(500)` by hand.
* Call `audit.log(req, {...})` after every create / update / delete / status change.
* Never return `password_hash`.

**Frontend**
* Call the API only through `api/client.js`.
* Hide buttons with `can('PERMISSION')`, and remember the backend checks again anyway.
* Use the shared pieces in `components/ui.jsx` (Modal, Field, Badge, Pagination, toast).
* Colours come from CSS variables in `global.css`, not hard-coded per page.

**Comments**
* Every file starts with a short header: what it is, which module, its routes.
* Comment *why*, not *what*: `// start from today if already expired, so no free days`.

## Definition of done (before you say "my module is finished")

- [ ] API works and is listed in `docs/API.md`
- [ ] Tests added in `backend/tests` and `npm test` passes
- [ ] Frontend page handles loading, empty list and error states
- [ ] Actions appear in Audit Logs
- [ ] A user without the permission gets 403 / sees no button
- [ ] You can explain every line you wrote
