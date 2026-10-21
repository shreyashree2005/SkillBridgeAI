const Job = require('../models/Job');
const Application = require('../models/Application');
const AppError = require('../utils/AppError');
const ai = require('../services/aiClient');
const { getCandidateProfile, jobPayload } = require('../services/profileContext');
const { getPagination, paginated, exactCI, escapeRegex } = require('../utils/helpers');

// GET /api/jobs
const listJobs = async (req, res) => {
  const { q, skill, remote, employmentType, experienceLevel } = req.valid.query;
  const pg = getPagination(req.valid.query, { defaultLimit: 12 });
  const filter = {};
  if (skill) filter.$or = [{ requiredSkills: exactCI(skill) }, { niceToHaveSkills: exactCI(skill) }];
  if (remote !== undefined) filter.remote = remote;
  if (employmentType) filter.employmentType = employmentType;
  if (experienceLevel) filter.experienceLevel = experienceLevel;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$and = [{ $or: [{ title: rx }, { company: rx }, { requiredSkills: rx }, { location: rx }] }];
  }
  const [items, total, apps] = await Promise.all([
    Job.find(filter).select('-description').sort({ postedAt: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Job.countDocuments(filter),
    Application.find({ user: req.user._id }).select('job status').lean(),
  ]);
  const byJob = new Map(apps.map((a) => [String(a.job), a]));
  for (const j of items) j.application = byJob.get(String(j._id)) || null;
  res.json({ success: true, data: paginated(items, total, pg) });
};

// GET /api/jobs/:id
const getJob = async (req, res) => {
  const job = await Job.findById(req.valid.params.id).lean();
  if (!job) throw AppError.notFound('Job not found.');
  job.application = await Application.findOne({ user: req.user._id, job: job._id }).lean();
  res.json({ success: true, data: { job } });
};

// GET /api/jobs/:id/match — how well do I fit this job? Uses my latest resume
// if I uploaded one, otherwise my profile skills.
const matchJob = async (req, res) => {
  const job = await Job.findById(req.valid.params.id).lean();
  if (!job) throw AppError.notFound('Job not found.');
  const candidate = await getCandidateProfile(req.user);
  const result = await ai.match({ candidate: candidate.payload, job: jobPayload(job) });
  await Application.updateOne({ user: req.user._id, job: job._id }, { matchScore: result.score });
  res.json({ success: true, data: { match: result, basedOn: candidate.source } });
};

module.exports = { listJobs, getJob, matchJob };
