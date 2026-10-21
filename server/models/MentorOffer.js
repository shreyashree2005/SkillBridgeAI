const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A teaching offer: "I can mentor you in <skill>".
const mentorOfferSchema = new mongoose.Schema(
  {
    mentor: { type: ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 120 },
    skill: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    sessionMinutes: { type: Number, enum: [30, 45, 60, 90], default: 60 },
    mode: { type: String, enum: ['online', 'in-person'], default: 'online' },
    isActive: { type: Boolean, default: true },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

mentorOfferSchema.index({ skill: 1, isActive: 1 });
mentorOfferSchema.index({ title: 'text', skill: 'text', description: 'text' }, { name: 'offer_text' });

module.exports = mongoose.model('MentorOffer', mentorOfferSchema);
