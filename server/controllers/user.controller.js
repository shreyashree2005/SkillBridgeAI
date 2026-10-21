const User = require('../models/User');
const Project = require('../models/Project');
const Review = require('../models/Review');
const MentorOffer = require('../models/MentorOffer');
const AppError = require('../utils/AppError');
const realtime = require('../services/realtime');
const { getPagination, paginated, exactCI, escapeRegex } = require('../utils/helpers');

// GET /api/users — people search (team finder, mentors, etc.)
const listUsers = async (req, res) => {
  const { q, skill, role, lookingForTeam } = req.valid.query;
  const pg = getPagination(req.valid.query);
  const filter = { isActive: true, _id: { $ne: req.user._id } };
  if (skill) filter['skills.name'] = exactCI(skill);
  if (role) filter.role = role === 'mentor' ? { $in: ['mentor', 'both'] } : role;
  if (lookingForTeam !== undefined) filter.lookingForTeam = lookingForTeam;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { headline: rx }, { 'skills.name': rx }, { university: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter).select(User.CARD_FIELDS).sort({ ratingCount: -1, createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, pg) });
};

// GET /api/users/:id — public profile with projects, reviews and offers.
const getUser = async (req, res) => {
  const user = await User.findOne({ _id: req.valid.params.id, isActive: true }).select(User.PUBLIC_FIELDS);
  if (!user) throw AppError.notFound('User not found.');

  const [projects, reviews, offers] = await Promise.all([
    Project.find({ $or: [{ owner: user._id }, { members: user._id }] })
      .select('title summary techStack status category bookmarkCount owner')
      .sort({ updatedAt: -1 })
      .limit(12),
    Review.find({ subject: user._id })
      .populate('reviewer', 'firstName lastName profileImage')
      .sort({ createdAt: -1 })
      .limit(10),
    MentorOffer.find({ mentor: user._id, isActive: true }).sort({ createdAt: -1 }),
  ]);

  res.json({
    success: true,
    data: { user, online: realtime.isOnline(user._id), projects, reviews, offers },
  });
};

// PATCH /api/users/me — update own profile.
const updateMe = async (req, res) => {
  const updates = { ...req.valid.body };
  if (updates.links) {
    for (const [k, v] of Object.entries(updates.links)) updates[`links.${k}`] = v;
    delete updates.links;
  }
  const user = await User.findByIdAndUpdate(req.user._id, updates, { returnDocument: 'after', runValidators: true });
  res.json({ success: true, message: 'Profile updated.', data: { user } });
};

// PUT /api/users/me/skills — replace the skill list (duplicates removed).
const setSkills = async (req, res) => {
  const seen = new Set();
  const skills = req.valid.body.skills.filter((s) => {
    const k = s.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const user = await User.findByIdAndUpdate(req.user._id, { skills }, { returnDocument: 'after', runValidators: true });
  res.json({ success: true, message: 'Skills saved.', data: { user } });
};

// GET /api/users/:id/reviews
const getReviews = async (req, res) => {
  const pg = getPagination(req.query);
  const filter = { subject: req.valid.params.id };
  const [items, total] = await Promise.all([
    Review.find(filter).populate('reviewer', 'firstName lastName profileImage').sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, pg) });
};

module.exports = { listUsers, getUser, updateMe, setSkills, getReviews };
