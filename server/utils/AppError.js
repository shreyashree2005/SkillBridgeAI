// An error with an HTTP status code. Throw it anywhere in a controller or
// service; the central error handler turns it into a JSON response.
class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(msg, details) { return new AppError(400, msg, details); }
  static unauthorized(msg = 'Please log in to continue.') { return new AppError(401, msg); }
  static forbidden(msg = 'You are not allowed to do that.') { return new AppError(403, msg); }
  static notFound(msg = 'Resource not found.') { return new AppError(404, msg); }
  static conflict(msg) { return new AppError(409, msg); }
}

module.exports = AppError;
