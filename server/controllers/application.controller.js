const Application = require('../models/Application');
const Job = require('../models/Job');
const AppError = require('../utils/AppError');

const JOB_FIELDS = 'title company location remote employmentType experienceLevel requiredSkills';

// GET /api/applications — my tracker, newest activity first.
const list = async (req, res) => {
  const filter = { user: req.user._id };
  if (req.query.status) filter.status = String(req.query.status);
  const items = await Application.find(filter).populate('job', JOB_FIELDS).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: { items: items.filter((a) => a.job) } });
};

// POST /api/applications { jobId, status, notes } — track a job.
const create = async (req, res) => {
  const { jobId, status = 'saved', notes = '' } = req.valid.body;
  if (!(await Job.exists({ _id: jobId }))) throw AppError.notFound('Job not found.');
  if (await Application.exists({ user: req.user._id, job: jobId })) {
    throw AppError.conflict('This job is already in your tracker.');
  }
  const application = await Application.create({
    user: req.user._id,
    job: jobId,
    status,
    notes,
    appliedAt: status === 'saved' ? undefined : new Date(),
    statusHistory: [{ status, at: new Date() }],
  });
  await application.populate('job', JOB_FIELDS);
  res.status(201).json({ success: true, message: 'Added to your tracker.', data: { application } });
};

// PATCH /api/applications/:id { status, notes }
const update = async (req, res) => {
  const application = await Application.findOne({ _id: req.valid.params.id, user: req.user._id });
  if (!application) throw AppError.notFound('Application not found.');
  const { status, notes } = req.valid.body;
  if (notes !== undefined) application.notes = notes;
  if (status && status !== application.status) {
    application.status = status;
    application.statusHistory.push({ status, at: new Date() });
    if (status !== 'saved' && !application.appliedAt) application.appliedAt = new Date();
  }
  await application.save();
  await application.populate('job', JOB_FIELDS);
  res.json({ success: true, message: 'Application updated.', data: { application } });
};

// DELETE /api/applications/:id
const remove = async (req, res) => {
  const { deletedCount } = await Application.deleteOne({ _id: req.valid.params.id, user: req.user._id });
  if (!deletedCount) throw AppError.notFound('Application not found.');
  res.json({ success: true, message: 'Removed from tracker.' });
};

module.exports = { list, create, update, remove };
