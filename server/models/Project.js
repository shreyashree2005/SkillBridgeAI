const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const projectSchema = new mongoose.Schema(
  {
    owner: { type: ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 3, maxlength: 120 },
    summary: { type: String, trim: true, maxlength: 200, default: '' },
    description: { type: String, required: [true, 'Description is required'], trim: true, minlength: 20, maxlength: 5000 },
    category: {
      type: String,
      enum: ['web', 'mobile', 'ai-ml', 'data', 'devops', 'security', 'game', 'iot', 'blockchain', 'other'],
      default: 'web',
    },
    techStack: { type: [String], default: [] },
    rolesNeeded: { type: [String], default: [] }, // skills the team still needs
    status: { type: String, enum: ['idea', 'in-progress', 'completed'], default: 'idea' },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    repoUrl: { type: String, trim: true, maxlength: 300, default: '' },
    demoUrl: { type: String, trim: true, maxlength: 300, default: '' },
    members: [{ type: ObjectId, ref: 'User' }],
    maxTeamSize: { type: Number, min: 1, max: 20, default: 4 },
    lookingForMembers: { type: Boolean, default: true },
    bookmarkCount: { type: Number, default: 0, min: 0 },
    isSynthetic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

projectSchema.index({ techStack: 1 });
projectSchema.index({ lookingForMembers: 1, createdAt: -1 });
projectSchema.index({ members: 1 });
projectSchema.index(
  { title: 'text', summary: 'text', description: 'text', techStack: 'text' },
  { weights: { title: 5, techStack: 4, summary: 2, description: 1 }, name: 'project_text' }
);

module.exports = mongoose.model('Project', projectSchema);
