/**
 * permissions.js  (Module 3)
 * --------------
 * The master list of permission codes. This is the ONLY place a
 * permission is defined. The seed script copies this list into the
 * `permissions` table, and routes use the same codes in
 * requirePermission('...').
 *
 * To add a new permission:
 *   1. add it here
 *   2. run `npm run db:seed` (it inserts missing permissions)
 *   3. use it in a route
 */
const PERMISSIONS = [
  { code: 'DASHBOARD_VIEW',      module: 'DASHBOARD',     description: 'View dashboard' },

  { code: 'USER_VIEW',           module: 'USERS',         description: 'View users' },
  { code: 'USER_CREATE',         module: 'USERS',         description: 'Create users' },
  { code: 'USER_UPDATE',         module: 'USERS',         description: 'Edit users and reset passwords' },
  { code: 'USER_STATUS',         module: 'USERS',         description: 'Activate / deactivate users' },

  { code: 'ROLE_VIEW',           module: 'ROLES',         description: 'View roles and permissions' },
  { code: 'ROLE_MANAGE',         module: 'ROLES',         description: 'Create, edit, delete roles and assign permissions' },

  { code: 'BRANCH_VIEW',         module: 'BRANCHES',      description: 'View branches and locations' },
  { code: 'BRANCH_MANAGE',       module: 'BRANCHES',      description: 'Create and edit branches and locations' },

  { code: 'COMPANY_VIEW',        module: 'COMPANY',       description: 'View company profile' },
  { code: 'COMPANY_UPDATE',      module: 'COMPANY',       description: 'Edit company profile and logo' },

  { code: 'SUBSCRIPTION_VIEW',   module: 'SUBSCRIPTIONS', description: 'View plans and subscriptions' },
  { code: 'SUBSCRIPTION_MANAGE', module: 'SUBSCRIPTIONS', description: 'Manage plans, subscriptions and renewals' },

  { code: 'SETTINGS_VIEW',       module: 'SETTINGS',      description: 'View system settings' },
  { code: 'SETTINGS_UPDATE',     module: 'SETTINGS',      description: 'Change system settings' },

  { code: 'AUDIT_VIEW',          module: 'AUDIT',         description: 'View audit logs and activity reports' },
];

module.exports = { PERMISSIONS, ALL_CODES: PERMISSIONS.map((p) => p.code) };
