// Rate limiting.
//
// Students often share one public IP (campus or hostel NAT), so limits are keyed
// by ACCOUNT where possible instead of only by IP:
//   - login/register: per email+IP (stops brute force on one account) plus a
//     generous per-IP backstop (stops spraying many accounts),
//   - API and AI calls: per logged-in user (anonymous requests fall back to IP).
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const env = require('../config/env');
const { verifyToken } = require('../utils/jwt');

const ipKey = (req) => ipKeyGenerator(req.ip || '');

// Identify the caller from the bearer token without a DB lookup (auth runs later).
const userOrIpKey = (req) => {
  const header = req.headers.authorization || '';
  const decoded = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  return decoded?.id ? `user:${decoded.id}` : `ip:${ipKey(req)}`;
};

const make = ({ windowMs, limit, message, keyGenerator = ipKey }) =>
  rateLimit({
    windowMs,
    limit,
    keyGenerator,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.isTest,
    message: { success: false, message },
  });

const FIFTEEN_MIN = 15 * 60 * 1000;

const authPerAccount = make({
  windowMs: FIFTEEN_MIN,
  limit: 10,
  message: 'Too many attempts for this account. Please try again in 15 minutes.',
  keyGenerator: (req) => `${ipKey(req)}|${String(req.body?.email || '').trim().toLowerCase().slice(0, 254)}`,
});
const authPerIp = make({
  windowMs: FIFTEEN_MIN,
  limit: 100,
  message: 'Too many login attempts from this network. Please try again later.',
});
const authLimiter = [authPerIp, authPerAccount];

// AI endpoints are CPU heavy.
const aiLimiter = make({ windowMs: 60 * 1000, limit: 30, message: 'Too many AI requests. Please slow down.', keyGenerator: userOrIpKey });
const apiLimiter = make({ windowMs: 60 * 1000, limit: 300, message: 'Too many requests. Please slow down.', keyGenerator: userOrIpKey });

module.exports = { authLimiter, aiLimiter, apiLimiter };
