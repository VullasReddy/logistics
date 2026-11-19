/**
 * subscriptions.routes.js  (Module 6)
 * -----------------------
 *   GET   /api/subscriptions/plans             SUBSCRIPTION_VIEW    plans + active users
 *   POST  /api/subscriptions/plans             SUBSCRIPTION_MANAGE  create plan
 *   PUT   /api/subscriptions/plans/:id         SUBSCRIPTION_MANAGE  modify plan
 *   GET   /api/subscriptions/renewals/upcoming SUBSCRIPTION_VIEW    ending in ?days=30
 *   GET   /api/subscriptions                   SUBSCRIPTION_VIEW    list (?search=&plan_id=&status=)
 *   GET   /api/subscriptions/:id               SUBSCRIPTION_VIEW    one + renewal history
 *   POST  /api/subscriptions                   SUBSCRIPTION_MANAGE  new subscription
 *   PUT   /api/subscriptions/:id               SUBSCRIPTION_MANAGE  edit (validity dates etc.)
 *   POST  /api/subscriptions/:id/renew         SUBSCRIPTION_MANAGE  renew { plan_id?, periods? }
 *   POST  /api/subscriptions/:id/cancel        SUBSCRIPTION_MANAGE  cancel
 */
const express = require('express');
const { z } = require('zod');
const validate = require('../../middleware/validate');
const { authenticate, requirePermission } = require('../../middleware/auth');
const audit = require('../../utils/audit');
const service = require('./subscriptions.service');

const router = express.Router();
router.use(authenticate);

const VIEW = requirePermission('SUBSCRIPTION_VIEW');
const MANAGE = requirePermission('SUBSCRIPTION_MANAGE');

const planSchema = z.object({
  name: z.string().trim().min(2, 'Plan name is required').max(60),
  description: z.string().trim().max(255).optional(),
  price_monthly: z.coerce.number().min(0, 'Price cannot be negative'),
  duration_days: z.coerce.number().int().min(1).max(3650).optional(),
  max_users: z.coerce.number().int().min(1).optional(),
  max_vehicles: z.coerce.number().int().min(1).optional(),
  features: z.array(z.string().trim().min(1)).optional(),
  is_popular: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

// Base fields (no cross-field rule yet, so we can also make a "partial" version for edits)
const subscriptionFields = z.object({
  customer_name: z.string().trim().min(2, 'Customer name is required').max(150),
  customer_email: z.email('Enter a valid email').optional().or(z.literal('')),
  plan_id: z.coerce.number().int().positive('Select a plan'),
  active_users: z.coerce.number().int().min(0).optional(),
  start_date: z.iso.date('Start date must be YYYY-MM-DD'),
  end_date: z.iso.date('End date must be YYYY-MM-DD').optional().or(z.literal('')),
  auto_renew: z.boolean().optional(),
});

// Rule: end date cannot be before start date (checked when both are sent).
const datesInOrder = [
  (d) => !d.end_date || !d.start_date || d.end_date >= d.start_date,
  { message: 'End date must be on or after the start date', path: ['end_date'] },
];
const subscriptionSchema = subscriptionFields.refine(...datesInOrder);
const subscriptionUpdateSchema = subscriptionFields.partial().refine(...datesInOrder);

const renewSchema = z.object({
  plan_id: z.coerce.number().int().positive().optional(),
  periods: z.coerce.number().int().min(1).max(36).optional(),
});

/* ----- Plans ----- */
router.get('/plans', requirePermission('SUBSCRIPTION_VIEW', 'DASHBOARD_VIEW'), async (req, res) => {
  res.json(await service.listPlans());
});

router.post('/plans', MANAGE, validate(planSchema), async (req, res) => {
  const plan = await service.createPlan(req.body);
  await audit.log(req, { action: 'CREATE', entityType: 'PLAN', entityId: plan.id, description: `Created plan ${plan.name}` });
  res.status(201).json(plan);
});

router.put('/plans/:id', MANAGE, validate(planSchema.partial()), async (req, res) => {
  const { before, after } = await service.updatePlan(req.params.id, req.body);
  await audit.log(req, {
    action: 'UPDATE', entityType: 'PLAN', entityId: after.id,
    description: `Modified plan ${after.name}`, details: audit.diff(before, req.body),
  });
  res.json(after);
});

/* ----- Renewal tracking ----- */
router.get('/renewals/upcoming', requirePermission('SUBSCRIPTION_VIEW', 'DASHBOARD_VIEW'), async (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  res.json(await service.upcomingRenewals(days));
});

/* ----- Subscriptions ----- */
router.get('/', VIEW, async (req, res) => {
  res.json(await service.list(req.query));
});

router.get('/:id', VIEW, async (req, res) => {
  res.json(await service.getById(req.params.id));
});

router.post('/', MANAGE, validate(subscriptionSchema), async (req, res) => {
  const sub = await service.create(req.body);
  await audit.log(req, {
    action: 'CREATE', entityType: 'SUBSCRIPTION', entityId: sub.id,
    description: `New ${sub.plan_name} subscription for ${sub.customer_name}`,
  });
  res.status(201).json(sub);
});

router.put('/:id', MANAGE, validate(subscriptionUpdateSchema), async (req, res) => {
  const { before, after } = await service.update(req.params.id, req.body);
  await audit.log(req, {
    action: 'UPDATE', entityType: 'SUBSCRIPTION', entityId: after.id,
    description: `Updated subscription of ${after.customer_name}`, details: audit.diff(before, req.body),
  });
  res.json(after);
});

router.post('/:id/renew', MANAGE, validate(renewSchema), async (req, res) => {
  const sub = await service.renew(req.params.id, req.body, req.user.id);
  await audit.log(req, {
    action: 'UPDATE', entityType: 'SUBSCRIPTION', entityId: sub.id,
    description: `Renewed ${sub.plan_name} plan for ${sub.customer_name} until ${sub.end_date}`,
  });
  res.json(sub);
});

router.post('/:id/cancel', MANAGE, async (req, res) => {
  const sub = await service.cancel(req.params.id);
  await audit.log(req, {
    action: 'STATUS_CHANGE', entityType: 'SUBSCRIPTION', entityId: sub.id,
    description: `Cancelled subscription of ${sub.customer_name}`,
  });
  res.json(sub);
});

module.exports = router;
