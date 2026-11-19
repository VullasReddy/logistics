/**
 * roles.routes.js  (Module 3)
 * ---------------
 *   GET    /api/roles/permissions   ROLE_VIEW    all permission codes (grouped by module)
 *   GET    /api/roles               ROLE_VIEW    roles with user count + permissions
 *   GET    /api/roles/:id           ROLE_VIEW
 *   POST   /api/roles               ROLE_MANAGE  create role with permissions
 *   PUT    /api/roles/:id           ROLE_MANAGE  rename / change permissions
 *   DELETE /api/roles/:id           ROLE_MANAGE  only if no users use it
 */
const express = require('express');
const { z } = require('zod');
const validate = require('../../middleware/validate');
const { authenticate, requirePermission } = require('../../middleware/auth');
const audit = require('../../utils/audit');
const service = require('./roles.service');

const router = express.Router();
router.use(authenticate);

const roleSchema = z.object({
  name: z.string().trim().min(2, 'Role name must be at least 2 characters').max(60),
  description: z.string().trim().max(255).optional(),
  permissions: z.array(z.string()).min(1, 'Select at least one permission'),
});

router.get('/permissions', requirePermission('ROLE_VIEW'), async (req, res) => {
  res.json(await service.listPermissions());
});

router.get('/', requirePermission('ROLE_VIEW', 'USER_VIEW'), async (req, res) => {
  // USER_VIEW is also allowed so the "Role" dropdown works on the users page.
  res.json(await service.list());
});

router.get('/:id', requirePermission('ROLE_VIEW'), async (req, res) => {
  res.json(await service.getById(req.params.id));
});

router.post('/', requirePermission('ROLE_MANAGE'), validate(roleSchema), async (req, res) => {
  const role = await service.create(req.body);
  await audit.log(req, {
    action: 'CREATE', entityType: 'ROLE', entityId: role.id,
    description: `Created role ${role.name}`, details: { permissions: role.permissions },
  });
  res.status(201).json(role);
});

router.put('/:id', requirePermission('ROLE_MANAGE'), validate(roleSchema.partial()), async (req, res) => {
  const { before, after } = await service.update(req.params.id, req.body);
  await audit.log(req, {
    action: 'UPDATE', entityType: 'ROLE', entityId: after.id,
    description: `Updated role ${after.name}`,
    details: { permissions: { from: before.permissions, to: after.permissions } },
  });
  res.json(after);
});

router.delete('/:id', requirePermission('ROLE_MANAGE'), async (req, res) => {
  const role = await service.remove(req.params.id);
  await audit.log(req, {
    action: 'DELETE', entityType: 'ROLE', entityId: role.id, description: `Deleted role ${role.name}`,
  });
  res.json({ message: 'Role deleted' });
});

module.exports = router;
