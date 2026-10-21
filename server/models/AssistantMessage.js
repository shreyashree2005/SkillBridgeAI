const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Career-assistant chat history (one thread per user).
const assistantMessageSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    provider: { type: String, default: '' }, // which engine produced the reply
    sources: { type: [String], default: [] },
  },
  { timestamps: true }
);

assistantMessageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('AssistantMessage', assistantMessageSchema);
