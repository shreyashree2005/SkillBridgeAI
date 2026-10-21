const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const TYPES = [
  'join-request', 'join-accepted', 'join-declined',
  'session-requested', 'session-updated', 'review-received',
  'message', 'application-update', 'course-completed', 'system',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TYPES, default: 'system' },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, trim: true, maxlength: 500, default: '' },
    link: { type: String, trim: true, maxlength: 200, default: '' }, // client route, e.g. /projects/123
    read: { type: Boolean, default: false },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.statics.TYPES = TYPES;

module.exports = mongoose.model('Notification', notificationSchema);
