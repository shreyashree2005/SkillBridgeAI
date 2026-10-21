const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Learning history: a user's enrollment and progress in a course.
const enrollmentSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    course: { type: ObjectId, ref: 'Course', required: true, index: true },
    completedModules: { type: [Number], default: [] }, // module indexes
    progress: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
    lastActivityAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });
enrollmentSchema.index({ user: 1, lastActivityAt: -1 });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
