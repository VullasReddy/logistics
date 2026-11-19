/**
 * users.routes.js  (Module 2)
 * ---------------
 *   GET    /api/users                     USER_VIEW    list + search + filters
 *   GET    /api/users/:id                 USER_VIEW    one user
 *   POST   /api/users                     USER_CREATE  create user
 *   PUT    /api/users/:id                 USER_UPDATE  edit user details
 *   PATCH  /api/users/:id/status          USER_STATUS  activate / deactivate
 *   POST   /api/users/:id/reset-password  USER_UPDATE  new temporary password
 */
const express = require('express');
const { z } = require('zod');
const validate = require('../../middleware/validate');
const { authenticate, requirePermission } = require('../../middleware/auth');
const audit = require('../../utils/audit');
const { strongPassword } = require('../auth/auth.routes');
const service = require('./users.service');

const router = express.Router();
router.use(authenticate); // every route below needs login

const indianPhone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

const createSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: z.email('Enter a valid email').transform((e) => e.toLowerCase().trim()),
  phone: indianPhone.optional().or(z.literal('')),
  password: strongPassword.optional().or(z.literal('')), // empty -> temp password is generated
  role_id: z.coerce.number().int().positive('Select a role'),
  branch_id: z.coerce.number().int().positive().nullable().optional(),
});

// For update every field is optional, and password is not allowed here.
const updateSchema = createSchema.omit({ password: true }).partial();

const statusSchema = z.object({ is_active: z.boolean() });

router.get('/', requirePermission('USER_VIEW'), async (req, res) => {
  res.json(await service.list(req.query));
});

router.get('/:id', requirePermission('USER_VIEW'), async (req, res) => {
  res.json(await service.getById(req.params.id));
});

router.post('/', requirePermission('USER_CREATE'), validate(createSchema), async (req, res) => {
  await service.checkReferences(req.body);
  const { user, tempPassword } = await service.create(req.body);
  await audit.log(req, {
    action: 'CREATE', entityType: 'USER', entityId: user.id,
    description: `Created user ${user.full_name}`, details: { email: user.email, role: user.role_name },
  });
  // tempPassword is shown to the admin once, so they can share it with the user.
  res.status(201).json({ user, tempPassword });
});

router.put('/:id', requirePermission('USER_UPDATE'), validate(updateSchema), async (req, res) => {
  await service.checkReferences(req.body);
  const { before, after } = await service.update(req.params.id, req.body);
  await audit.log(req, {
    action: 'UPDATE', entityType: 'USER', entityId: after.id,
    description: `Updated user ${after.full_name}`, details: audit.diff(before, req.body),
  });
  res.json(after);
});

router.patch('/:id/status', requirePermission('USER_STATUS'), validate(statusSchema), async (req, res) => {
  const user = await service.setStatus(req.params.id, req.body.is_active, req.user.id);
  await audit.log(req, {
    action: 'STATUS_CHANGE', entityType: 'USER', entityId: user.id,
    description: `${user.is_active ? 'Activated' : 'Deactivated'} user ${user.full_name}`,
  });
  res.json(user);
});

router.post('/:id/reset-password', requirePermission('USER_UPDATE'), async (req, res) => {
  const { user, tempPassword } = await service.resetPassword(req.params.id);
  await audit.log(req, {
    action: 'PASSWORD_CHANGE', entityType: 'USER', entityId: user.id,
    description: `Reset password for ${user.full_name}`,
  });
  res.json({ message: 'Password reset. Share the temporary password with the user.', tempPassword });
});

module.exports = router;
