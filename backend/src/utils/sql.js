/**
 * sql.js
 * ------
 * Small helpers to avoid repeating the same SQL-building code in every module.
 */

/**
 * Build the "SET col1 = $1, col2 = $2" part of an UPDATE from an object.
 * Only keys listed in `allowed` are used (protects against unexpected columns).
 *
 *   buildUpdate({ name: 'A', city: 'B' }, ['name', 'city'])
 *   -> { setClause: 'name = $1, city = $2', values: ['A', 'B'] }
 */
function buildUpdate(data, allowed, startIndex = 1) {
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      values.push(data[key]);
      sets.push(`${key} = $${startIndex + values.length - 1}`);
    }
  }
  return { setClause: sets.join(', '), values };
}

/**
 * Read ?page=&limit= from the query string with safe defaults.
 * Returns the SQL LIMIT/OFFSET numbers.
 */
function pagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

/** Standard shape for every paginated list response. */
function paged(rows, total, { page, limit }) {
  return { data: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

module.exports = { buildUpdate, pagination, paged };
