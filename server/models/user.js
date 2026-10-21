// server/models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * WHY THIS FILE EXISTS?
 * 
 * This is the USER SCHEMA.
 * 
 * It defines:
 * - What fields a user has (name, email, password, etc)
 * - What type each field is (String, Number, Date)
 * - What validation rules apply
 * - What methods the user object has
 * 
 * MongoDB will automatically:
 * - Create a "users" collection
 * - Store user data according to this schema
 */

const userSchema = new mongoose.Schema({
  // Basic Info
  firstName: {
    type: String,
    required: [true, 'Please provide a first name'],
    trim: true,
  },

  lastName: {
    type: String,
    required: [true, 'Please provide a last name'],
    trim: true,
  },

  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },

  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password by default when fetching user
  },

  // Profile Info
  role: {
    type: String,
    enum: ['student', 'mentor', 'both'], // User can be student, mentor, or both
    default: 'student',
  },

  bio: {
    type: String,
    default: '',
  },

  profileImage: {
    type: String,
    default: null,
  },

  // Skills
  skills: [
    {
      name: String,
      level: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
      },
    },
  ],

  // Account Status
  isVerified: {
    type: Boolean,
    default: false,
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

/**
 * MIDDLEWARE: Hash password before saving
 * 
 * This runs BEFORE the user is saved to database
 * It takes the plain password and converts it to a secure hash
 * 
 * Why? Never store plain passwords! Always hash them.
 */
userSchema.pre('save', async function (next) {
  // If password wasn't modified, skip hashing
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt (random data for hashing)
    const salt = await bcrypt.genSalt(10);

    // Hash the password
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * METHOD: Compare password
 * 
 * Used during login to check if password is correct
 * Compares plain password with hashed password
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * METHOD: Get user data without password
 */
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);