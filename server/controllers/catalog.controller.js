const { Skill, RoleProfile } = require('../models/Catalog');
const { escapeRegex } = require('../utils/helpers');

// GET /api/catalog/skills?q= — skill autocomplete.
const listSkills = async (req, res) => {
  const { q, limit = 200 } = req.valid.query;
  const filter = q ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { aliases: new RegExp(escapeRegex(q), 'i') }] } : {};
  const skills = await Skill.find(filter).select('name category').sort({ name: 1 }).limit(limit);
  res.json({ success: true, data: { skills } });
};

// GET /api/catalog/roles — target career roles.
const listRoles = async (req, res) => {
  const roles = await RoleProfile.find().select('title description skills').sort({ title: 1 });
  res.json({ success: true, data: { roles } });
};

module.exports = { listSkills, listRoles };
