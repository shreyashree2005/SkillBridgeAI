const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    externalId: { type: String, unique: true, sparse: true }, // stable id from the dataset
    title: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, required: true, trim: true, maxlength: 120 },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    employmentType: { type: String, enum: ['full-time', 'part-time', 'internship', 'contract'], default: 'full-time' },
    remote: { type: Boolean, default: false },
    experienceLevel: { type: String, enum: ['internship', 'entry', 'mid', 'senior'], default: 'entry' },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    requiredSkills: { type: [String], default: [] },
    niceToHaveSkills: { type: [String], default: [] },
    minYearsExperience: { type: Number, min: 0, max: 20, default: 0 },
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    currency: { type: String, default: 'USD', maxlength: 3 },
    postedAt: { type: Date, default: Date.now },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

jobSchema.index({ requiredSkills: 1 });
jobSchema.index({ postedAt: -1 });
jobSchema.index(
  { title: 'text', company: 'text', description: 'text', requiredSkills: 'text' },
  { weights: { title: 5, requiredSkills: 4, company: 2, description: 1 }, name: 'job_text' }
);

module.exports = mongoose.model('Job', jobSchema);
