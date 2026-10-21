const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const STATUSES = ['requested', 'accepted', 'declined', 'completed', 'cancelled'];

const mentorSessionSchema = new mongoose.Schema(
  {
    offer: { type: ObjectId, ref: 'MentorOffer', required: true },
    mentor: { type: ObjectId, ref: 'User', required: true, index: true },
    learner: { type: ObjectId, ref: 'User', required: true, index: true },
    skill: { type: String, trim: true, maxlength: 60 },
    scheduledAt: { type: Date, required: true },
    durationMinutes: { type: Number, min: 15, max: 180, default: 60 },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    meetingLink: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: STATUSES, default: 'requested' },
    reviewed: { type: Boolean, default: false },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

mentorSessionSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model('MentorSession', mentorSessionSchema);
