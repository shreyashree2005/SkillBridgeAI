const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const make = (windowMs, limit, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { success: false, message },
  });

// Brute-force protection for login/register.
const authLimiter = make(15 * 60 * 1000, 20, 'Too many attempts. Please try again in 15 minutes.');
// AI endpoints are CPU heavy.
const aiLimiter = make(60 * 1000, 30, 'Too many AI requests. Please slow down.');
const apiLimiter = make(60 * 1000, 300, 'Too many requests. Please slow down.');

module.exports = { authLimiter, aiLimiter, apiLimiter };
