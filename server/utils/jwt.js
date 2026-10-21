// server/utils/jwt.js
//
// Handles all JWT operations. The token contains the user id and a
// "token version". Logging out bumps the version stored on the user, which
// instantly invalidates every token issued before (real server-side logout).

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const generateToken = (user) =>
  jwt.sign({ id: String(user._id), v: user.tokenVersion || 0 }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

// Returns the decoded payload, or null if the token is invalid or expired.
const verifyToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }
};

module.exports = { generateToken, verifyToken };
