// server/routes/auth.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken } = require('../utils/jwt'); // ADD THIS
const authMiddleware = require('../middleware/authMiddleware'); // ADD THIS

/**
 * ROUTE: POST /api/auth/signup
 * 
 * Creates a new user account and returns JWT token
 */
router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    // Create new user
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: role || 'student',
    });

    // GENERATE JWT TOKEN - NO LONGER A PLACEHOLDER
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: user.toJSON(),
        token, // Real JWT token!
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * ROUTE: POST /api/auth/login
 * 
 * Authenticates user and returns JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find user and include password field
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check password
    const isPasswordValid = await user.matchPassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // GENERATE JWT TOKEN - NO LONGER A PLACEHOLDER
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token, // Real JWT token!
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * ROUTE: GET /api/auth/me
 * 
 * Get current logged-in user
 * 
 * REQUIRES: Authorization header with JWT token
 * 
 * Header format:
 * Authorization: Bearer <jwt_token>
 * 
 * Uses authMiddleware to verify token and get user
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    // authMiddleware already attached user to req.user
    res.status(200).json({
      success: true,
      message: 'Current user retrieved',
      data: {
        user: req.user.toJSON(),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;