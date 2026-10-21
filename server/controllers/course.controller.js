const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const AppError = require('../utils/AppError');
const { notify } = require('../services/notificationService');
const { getPagination, paginated, exactCI, escapeRegex } = require('../utils/helpers');

// GET /api/courses
const listCourses = async (req, res) => {
  const { q, skill, level } = req.valid.query;
  const pg = getPagination(req.valid.query, { defaultLimit: 12 });
  const filter = {};
  if (skill) filter.skills = exactCI(skill);
  if (level) filter.level = level;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { description: rx }, { skills: rx }];
  }
  const [items, total, mine] = await Promise.all([
    Course.find(filter).select('-modules').sort({ enrolledCount: -1, ratingAverage: -1 }).skip(pg.skip).limit(pg.limit).lean(),
    Course.countDocuments(filter),
    Enrollment.find({ user: req.user._id }).select('course progress status').lean(),
  ]);
  const byCourse = new Map(mine.map((e) => [String(e.course), e]));
  for (const c of items) c.enrollment = byCourse.get(String(c._id)) || null;
  res.json({ success: true, data: paginated(items, total, pg) });
};

// GET /api/courses/:id
const getCourse = async (req, res) => {
  const course = await Course.findById(req.valid.params.id).lean();
  if (!course) throw AppError.notFound('Course not found.');
  course.enrollment = await Enrollment.findOne({ user: req.user._id, course: course._id }).lean();
  res.json({ success: true, data: { course } });
};

// POST /api/courses/:id/enroll
const enroll = async (req, res) => {
  const course = await Course.findById(req.valid.params.id);
  if (!course) throw AppError.notFound('Course not found.');
  const result = await Enrollment.updateOne(
    { user: req.user._id, course: course._id },
    { $setOnInsert: { user: req.user._id, course: course._id, lastActivityAt: new Date() } },
    { upsert: true }
  );
  if (result.upsertedCount) await Course.updateOne({ _id: course._id }, { $inc: { enrolledCount: 1 } });
  const enrollment = await Enrollment.findOne({ user: req.user._id, course: course._id });
  res.status(result.upsertedCount ? 201 : 200).json({ success: true, message: 'Enrolled.', data: { enrollment } });
};

// PATCH /api/courses/:id/progress — mark a module complete / incomplete.
const updateProgress = async (req, res) => {
  const course = await Course.findById(req.valid.params.id).select('title modules');
  if (!course) throw AppError.notFound('Course not found.');
  const enrollment = await Enrollment.findOne({ user: req.user._id, course: course._id });
  if (!enrollment) throw AppError.badRequest('Enroll in the course first.');

  const { moduleIndex, completed } = req.valid.body;
  const total = course.modules.length || 1;
  if (moduleIndex >= total) throw AppError.badRequest('Invalid module.');

  const done = new Set(enrollment.completedModules);
  if (completed) done.add(moduleIndex);
  else done.delete(moduleIndex);
  enrollment.completedModules = [...done].sort((a, b) => a - b);
  enrollment.progress = Math.round((done.size / total) * 100);
  enrollment.lastActivityAt = new Date();

  const justCompleted = enrollment.progress === 100 && enrollment.status !== 'completed';
  enrollment.status = enrollment.progress === 100 ? 'completed' : 'in-progress';
  enrollment.completedAt = enrollment.progress === 100 ? enrollment.completedAt || new Date() : undefined;
  await enrollment.save();

  if (justCompleted) {
    await notify(req.user._id, {
      type: 'course-completed',
      title: `Course completed: ${course.title} 🎓`,
      body: 'Great work! Consider adding the skills you learned to your profile.',
      link: `/learning/${course._id}`,
    });
  }
  res.json({ success: true, data: { enrollment } });
};

// GET /api/courses/enrollments/me — learning history.
const myEnrollments = async (req, res) => {
  const items = await Enrollment.find({ user: req.user._id })
    .populate('course', 'title provider skills level durationHours modules')
    .sort({ lastActivityAt: -1 })
    .lean();
  res.json({ success: true, data: { items: items.filter((e) => e.course) } });
};

module.exports = { listCourses, getCourse, enroll, updateProgress, myEnrollments };
