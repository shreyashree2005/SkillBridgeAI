// server/middleware/authMiddleware.js
//
// Protects routes. Reads "Authorization: Bearer <token>", verifies it,
// loads the user and attaches it as req.user. Rejects tokens issued before
// the user's last logout (tokenVersion mismatch).

const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const extractBearer = (header) =>
  header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;

// Shared by HTTP middleware and Socket.IO handshake.
const authenticateToken = async (token) => {
  if (!token) throw AppError.unauthorized('No token provided. Please log in first.');
  const decoded = verifyToken(token);
  if (!decoded) throw AppError.unauthorized('Session invalid or expired. Please log in again.');

  const user = await User.findById(decoded.id).select('+tokenVersion');
  if (!user || !user.isActive) throw AppError.unauthorized('Account not found or disabled.');
  if ((user.tokenVersion || 0) !== (decoded.v || 0)) {
    throw AppError.unauthorized('Session has ended. Please log in again.');
  }
  return user;
};

const authMiddleware = async (req, res, next) => {
  req.user = await authenticateToken(extractBearer(req.headers.authorization));
  next();
};

module.exports = authMiddleware;
module.exports.authenticateToken = authenticateToken;
