/**
 * settings.routes.js  (Module 7 - Configuration and System Settings)
 * ------------------
 * Settings are key/value rows grouped into 4 categories:
 *   APPLICATION, NOTIFICATION, OPERATIONAL, PREFERENCE
 *
 *   GET /api/settings      SETTINGS_VIEW    all settings, grouped by category
 *   PUT /api/settings      SETTINGS_UPDATE  { "values": { "app.timezone": "UTC", ... } }
 *
 * New settings are added by developers in db/seed.js (with their type),
 * the UI then shows them automatically.
 */
const express = require('express');
const { z } = require('zod');
const db = require('../../config/db');
const validate = require('../../middleware/validate');
const { authenticate, requirePermission } = require('../../middleware/auth');
const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');

const router = express.Router();
router.use(authenticate);

async function getAll() {
  const { rows } = await db.query(
    `SELECT s.key, s.value, s.category, s.label, s.value_type, s.options, s.updated_at,
            u.full_name AS updated_by_name
       FROM settings s LEFT JOIN users u ON u.id = s.updated_by
      ORDER BY s.category, s.key`,
  );
  return rows;
}

/** Make sure a value matches the setting's declared type. */
function checkValue(setting, value) {
  const fail = (msg) => { throw ApiError.badRequest(`${setting.label}: ${msg}`); };
  switch (setting.value_type) {
    case 'boolean': if (typeof value !== 'boolean') fail('must be true or false'); break;
    case 'number': if (typeof value !== 'number' || Number.isNaN(value) || value < 0) fail('must be a positive number'); break;
    case 'select': if (!setting.options.includes(value)) fail(`must be one of ${setting.options.join(', ')}`); break;
    default: if (typeof value !== 'string' || value.length > 500) fail('must be text (max 500 characters)');
  }
}

router.get('/', requirePermission('SETTINGS_VIEW'), async (req, res) => {
  const all = await getAll();
  // Group: { APPLICATION: [...], NOTIFICATION: [...], ... }
  const grouped = {};
  for (const s of all) (grouped[s.category] ||= []).push(s);
  res.json(grouped);
});

router.put('/', requirePermission('SETTINGS_UPDATE'),
  validate(z.object({ values: z.record(z.string(), z.any()) })), async (req, res) => {
    const all = await getAll();
    const byKey = Object.fromEntries(all.map((s) => [s.key, s]));
    const changes = {};

    // Validate everything first, so we never save half of the changes.
    for (const [key, value] of Object.entries(req.body.values)) {
      const setting = byKey[key];
      if (!setting) throw ApiError.badRequest(`Unknown setting: ${key}`);
      checkValue(setting, value);
      if (JSON.stringify(setting.value) !== JSON.stringify(value)) changes[key] = { from: setting.value, to: value };
    }

    await db.transaction(async (client) => {
      for (const key of Object.keys(changes)) {
        await client.query(
          'UPDATE settings SET value = $1, updated_by = $2, updated_at = NOW() WHERE key = $3',
          [JSON.stringify(changes[key].to), req.user.id, key],
        );
      }
    });

    if (Object.keys(changes).length) {
      await audit.log(req, {
        action: 'UPDATE', entityType: 'SETTINGS', description: 'Updated system settings', details: changes,
      });
    }
    res.json({ message: `${Object.keys(changes).length} setting(s) updated` });
  });

module.exports = router;
