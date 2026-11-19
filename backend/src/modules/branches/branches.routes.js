/**
 * branches.routes.js  (Module 4)
 * ------------------
 *   GET    /api/branches                       BRANCH_VIEW    list (?search=&status=)
 *   GET    /api/branches/:id                   BRANCH_VIEW    one branch + its locations
 *   POST   /api/branches                       BRANCH_MANAGE  create
 *   PUT    /api/branches/:id                   BRANCH_MANAGE  edit
 *   PATCH  /api/branches/:id/status            BRANCH_MANAGE  ACTIVE / INACTIVE
 *   GET    /api/branches/:id/users             BRANCH_VIEW    users of the branch
 *   POST   /api/branches/:id/users             BRANCH_MANAGE  allocate users { user_ids: [..] }
 *   POST   /api/branches/:id/locations         BRANCH_MANAGE  add location
 *   PUT    /api/branches/locations/:locId      BRANCH_MANAGE  edit location
 *   DELETE /api/branches/locations/:locId      BRANCH_MANAGE  remove location
 */
const express = require('express');
const { z } = require('zod');
const validate = require('../../middleware/validate');
const { authenticate, requirePermission } = require('../../middleware/auth');
const audit = require('../../utils/audit');
const service = require('./branches.service');

const router = express.Router();
router.use(authenticate);

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal(''));

const branchSchema = z.object({
  name: z.string().trim().min(2, 'Branch name is required').max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{3,20}$/, 'Code: 3-20 letters/numbers, e.g. HYD01'),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  address: optionalText(255),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
  phone: optionalText(20),
  email: z.email('Enter a valid email').optional().or(z.literal('')),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const locationSchema = z.object({
  name: z.string().trim().min(2, 'Location name is required').max(120),
  type: z.enum(['WAREHOUSE', 'HUB', 'OFFICE', 'PARKING']).optional(),
  address: optionalText(255),
  city: optionalText(80),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
  is_active: z.boolean().optional(),
});

/* ----- Location routes first, so "/locations/..." is not read as a branch :id ----- */

router.put('/locations/:locId', requirePermission('BRANCH_MANAGE'), validate(locationSchema.partial()), async (req, res) => {
  const { before, after } = await service.updateLocation(req.params.locId, req.body);
  await audit.log(req, {
    action: 'UPDATE', entityType: 'LOCATION', entityId: after.id,
    description: `Updated location ${after.name}`, details: audit.diff(before, req.body),
  });
  res.json(after);
});

router.delete('/locations/:locId', requirePermission('BRANCH_MANAGE'), async (req, res) => {
  const location = await service.deleteLocation(req.params.locId);
  await audit.log(req, {
    action: 'DELETE', entityType: 'LOCATION', entityId: location.id, description: `Deleted location ${location.name}`,
  });
  res.json({ message: 'Location deleted' });
});

/* ----- Branch routes ----- */

router.get('/', requirePermission('BRANCH_VIEW', 'USER_VIEW'), async (req, res) => {
  res.json(await service.list(req.query));
});

router.get('/:id', requirePermission('BRANCH_VIEW'), async (req, res) => {
  res.json(await service.getById(req.params.id));
});

router.post('/', requirePermission('BRANCH_MANAGE'), validate(branchSchema), async (req, res) => {
  const branch = await service.create(req.body);
  await audit.log(req, {
    action: 'CREATE', entityType: 'BRANCH', entityId: branch.id, description: `Created branch ${branch.name}`,
  });
  res.status(201).json(branch);
});

router.put('/:id', requirePermission('BRANCH_MANAGE'), validate(branchSchema.partial()), async (req, res) => {
  const { before, after } = await service.update(req.params.id, req.body);
  await audit.log(req, {
    action: 'UPDATE', entityType: 'BRANCH', entityId: after.id,
    description: `Updated branch details: ${after.name}`, details: audit.diff(before, req.body),
  });
  res.json(after);
});

router.patch('/:id/status', requirePermission('BRANCH_MANAGE'),
  validate(z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) })), async (req, res) => {
    const { after } = await service.update(req.params.id, { status: req.body.status });
    await audit.log(req, {
      action: 'STATUS_CHANGE', entityType: 'BRANCH', entityId: after.id,
      description: `Branch ${after.name} marked ${after.status}`,
    });
    res.json(after);
  });

router.get('/:id/users', requirePermission('BRANCH_VIEW'), async (req, res) => {
  res.json(await service.listUsers(req.params.id));
});

router.post('/:id/users', requirePermission('BRANCH_MANAGE'),
  validate(z.object({ user_ids: z.array(z.number().int().positive()).min(1, 'Select at least one user') })),
  async (req, res) => {
    const { branch, moved } = await service.allocateUsers(req.params.id, req.body.user_ids);
    await audit.log(req, {
      action: 'UPDATE', entityType: 'BRANCH', entityId: branch.id,
      description: `Allocated ${moved} user(s) to ${branch.name}`, details: { user_ids: req.body.user_ids },
    });
    res.json({ message: `${moved} user(s) allocated to ${branch.name}` });
  });

router.post('/:id/locations', requirePermission('BRANCH_MANAGE'), validate(locationSchema), async (req, res) => {
  const location = await service.addLocation(req.params.id, req.body);
  await audit.log(req, {
    action: 'CREATE', entityType: 'LOCATION', entityId: location.id, description: `Added location ${location.name}`,
  });
  res.status(201).json(location);
});

module.exports = router;
