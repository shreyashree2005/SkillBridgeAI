const Resume = require('../models/Resume');
const Job = require('../models/Job');
const Application = require('../models/Application');
const AppError = require('../utils/AppError');
const ai = require('../services/aiClient');
const { jobPayload } = require('../services/profileContext');

const MAX_RESUMES_PER_USER = 10;

// POST /api/resumes (multipart, field "resume") — upload, extract and analyse.
const upload = async (req, res) => {
  const result = await ai.parseResume(req.file);
  if (!result.text || result.text.trim().length < 50) {
    throw AppError.badRequest('Could not read enough text from this file. Is it a scanned image? Try a text-based PDF or DOCX.');
  }

  const resume = await Resume.create({
    user: req.user._id,
    originalName: req.file.originalname.slice(0, 200),
    mimeType: req.file.mimetype,
    sizeBytes: req.file.size,
    text: result.text.slice(0, 100000),
    parsed: {
      skills: result.skills,
      sections: result.sections,
      yearsOfExperience: result.years_experience,
      education: result.education,
      wordCount: result.word_count,
    },
    analysis: result.analysis,
  });

  // Keep only the most recent resumes for each user.
  const old = await Resume.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(MAX_RESUMES_PER_USER).select('_id');
  if (old.length) await Resume.deleteMany({ _id: { $in: old.map((r) => r._id) } });

  // `select: false` only applies to queries, so drop the raw text from this response explicitly.
  const { text, ...summary } = resume.toJSON();
  res.status(201).json({ success: true, message: 'Resume analysed.', data: { resume: summary } });
};

// GET /api/resumes
const list = async (req, res) => {
  const items = await Resume.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: { items } });
};

const loadOwn = async (id, userId, withText = false) => {
  const resume = await Resume.findOne({ _id: id, user: userId }).select(withText ? '+text' : '');
  if (!resume) throw AppError.notFound('Resume not found.');
  return resume;
};

// GET /api/resumes/:id
const getOne = async (req, res) => {
  const resume = await loadOwn(req.valid.params.id, req.user._id, true);
  res.json({ success: true, data: { resume } });
};

// DELETE /api/resumes/:id
const remove = async (req, res) => {
  const resume = await loadOwn(req.valid.params.id, req.user._id);
  await resume.deleteOne();
  res.json({ success: true, message: 'Resume deleted.' });
};

// POST /api/resumes/:id/match { jobId } or { jobDescription }
const match = async (req, res) => {
  const resume = await loadOwn(req.valid.params.id, req.user._id, true);
  const { jobId, jobDescription } = req.valid.body;

  let job;
  if (jobId) {
    const doc = await Job.findById(jobId).lean();
    if (!doc) throw AppError.notFound('Job not found.');
    job = jobPayload(doc);
  } else {
    // Free-text job description: the AI service extracts the skills itself.
    job = { title: 'Custom job description', description: jobDescription, required_skills: [], nice_to_have_skills: [], min_years: 0 };
  }

  const result = await ai.match({
    candidate: { skills: resume.parsed.skills, text: resume.text, years_experience: resume.parsed.yearsOfExperience },
    job,
  });
  if (jobId) await Application.updateOne({ user: req.user._id, job: jobId }, { matchScore: result.score });
  res.json({ success: true, data: { match: result } });
};

module.exports = { upload, list, getOne, remove, match };
