// server/utils/jwt.js

const jwt = require('jsonwebtoken');

/**
 * WHY THIS FILE?
 * 
 * Handles all JWT operations:
 * - Generate tokens
 * - Verify tokens
 * - Extract user from token
 * 
 * Keeps code organized and reusable
 */

/**
 * GENERATE TOKEN
 * 
 * Creates a JWT token when user logs in
 * Token contains user ID
 * Token expires in 7 days
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId }, // Data inside token
    process.env.JWT_SECRET, // Secret key to sign it
    { expiresIn: '7d' } // Token expires in 7 days
  );
};

/**
 * VERIFY TOKEN
 * 
 * Checks if token is valid and not expired
 * Returns the user ID from inside the token
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};