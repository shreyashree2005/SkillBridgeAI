// server/models/User.js
//
// The USER schema: identity, login credentials, public profile and skills.
// Passwords are hashed with bcrypt before saving and never returned in JSON.

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    level: { type: String, enum: SKILL_LEVELS, default: 'beginner' },
    yearsOfExperience: { type: Number, min: 0, max: 50, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // Basic info
    firstName: { type: String, required: [true, 'Please provide a first name'], trim: true, maxlength: 50 },
    lastName: { type: String, required: [true, 'Please provide a last name'], trim: true, maxlength: 50 },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned unless explicitly requested
    },
    // Bumped on logout to invalidate all previously issued tokens.
    tokenVersion: { type: Number, default: 0, select: false },

    // Profile info
    role: { type: String, enum: ['student', 'mentor', 'both'], default: 'student' },
    headline: { type: String, trim: true, maxlength: 120, default: '' },
    bio: { type: String, trim: true, maxlength: 1500, default: '' },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    university: { type: String, trim: true, maxlength: 120, default: '' },
    graduationYear: { type: Number, min: 1980, max: 2040 },
    profileImage: { type: String, default: null },
    links: {
      github: { type: String, trim: true, maxlength: 200, default: '' },
      linkedin: { type: String, trim: true, maxlength: 200, default: '' },
      portfolio: { type: String, trim: true, maxlength: 200, default: '' },
    },

    // Skills & interests
    skills: { type: [skillSchema], default: [] },
    interests: { type: [String], default: [] },

    // Team finder
    lookingForTeam: { type: Boolean, default: false },
    availability: { type: String, enum: ['full-time', 'part-time', 'weekends', 'unavailable'], default: 'part-time' },

    // Mentor reputation (recomputed from reviews)
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },

    // Account status
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isSynthetic: { type: Boolean, default: false }, // generated demo data
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ 'skills.name': 1 });
userSchema.index({ lookingForTeam: 1, role: 1 });
userSchema.index(
  { firstName: 'text', lastName: 'text', headline: 'text', 'skills.name': 'text', bio: 'text' },
  { weights: { 'skills.name': 5, headline: 3, firstName: 4, lastName: 4 }, name: 'user_text' }
);

userSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

/**
 * MIDDLEWARE: Hash password before saving.
 * (Mongoose 9 no longer passes `next` to hooks — an async function is enough.)
 */
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

/** METHOD: Compare a plain password with the stored hash (used at login). */
userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

/** Remove secrets whenever a user is converted to JSON. */
userSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.tokenVersion;
    delete ret.__v;
    delete ret.id;
    return ret;
  },
});

// Fields that are safe to show to other users.
userSchema.statics.PUBLIC_FIELDS =
  'firstName lastName role headline bio location university graduationYear profileImage links skills interests lookingForTeam availability ratingAverage ratingCount isSynthetic createdAt lastSeenAt';
userSchema.statics.CARD_FIELDS = 'firstName lastName headline profileImage skills role ratingAverage ratingCount lookingForTeam availability';
userSchema.statics.SKILL_LEVELS = SKILL_LEVELS;

module.exports = mongoose.model('User', userSchema);
