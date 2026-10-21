const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

// A request from a user to join someone's project team.
const joinRequestSchema = new mongoose.Schema(
  {
    project: { type: ObjectId, ref: 'Project', required: true, index: true },
    user: { type: ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

joinRequestSchema.index({ project: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('JoinRequest', joinRequestSchema);
