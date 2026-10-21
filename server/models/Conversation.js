const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A one-to-one conversation. `key` (sorted participant ids) guarantees there
// is only one conversation per pair of users.
const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: ObjectId, ref: 'User', required: true }],
    key: { type: String, required: true, unique: true },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: '', maxlength: 140 },
    lastMessageSender: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.statics.keyFor = (a, b) => [String(a), String(b)].sort().join(':');

module.exports = mongoose.model('Conversation', conversationSchema);
