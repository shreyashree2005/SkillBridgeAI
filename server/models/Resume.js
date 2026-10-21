const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// Stores the extracted TEXT and analysis of a resume — not the file itself.
// This keeps storage small and avoids holding raw documents on the server.
const resumeSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    originalName: { type: String, required: true, trim: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    text: { type: String, required: true, maxlength: 100000, select: false },
    parsed: {
      skills: { type: [String], default: [] },
      sections: { type: [String], default: [] },
      yearsOfExperience: { type: Number, default: 0 },
      education: { type: [String], default: [] },
      wordCount: { type: Number, default: 0 },
    },
    analysis: {
      score: { type: Number, min: 0, max: 100, default: 0 },
      breakdown: [
        { _id: false, criterion: String, score: Number, max: Number, detail: String },
      ],
      strengths: { type: [String], default: [] },
      suggestions: { type: [String], default: [] },
    },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resume', resumeSchema);
