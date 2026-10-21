// GET /api/dashboard — career analytics aggregated from the user's real data.
const Project = require('../models/Project');
const Bookmark = require('../models/Bookmark');
const Enrollment = require('../models/Enrollment');
const Application = require('../models/Application');
const MentorSession = require('../models/MentorSession');
const Notification = require('../models/Notification');
const Resume = require('../models/Resume');
const InterviewSession = require('../models/InterviewSession');
const CareerGoal = require('../models/CareerGoal');

const WEEKS = 8;

// Which profile fields are filled in, as a 0-100 score plus a to-do list.
const profileCompleteness = (user, hasResume) => {
  const checks = [
    ['Add a headline', Boolean(user.headline)],
    ['Write a short bio', (user.bio || '').length >= 40],
    ['Add your location', Boolean(user.location)],
    ['Add your university', Boolean(user.university)],
    ['Add at least 5 skills', (user.skills || []).length >= 5],
    ['Add interests', (user.interests || []).length > 0],
    ['Link your GitHub', Boolean(user.links?.github)],
    ['Upload a resume', hasResume],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  return { score: Math.round((done / checks.length) * 100), todo: checks.filter(([, ok]) => !ok).map(([label]) => label) };
};

// Start of the ISO week (Monday 00:00 UTC) for grouping activity by week.
const weekStart = (d) => {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x;
};

const getDashboard = async (req, res) => {
  const me = req.user._id;
  const now = new Date();
  const since = weekStart(new Date(now.getTime() - (WEEKS - 1) * 7 * 864e5));

  const [
    ownedProjects, memberProjects, bookmarks, enrollments, applications,
    upcomingSessions, mentorSessionsDone, unread, resume, interviews, goal, recentNotifications,
  ] = await Promise.all([
    Project.countDocuments({ owner: me }),
    Project.countDocuments({ members: me, owner: { $ne: me } }),
    Bookmark.countDocuments({ user: me }),
    Enrollment.find({ user: me }).populate('course', 'title durationHours modules skills').lean(),
    Application.find({ user: me }).populate('job', 'title company').lean(),
    MentorSession.find({ $or: [{ mentor: me }, { learner: me }], status: 'accepted', scheduledAt: { $gte: now } })
      .populate('mentor learner', 'firstName lastName')
      .sort({ scheduledAt: 1 })
      .limit(5)
      .lean(),
    MentorSession.countDocuments({ $or: [{ mentor: me }, { learner: me }], status: 'completed' }),
    Notification.countDocuments({ user: me, read: false }),
    Resume.findOne({ user: me }).sort({ createdAt: -1 }).select('analysis.score parsed.skills createdAt originalName').lean(),
    InterviewSession.find({ user: me, status: 'completed' }).sort({ createdAt: 1 }).select('role overallScore createdAt').lean(),
    CareerGoal.findOne({ user: me, status: 'active' }).lean(),
    Notification.find({ user: me }).sort({ createdAt: -1 }).limit(6).lean(),
  ]);

  // Learning: hours completed = sum of finished module durations.
  const validEnrollments = enrollments.filter((e) => e.course);
  let learningMinutes = 0;
  for (const e of validEnrollments) {
    for (const i of e.completedModules) learningMinutes += e.course.modules?.[i]?.durationMinutes || 0;
  }

  // Applications: status funnel + weekly activity.
  const byStatus = Object.fromEntries(Application.STATUSES.map((s) => [s, 0]));
  for (const a of applications) byStatus[a.status] += 1;

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const start = new Date(since.getTime() + i * 7 * 864e5);
    return { week: start.toISOString().slice(0, 10), applications: 0, learning: 0 };
  });
  const bucket = (date) => {
    if (!date || date < since) return null;
    return weeks[Math.min(WEEKS - 1, Math.floor((weekStart(new Date(date)) - since) / (7 * 864e5)))];
  };
  for (const a of applications) {
    for (const h of a.statusHistory || []) {
      if (h.status === 'applied') {
        const b = bucket(h.at);
        if (b) b.applications += 1;
      }
    }
  }
  for (const e of validEnrollments) {
    const b = bucket(e.lastActivityAt);
    if (b) b.learning += 1;
  }

  // Skills by level.
  const skillLevels = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };
  for (const s of req.user.skills || []) skillLevels[s.level] = (skillLevels[s.level] || 0) + 1;

  res.json({
    success: true,
    data: {
      profile: profileCompleteness(req.user, Boolean(resume)),
      stats: {
        skills: (req.user.skills || []).length,
        projectsOwned: ownedProjects,
        projectsJoined: memberProjects,
        bookmarks,
        coursesInProgress: validEnrollments.filter((e) => e.status === 'in-progress').length,
        coursesCompleted: validEnrollments.filter((e) => e.status === 'completed').length,
        learningHours: Math.round((learningMinutes / 60) * 10) / 10,
        applications: applications.length,
        mentorSessionsCompleted: mentorSessionsDone,
        unreadNotifications: unread,
        resumeScore: resume?.analysis?.score ?? null,
        averageInterviewScore: interviews.length
          ? Math.round(interviews.reduce((s, i) => s + (i.overallScore || 0), 0) / interviews.length)
          : null,
      },
      applicationsByStatus: byStatus,
      weeklyActivity: weeks,
      skillLevels,
      interviewTrend: interviews.slice(-10).map((i) => ({ date: i.createdAt, role: i.role, score: i.overallScore })),
      courses: validEnrollments
        .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
        .slice(0, 5)
        .map((e) => ({ id: e.course._id, title: e.course.title, progress: e.progress, status: e.status })),
      upcomingSessions,
      goal,
      recentNotifications,
    },
  });
};

module.exports = { getDashboard };
