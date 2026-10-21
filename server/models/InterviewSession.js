const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const questionSchema = new mongoose.Schema(
  {
    qid: { type: String, required: true },
    question: { type: String, required: true },
    skill: { type: String, default: '' },
    type: { type: String, enum: ['technical', 'behavioral', 'conceptual'], default: 'technical' },
    expectedPoints: { type: [String], default: [] },
    answer: { type: String, maxlength: 5000, default: '' },
    evaluation: {
      score: { type: Number, min: 0, max: 100 },
      criteria: [{ _id: false, name: String, score: Number, max: Number, detail: String }],
      feedback: { type: [String], default: undefined },
      coveredPoints: { type: [String], default: undefined },
      missedPoints: { type: [String], default: undefined },
    },
  },
  { _id: false }
);

const interviewSessionSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true, trim: true },
    questions: { type: [questionSchema], default: [] },
    overallScore: { type: Number, min: 0, max: 100 },
    status: { type: String, enum: ['in-progress', 'completed'], default: 'in-progress' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InterviewSession', interviewSessionSchema);
