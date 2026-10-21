const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const careerGoalSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    targetRole: { type: String, required: true, trim: true, maxlength: 80 },
    targetDate: { type: Date },
    hoursPerWeek: { type: Number, min: 1, max: 60, default: 8 },
    status: { type: String, enum: ['active', 'achieved', 'paused'], default: 'active' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CareerGoal', careerGoalSchema);
