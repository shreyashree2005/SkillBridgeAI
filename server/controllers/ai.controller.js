// Career-intelligence endpoints. This controller gathers the user's real data
// from MongoDB, sends it to the Python AI service, and stores results where
// useful. The AI service itself is stateless.
const Project = require('../models/Project');
const User = require('../models/User');
const Course = require('../models/Course');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const InterviewSession = require('../models/InterviewSession');
const AssistantMessage = require('../models/AssistantMessage');
const AppError = require('../utils/AppError');
const ai = require('../services/aiClient');
const { getCandidateProfile, activeGoal } = require('../services/profileContext');
const { sameId } = require('../utils/helpers');

const PERSON = 'firstName lastName headline profileImage skills availability ratingAverage ratingCount lookingForTeam';

// GET /api/ai/status — lets the UI show whether AI features are available.
const status = async (req, res) => {
  try {
    const health = await ai.health();
    res.json({ success: true, data: { available: true, ...health } });
  } catch (err) {
    res.json({ success: true, data: { available: false, message: err.message } });
  }
};

// GET /api/ai/recommendations/skills?targetRole=
const recommendSkills = async (req, res) => {
  const { skills } = await getCandidateProfile(req.user);
  const goal = await activeGoal(req.user._id);
  const targetRole = req.query.targetRole || goal?.targetRole || null;
  const result = await ai.recommendSkills({ skills: skills.map((s) => s.name), target_role: targetRole, limit: 10 });
  res.json({ success: true, data: { ...result, targetRole } });
};

// GET /api/ai/recommendations/projects
const recommendProjects = async (req, res) => {
  const { skills } = await getCandidateProfile(req.user);
  if (!skills.length) {
    return res.json({ success: true, data: { items: [], message: 'Add skills to your profile to get project recommendations.' } });
  }
  const pool = await Project.find({
    lookingForMembers: true,
    owner: { $ne: req.user._id },
    members: { $ne: req.user._id },
  })
    .sort({ createdAt: -1 })
    .limit(400)
    .populate('owner', 'firstName lastName profileImage')
    .lean();

  const result = await ai.recommendProjects({
    skills: skills.map((s) => s.name),
    interests: req.user.interests || [],
    projects: pool.map((p) => ({
      id: String(p._id),
      title: p.title,
      summary: p.summary || '',
      description: p.description,
      tech_stack: p.techStack,
      roles_needed: p.rolesNeeded,
      difficulty: p.difficulty,
    })),
    limit: 9,
  });
  const byId = new Map(pool.map((p) => [String(p._id), p]));
  const items = result.items.map((r) => ({ ...r, project: byId.get(r.id) })).filter((r) => r.project);
  res.json({ success: true, data: { items, method: result.method } });
};

// GET /api/ai/recommendations/teammates?projectId=  (project members only)
const recommendTeammates = async (req, res) => {
  const project = await Project.findById(req.valid.query.projectId).populate('members', 'skills').lean();
  if (!project) throw AppError.notFound('Project not found.');
  if (!project.members.some((m) => sameId(m._id, req.user._id))) {
    throw AppError.forbidden('Only project members can see teammate recommendations.');
  }

  const candidates = await User.find({
    isActive: true,
    lookingForTeam: true,
    _id: { $nin: project.members.map((m) => m._id) },
    'skills.0': { $exists: true },
  })
    .select(PERSON)
    .sort({ lastSeenAt: -1, updatedAt: -1 })
    .limit(600)
    .lean();

  const result = await ai.recommendTeammates({
    project: {
      title: project.title,
      description: project.description,
      tech_stack: project.techStack,
      roles_needed: project.rolesNeeded,
      member_skills: project.members.flatMap((m) => (m.skills || []).map((s) => s.name)),
    },
    candidates: candidates.map((c) => ({
      id: String(c._id),
      skills: (c.skills || []).map((s) => ({ name: s.name, level: s.level })),
      availability: c.availability,
      rating: c.ratingAverage || 0,
    })),
    limit: 10,
  });
  const byId = new Map(candidates.map((c) => [String(c._id), c]));
  const items = result.items.map((r) => ({ ...r, user: byId.get(r.id) })).filter((r) => r.user);
  res.json({ success: true, data: { items, method: result.method } });
};

// POST /api/ai/skill-gap { targetRole }
const skillGap = async (req, res) => {
  const { skills, source } = await getCandidateProfile(req.user);
  const result = await ai.skillGap({ skills, target_role: req.valid.body.targetRole });
  res.json({ success: true, data: { ...result, basedOn: source } });
};

// POST /api/ai/roadmap { targetRole, hoursPerWeek }
const roadmap = async (req, res) => {
  const { skills } = await getCandidateProfile(req.user);
  const courses = await Course.find().select('title skills level durationHours').lean();
  const result = await ai.roadmap({
    skills,
    target_role: req.valid.body.targetRole,
    hours_per_week: req.valid.body.hoursPerWeek,
    courses: courses.map((c) => ({
      id: String(c._id), title: c.title, skills: c.skills, level: c.level, duration_hours: c.durationHours,
    })),
  });
  res.json({ success: true, data: result });
};

