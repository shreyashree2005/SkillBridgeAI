const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const STATUSES = ['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

// Job application tracker entry.
const applicationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    job: { type: ObjectId, ref: 'Job', required: true },
    status: { type: String, enum: STATUSES, default: 'saved' },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    matchScore: { type: Number, min: 0, max: 100 },
    appliedAt: { type: Date },
    statusHistory: [
      {
        _id: false,
        status: { type: String, enum: STATUSES },
        at: { type: Date, default: Date.now },
      },
    ],
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

applicationSchema.index({ user: 1, job: 1 }, { unique: true });
applicationSchema.index({ user: 1, status: 1, updatedAt: -1 });
applicationSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('Application', applicationSchema);
