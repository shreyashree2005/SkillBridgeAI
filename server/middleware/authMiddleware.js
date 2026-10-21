// server/middleware/authMiddleware.js

const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * WHY THIS FILE?
 * 
 * Middleware that protects routes
 * 
 * When user tries to access protected route:
 * 1. Extract token from request
 * 2. Verify token is valid
 * 3. Get user from database
 * 4. Attach user to request (so route can access it)
 * 5. If token invalid → return error
 * 
 * This is how professional apps work!
 */

const authMiddleware = async (req, res, next) => {
  try {
    // Step 1: Get token from header
    // Header looks like: "Authorization: Bearer <token>"
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login first.',
      });
    }

    // Extract token (remove "Bearer " prefix)
    // "Bearer abc123def456" → "abc123def456"
    const token = authHeader.split(' ')[1];

    // Step 2: Verify token
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Token invalid or expired. Please login again.',
      });
    }

    // Step 3: Get user from database using ID in token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Step 4: Attach user to request object
    // Now routes can access: req.user
    req.user = user;

    // Step 5: Move to next middleware/route
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

module.exports = authMiddleware;