// Centralised error handling: every thrown error ends up here and is turned
// into a consistent JSON shape: { success: false, message, errors? }.
const mongoose = require('mongoose');
const multer = require('multer');
const logger = require('../utils/logger');

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message;
  let errors = err.details;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message || 'Validation failed';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'That record already exists.';
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large.' : err.message;
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request body too large.';
  }

  if (status >= 500) {
    logger.error(err);
    // Never leak internals (stack traces, DB errors) to clients.
    if (!err.isOperational) message = 'Something went wrong on the server.';
  }

  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) });
};

module.exports = { notFound, errorHandler };
