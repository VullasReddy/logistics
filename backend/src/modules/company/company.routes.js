/**
 * company.routes.js  (Module 5 - Company Profile Management)
 * -----------------
 * The company profile is a single row (id = 1), so there is no list,
 * create or delete - only read and update.
 *
 *   GET  /api/company        COMPANY_VIEW    profile
 *   PUT  /api/company        COMPANY_UPDATE  edit details / registration info
 *   POST /api/company/logo   COMPANY_UPDATE  upload logo (multipart field "logo")
 *
 * The SQL is small, so this module keeps it in the route file.
 */
const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const db = require('../../config/db');
const validate = require('../../middleware/validate');
const { authenticate, requirePermission } = require('../../middleware/auth');
const ApiError = require('../../utils/ApiError');
const audit = require('../../utils/audit');
const { buildUpdate } = require('../../utils/sql');
const { saveFile } = require('../../utils/storage');

const router = express.Router();
router.use(authenticate);

const FIELDS = ['name', 'legal_name', 'tagline', 'email', 'phone', 'website', 'address', 'city',
  'state', 'country', 'pincode', 'gstin', 'pan', 'cin', 'registration_date'];

const text = (max) => z.string().trim().max(max).optional().or(z.literal(''));

const companySchema = z.object({
  name: z.string().trim().min(2, 'Company name is required').max(150),
  legal_name: text(200),
  tagline: text(200),
  email: z.email('Enter a valid email').optional().or(z.literal('')),
  phone: text(20),
  website: z.url('Enter a full URL, e.g. https://example.com').optional().or(z.literal('')),
  address: text(255),
  city: text(80),
  state: text(80),
  country: text(80),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits').optional().or(z.literal('')),
  // Indian business registration formats:
  gstin: z.string().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, 'Invalid GSTIN (15 characters)').optional().or(z.literal('')),
  pan: z.string().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN (e.g. ABCDE1234F)').optional().or(z.literal('')),
  cin: z.string().toUpperCase().regex(/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, 'Invalid CIN (21 characters)').optional().or(z.literal('')),
  registration_date: z.iso.date('Use YYYY-MM-DD').optional().or(z.literal('')).transform((v) => v || null),
}).partial();

// Keep the uploaded file in memory (max 2 MB), images only.
// SVG is NOT allowed on purpose: an SVG can contain JavaScript (XSS risk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : ApiError.badRequest('Logo must be PNG, JPG or WEBP'), ok);
  },
});

async function getProfile() {
  const { rows } = await db.query('SELECT * FROM company_profile WHERE id = 1');
  return rows[0] || null;
}

router.get('/', requirePermission('COMPANY_VIEW', 'DASHBOARD_VIEW'), async (req, res) => {
  res.json(await getProfile());
});

router.put('/', requirePermission('COMPANY_UPDATE'), validate(companySchema), async (req, res) => {
  const before = await getProfile();
  const { setClause, values } = buildUpdate(req.body, FIELDS);
  if (setClause) await db.query(`UPDATE company_profile SET ${setClause}, updated_at = NOW() WHERE id = 1`, values);
  const after = await getProfile();
  await audit.log(req, {
    action: 'UPDATE', entityType: 'COMPANY', entityId: 1,
    description: 'Updated company profile', details: audit.diff(before, req.body),
  });
  res.json(after);
});

router.post('/logo', requirePermission('COMPANY_UPDATE'), upload.single('logo'), async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Choose an image file to upload (field name "logo")');
  const url = await saveFile(req.file.buffer, req.file.originalname, req.file.mimetype, 'logos');
  await db.query('UPDATE company_profile SET logo_url = $1, updated_at = NOW() WHERE id = 1', [url]);
  await audit.log(req, { action: 'UPDATE', entityType: 'COMPANY', entityId: 1, description: 'Updated company logo' });
  res.json(await getProfile());
});

module.exports = router;
