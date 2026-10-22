const bcrypt = require('bcryptjs');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { generateToken } = require('../utils/jwt');

const authResponse = (res, status, message, user) =>
  res.status(status).json({ success: true, message, data: { user: user.toJSON(), token: generateToken(user) } });

// POST /api/auth/register (alias: /signup)
const register = async (req, res) => {
  const { firstName, lastName, email, password, role } = req.valid.body;
  if (await User.exists({ email })) throw AppError.conflict('Email already registered.');
  const user = await User.create({ firstName, lastName, email, password, role });
  authResponse(res, 201, 'Account created successfully.', user);
};

// A real bcrypt hash (cost 12) of a random string, compared against when the email is unknown.
const DUMMY_HASH = bcrypt.hashSync(require('crypto').randomBytes(16).toString('hex'), 12);

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email }).select('+password +tokenVersion');
  // Same message AND similar timing for unknown email and wrong password, so
  // attackers can't discover which emails are registered.
  const valid = user ? await user.matchPassword(password) : await bcrypt.compare(password, DUMMY_HASH).then(() => false);
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password.');
  }
  if (!user.isActive) throw AppError.forbidden('This account is disabled.');
  user.lastSeenAt = new Date();
  await user.save();
  authResponse(res, 200, 'Login successful.', user);
};

// POST /api/auth/logout — invalidates every token issued to this user.
const logout = async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: 'Logged out.' });
};

// GET /api/auth/me
const me = (req, res) => {
  res.json({ success: true, data: { user: req.user.toJSON() } });
};

module.exports = { register, login, logout, me };
