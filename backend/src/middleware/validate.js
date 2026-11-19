/**
 * validate.js
 * -----------
 * Checks req.body (or req.query) against a Zod schema BEFORE the
 * handler runs. If invalid, the request is stopped with a 400 error
 * listing every problem. If valid, req.body is replaced with the
 * cleaned data (extra unknown fields are removed).
 *
 *   const schema = z.object({ name: z.string().min(2) });
 *   router.post('/', validate(schema), handler);
 */
const ApiError = require('../utils/ApiError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      throw ApiError.badRequest('Please check the highlighted fields', details);
    }
    if (source === 'body') req.body = result.data;
    else req.validated = result.data; // req.query is read-only in Express 5
    next();
  };
}

module.exports = validate;
