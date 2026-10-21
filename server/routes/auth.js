// server/routes/auth.js
const express = require('express');
const ctrl = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');
const v = require('../validators');

const router = express.Router();

router.post('/register', authLimiter, validate({ body: v.auth.register }), ctrl.register);
router.post('/signup', authLimiter, validate({ body: v.auth.register }), ctrl.register); // original route name kept
router.post('/login', authLimiter, validate({ body: v.auth.login }), ctrl.login);
router.post('/logout', authMiddleware, ctrl.logout);
router.get('/me', authMiddleware, ctrl.me);

module.exports = router;
