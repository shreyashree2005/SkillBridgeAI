const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true },
    project: { type: ObjectId, ref: 'Project', required: true, index: true },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// A user can bookmark a project only once.
bookmarkSchema.index({ user: 1, project: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', bookmarkSchema);
