/**
 * errorHandler.js
 * ---------------
 * The LAST middleware in app.js. Any error thrown in any route ends up
 * here and is turned into a consistent JSON response.
 *
 * Express 5 automatically forwards errors from async handlers, so route
 * code can simply `throw` - no try/catch needed in every route.
 */
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Our own errors: send exactly what we threw.
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { message: err.message, details: err.details } });
  }

  // Common PostgreSQL errors -> friendly messages.
  if (err.code === '23505') { // unique_violation
    return res.status(409).json({ error: { message: 'A record with the same value already exists', details: err.detail } });
  }
  if (err.code === '22P02') { // invalid_text_representation, e.g. /api/users/abc
    return res.status(400).json({ error: { message: 'Invalid id or value in request' } });
  }
  if (err.code === '23503') { // foreign_key_violation
    return res.status(409).json({ error: { message: 'This record is linked to other records and cannot be changed this way' } });
  }

  // Uploaded file too big (multer).
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: { message: 'File is too large (max 2 MB)' } });
  }

  // Bad JSON body.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'Invalid JSON in request body' } });
  }

  // Anything else is a bug: log it fully, but don't leak details to the client.
  console.error('[error]', err);
  return res.status(500).json({ error: { message: 'Something went wrong on the server' } });
}

module.exports = errorHandler;
