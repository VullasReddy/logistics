/**
 * auth.routes.js  (Module 1)
 * --------------
 *   POST /api/auth/login            public   - email + password -> JWT
 *   POST /api/auth/logout           logged in - ends this session
 *   GET  /api/auth/me               logged in - current user + permissions
 *   POST /api/auth/change-password  logged in - change own password
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const audit = require('../../utils/audit');
const service = require('./auth.service');

const router = express.Router();

// Extra protection: max 20 login requests per IP every 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: { message: 'Too many login requests, please wait a few minutes' } },
  skip: () => process.env.NODE_ENV === 'test',
});

// Password rule: 8+ chars with upper case, lower case, number and symbol.
const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password needs an upper case letter')
  .regex(/[a-z]/, 'Password needs a lower case letter')
  .regex(/[0-9]/, 'Password needs a number')
  .regex(/[^A-Za-z0-9]/, 'Password needs a special character');

const loginSchema = z.object({
  email: z.email('Enter a valid email').transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: strongPassword,
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const result = await service.login(email, password, (user) =>
    audit.log(req, {
      action: 'LOGIN_FAILED', entityType: 'USER', entityId: user?.id,
      description: `Failed login attempt for ${email}`, user: { id: user?.id, email },
    }));

  await audit.log(req, {
    action: 'LOGIN', entityType: 'USER', entityId: result.user.id,
    description: `${result.user.full_name} logged in`, user: result.user,
  });
  res.json(result);
});

router.post('/logout', authenticate, async (req, res) => {
  await service.logout(req.token);
  await audit.log(req, {
    action: 'LOGOUT', entityType: 'USER', entityId: req.user.id,
    description: `${req.user.full_name} logged out`,
  });
  res.json({ message: 'Logged out' });
});

router.get('/me', authenticate, async (req, res) => {
  res.json({ user: await service.publicUser(req.user.id) });
});

router.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res) => {
  await service.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  await audit.log(req, {
    action: 'PASSWORD_CHANGE', entityType: 'USER', entityId: req.user.id,
    description: `${req.user.full_name} changed their password`,
  });
  res.json({ message: 'Password changed successfully' });
});

module.exports = router;
module.exports.strongPassword = strongPassword; // reused by the users module
