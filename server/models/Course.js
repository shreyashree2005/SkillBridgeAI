const mongoose = require('mongoose');

const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    durationMinutes: { type: Number, min: 1, max: 600, default: 30 },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    provider: { type: String, trim: true, maxlength: 80, default: 'SkillBridge Academy' },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    skills: { type: [String], default: [] },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    durationHours: { type: Number, min: 0, default: 1 },
    modules: { type: [moduleSchema], default: [] },
    url: { type: String, trim: true, default: '' },
    ratingAverage: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, min: 0, default: 0 },
    enrolledCount: { type: Number, min: 0, default: 0 },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

courseSchema.index({ skills: 1, level: 1 });
courseSchema.index({ title: 'text', description: 'text', skills: 'text' }, { name: 'course_text' });

module.exports = mongoose.model('Course', courseSchema);
