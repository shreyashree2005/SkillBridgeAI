// Reference data: the skill taxonomy and target-role profiles.
// Seeded from datasets/skills.json and datasets/roles.json.
const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  category: { type: String, default: 'other' },
  aliases: { type: [String], default: [] },
  prerequisites: { type: [String], default: [] },
});

const roleSchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
  skills: [{ _id: false, name: String, weight: Number }],
});

const Skill = mongoose.model('Skill', skillSchema);
const RoleProfile = mongoose.model('RoleProfile', roleSchema);

module.exports = { Skill, RoleProfile };
