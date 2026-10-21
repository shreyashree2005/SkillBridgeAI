// Validates req.body / req.query / req.params with a zod schema.
// The cleaned values are stored on req.valid (Express 5 makes req.query read-only).
const AppError = require('../utils/AppError');

const validate = (schemas) => (req, res, next) => {
  req.valid = req.valid || {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const errors = result.error.issues.map((i) => ({
        field: i.path.join('.') || part,
        message: i.message,
      }));
      throw AppError.badRequest(errors[0]?.message || 'Invalid input', errors);
    }
    req.valid[part] = result.data;
  }
  next();
};

module.exports = validate;