// ---------- Career assistant ----------

const buildAssistantContext = async (user) => {
  const [{ skills, resume }, goal, apps, enrollments] = await Promise.all([
    getCandidateProfile(user),
    activeGoal(user._id),
    Application.find({ user: user._id }).populate('job', 'title company requiredSkills').sort({ updatedAt: -1 }).limit(10).lean(),
    Enrollment.find({ user: user._id }).populate('course', 'title skills').sort({ lastActivityAt: -1 }).limit(10).lean(),
  ]);
  return {
    name: user.firstName,
    headline: user.headline || '',
    skills: skills.map((s) => ({ name: s.name, level: s.level })),
    target_role: goal?.targetRole || null,
    hours_per_week: goal?.hoursPerWeek || null,
    resume_score: resume?.analysis?.score ?? null,
    resume_suggestions: resume?.analysis?.suggestions || [],
    applications: apps.filter((a) => a.job).map((a) => ({ title: a.job.title, company: a.job.company, status: a.status, skills: a.job.requiredSkills })),
    courses: enrollments.filter((e) => e.course).map((e) => ({ title: e.course.title, progress: e.progress, skills: e.course.skills })),
  };
};

// POST /api/ai/assistant { message }
const assistant = async (req, res) => {
  const { message } = req.valid.body;
  const [context, history] = await Promise.all([
    buildAssistantContext(req.user),
    AssistantMessage.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const result = await ai.assistant({
    message,
    history: history.reverse().map((m) => ({ role: m.role, content: m.content })),
    context,
  });
  const [, reply] = await AssistantMessage.create([
    { user: req.user._id, role: 'user', content: message },
    { user: req.user._id, role: 'assistant', content: result.reply.slice(0, 8000), provider: result.provider, sources: result.sources || [] },
  ], { ordered: true });
  res.json({ success: true, data: { reply, provider: result.provider } });
};

// GET /api/ai/assistant/history
const assistantHistory = async (req, res) => {
  const items = (await AssistantMessage.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean()).reverse();
  res.json({ success: true, data: { items } });
};

// DELETE /api/ai/assistant/history
const clearAssistantHistory = async (req, res) => {
  await AssistantMessage.deleteMany({ user: req.user._id });
  res.json({ success: true, message: 'Conversation cleared.' });
};

// ---------- Interview preparation ----------

// POST /api/ai/interview { role, count }
const startInterview = async (req, res) => {
  const { role, count } = req.valid.body;
  const { skills } = await getCandidateProfile(req.user);
  const previous = await InterviewSession.find({ user: req.user._id, role }).sort({ createdAt: -1 }).limit(3).lean();
  const result = await ai.interviewQuestions({
    role,
    skills: skills.map((s) => s.name),
    count,
    exclude: previous.flatMap((s) => s.questions.map((q) => q.qid)),
  });
  const session = await InterviewSession.create({
    user: req.user._id,
    role,
    questions: result.questions.map((q) => ({
      qid: q.qid, question: q.question, skill: q.skill, type: q.type, expectedPoints: q.expected_points,
    })),
  });
  res.status(201).json({ success: true, data: { session } });
};

// GET /api/ai/interview
const listInterviews = async (req, res) => {
  const items = await InterviewSession.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30)
    .select('role overallScore status createdAt questions.qid questions.evaluation.score');
  res.json({ success: true, data: { items } });
};

const loadInterview = async (id, userId) => {
  const session = await InterviewSession.findOne({ _id: id, user: userId });
  if (!session) throw AppError.notFound('Interview session not found.');
  return session;
};

// GET /api/ai/interview/:id
const getInterview = async (req, res) => {
  const session = await loadInterview(req.valid.params.id, req.user._id);
  res.json({ success: true, data: { session } });
};

// POST /api/ai/interview/:id/answers { qid, answer }
const answerInterview = async (req, res) => {
  const session = await loadInterview(req.valid.params.id, req.user._id);
  const { qid, answer } = req.valid.body;
  const q = session.questions.find((x) => x.qid === qid);
  if (!q) throw AppError.notFound('Question not found in this session.');

  const evaluation = await ai.interviewEvaluate({ qid: q.qid, answer });
  q.answer = answer;
  q.evaluation = {
    score: evaluation.score,
    criteria: evaluation.criteria,
    feedback: evaluation.feedback,
    coveredPoints: evaluation.covered_points,
    missedPoints: evaluation.missed_points,
  };

  const scored = session.questions.filter((x) => typeof x.evaluation?.score === 'number');
  if (scored.length === session.questions.length) {
    session.status = 'completed';
    session.overallScore = Math.round(scored.reduce((sum, x) => sum + x.evaluation.score, 0) / scored.length);
  }
  await session.save();
  res.json({ success: true, data: { session } });
};

module.exports = {
  status, recommendSkills, recommendProjects, recommendTeammates, skillGap, roadmap,
  assistant, assistantHistory, clearAssistantHistory,
  startInterview, listInterviews, getInterview, answerInterview,
};
