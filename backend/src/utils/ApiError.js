/**
 * ApiError
 * --------
 * Throw this anywhere in a route or service to send a clean error
 * response. The central error handler (middleware/errorHandler.js)
 * turns it into JSON:  { "error": { "message": "...", "details": ... } }
 *
 *   throw ApiError.notFound('User not found');
 */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;   // HTTP status code
    this.details = details; // optional extra info (e.g. validation errors)
  }

  static badRequest(msg, details) { return new ApiError(400, msg, details); }
  static unauthorized(msg = 'Please log in') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to do this') { return new ApiError(403, msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, msg); }
  static conflict(msg) { return new ApiError(409, msg); }
  static tooMany(msg) { return new ApiError(429, msg); }
}

module.exports = ApiError;
