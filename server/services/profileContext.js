// Builds the data the AI service needs about a user: their skills (profile
// + latest resume), experience and goals. Centralised so every AI feature
// sees the same picture of the user.
const Resume = require('../models/Resume');
const CareerGoal = require('../models/CareerGoal');

const latestResume = (userId, withText = false) =>
  Resume.findOne({ user: userId })
    .sort({ createdAt: -1 })
    .select(withText ? '+text' : '')
    .lean();

const mergeSkills = (profileSkills = [], resumeSkills = []) => {
  const byKey = new Map();
  for (const s of profileSkills) byKey.set(s.name.toLowerCase(), { name: s.name, level: s.level || 'beginner' });
  for (const name of resumeSkills) {
    if (!byKey.has(name.toLowerCase())) byKey.set(name.toLowerCase(), { name, level: 'intermediate' });
  }
  return [...byKey.values()];
};

// Profile-derived experience estimate when no resume is uploaded.
const profileYears = (skills = []) => Math.max(0, ...skills.map((s) => s.yearsOfExperience || 0));

const getCandidateProfile = async (user) => {
  const resume = await latestResume(user._id, true);
  const skills = mergeSkills(user.skills, resume?.parsed?.skills);
  const profileText = [user.headline, user.bio, ...(user.skills || []).map((s) => s.name)].filter(Boolean).join('\n');
  return {
    source: resume ? 'resume' : 'profile',
    resume,
    skills,
    payload: {
      skills: skills.map((s) => s.name),
      text: resume?.text || profileText,
      years_experience: resume ? resume.parsed.yearsOfExperience : profileYears(user.skills),
    },
  };
};

const activeGoal = (userId) => CareerGoal.findOne({ user: userId, status: 'active' }).sort({ updatedAt: -1 }).lean();

const jobPayload = (job) => ({
  title: job.title,
  description: job.description,
  required_skills: job.requiredSkills || [],
  nice_to_have_skills: job.niceToHaveSkills || [],
  min_years: job.minYearsExperience || 0,
});

module.exports = { getCandidateProfile, latestResume, mergeSkills, activeGoal, jobPayload };
