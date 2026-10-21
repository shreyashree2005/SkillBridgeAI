/**
 * Seeds MongoDB with the synthetic datasets in datasets/generated/ and the
 * reference taxonomy in datasets/taxonomy/.
 *
 *   npm run seed                 validate + seed
 *   npm run seed:validate        validate the dataset files only (no database)
 *
 * IDEMPOTENT: every record gets a deterministic ObjectId derived from its
 * dataset id, and is written with an upsert. Running the seed again updates
 * the same documents instead of creating duplicates. It never drops
 * collections or deletes data.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'datasets', 'generated');
const TAXONOMY_DIR = path.join(__dirname, '..', '..', 'datasets', 'taxonomy');

const REQUIRED_COUNTS = {
  users: 1000, projects: 500, jobs: 300, resumes: 500, courses: 50, reviews: 100, mentor_sessions: 100,
  enrollments: 500, notifications: 500, bookmarks: 500, applications: 500, career_goals: 100,
};

const DEMO = { id: 'user-demo', email: 'demo@skillbridge.example' };

// ---------- helpers ----------
const oid = (id) => crypto.createHash('md5').update(`skillbridge:${id}`).digest('hex').slice(0, 24);
const readJson = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));

const loadData = () => {
  const names = ['users', 'courses', 'projects', 'jobs', 'resumes', 'mentor_offers', 'mentor_sessions', 'reviews',
    'enrollments', 'bookmarks', 'join_requests', 'applications', 'career_goals', 'notifications'];
  const missing = names.filter((n) => !fs.existsSync(path.join(DATA_DIR, `${n}.json`)));
  if (missing.length) {
    throw new Error(`Missing dataset files: ${missing.join(', ')}. Run: python datasets/generator/generate.py`);
  }
  const data = Object.fromEntries(names.map((n) => [n, readJson(DATA_DIR, n)]));
  data.skills = readJson(TAXONOMY_DIR, 'skills');
  data.roles = readJson(TAXONOMY_DIR, 'roles');
  return data;
};

// ---------- validation ----------
const validateData = (d) => {
  const errors = [];
  const ids = (rows) => new Set(rows.map((r) => r.id));
  const need = (rows, coll, fields) => rows.forEach((r, i) => fields.forEach((f) => {
    if (r[f] === undefined || r[f] === null || r[f] === '') errors.push(`${coll}[${i}] (${r.id}) missing ${f}`);
  }));
  const refs = (rows, coll, field, target, label) => rows.forEach((r) => {
    const vals = Array.isArray(r[field]) ? r[field] : [r[field]];
    vals.forEach((v) => { if (!target.has(v)) errors.push(`${coll} ${r.id}: ${field} → unknown ${label} ${v}`); });
  });

  for (const [coll, min] of Object.entries(REQUIRED_COUNTS)) {
    if ((d[coll] || []).length < min) errors.push(`${coll}: expected ≥ ${min}, found ${(d[coll] || []).length}`);
  }
  for (const coll of Object.keys(d)) {
    if (!Array.isArray(d[coll]) || !d[coll][0]?.id) continue;
    if (ids(d[coll]).size !== d[coll].length) errors.push(`${coll}: duplicate ids`);
    if (d[coll].some((r) => r.isSynthetic !== true)) errors.push(`${coll}: every record must be labelled isSynthetic`);
  }

  const users = ids(d.users);
  const projects = ids(d.projects);
  const courses = ids(d.courses);
  const jobs = ids(d.jobs);
  const offers = ids(d.mentor_offers);
  const sessions = ids(d.mentor_sessions);
  const skillNames = new Set(d.skills.map((s) => s.name));

  need(d.users, 'users', ['firstName', 'lastName', 'email', 'role']);
  need(d.projects, 'projects', ['owner', 'title', 'description']);
  need(d.jobs, 'jobs', ['title', 'company', 'description']);
  need(d.courses, 'courses', ['slug', 'title', 'level']);
  if (new Set(d.users.map((u) => u.email)).size !== d.users.length) errors.push('users: duplicate emails');
  if (d.users.some((u) => !u.email.endsWith('.example'))) errors.push('users: synthetic emails must use the .example domain');

  refs(d.projects, 'projects', 'owner', users, 'user');
  refs(d.projects, 'projects', 'members', users, 'user');
  refs(d.resumes, 'resumes', 'user', users, 'user');
  refs(d.mentor_offers, 'mentor_offers', 'mentor', users, 'user');
  refs(d.mentor_sessions, 'mentor_sessions', 'offer', offers, 'offer');
  refs(d.mentor_sessions, 'mentor_sessions', 'learner', users, 'user');
  refs(d.reviews, 'reviews', 'session', sessions, 'session');
  refs(d.reviews, 'reviews', 'reviewer', users, 'user');
  refs(d.enrollments, 'enrollments', 'course', courses, 'course');
  refs(d.enrollments, 'enrollments', 'user', users, 'user');
  refs(d.bookmarks, 'bookmarks', 'project', projects, 'project');
  refs(d.join_requests, 'join_requests', 'project', projects, 'project');
  refs(d.applications, 'applications', 'job', jobs, 'job');
  refs(d.applications, 'applications', 'user', users, 'user');
  refs(d.career_goals, 'career_goals', 'user', users, 'user');
  refs(d.notifications, 'notifications', 'user', users, 'user');

  // Every skill referenced in users/jobs/projects/roles must exist in the taxonomy.
  const checkSkills = (coll, list) => list.forEach((s) => { if (!skillNames.has(s)) errors.push(`${coll}: unknown skill "${s}"`); });
  d.users.forEach((u) => checkSkills('users', u.skills.map((s) => s.name)));
  d.jobs.forEach((j) => checkSkills('jobs', [...j.requiredSkills, ...j.niceToHaveSkills]));
  d.projects.forEach((p) => checkSkills('projects', [...p.techStack, ...p.rolesNeeded]));
  d.roles.forEach((r) => checkSkills('roles', r.skills.map((s) => s.name)));
  d.skills.forEach((s) => checkSkills('skills.prerequisites', s.prerequisites));

  // Reviews only for completed sessions, by that session's learner.
  const sessionById = new Map(d.mentor_sessions.map((s) => [s.id, s]));
  d.reviews.forEach((r) => {
    const s = sessionById.get(r.session);
    if (s && (s.status !== 'completed' || s.learner !== r.reviewer)) errors.push(`reviews ${r.id}: inconsistent with session`);
  });

  return [...new Set(errors)];
};

// ---------- seeding ----------
const upsertMany = async (Model, docs, { addToSet = [], insertOnly = [] } = {}) => {
  const now = new Date();
  for (let i = 0; i < docs.length; i += 1000) {
    const ops = docs.slice(i, i + 1000).map((doc) => {
      const { _id, createdAt, ...rest } = doc;
      const $set = { ...rest, updatedAt: now };
      const update = { $set, $setOnInsert: { createdAt: createdAt ? new Date(createdAt) : now } };
      for (const f of insertOnly) { update.$setOnInsert[f] = $set[f]; delete $set[f]; }
      for (const f of addToSet) { update.$addToSet = { ...(update.$addToSet || {}), [f]: { $each: $set[f] } }; delete $set[f]; }
      return { updateOne: { filter: { _id }, update, upsert: true } };
    });
    await Model.bulkWrite(ops, { ordered: false, timestamps: false });
  }
  return docs.length;
};

const seed = async (d) => {
  const env = require('../config/env');
  const { connectDB, disconnectDB } = require('../config/db');
  const models = {
    User: require('../models/User'),
    Project: require('../models/Project'),
    Bookmark: require('../models/Bookmark'),
    JoinRequest: require('../models/JoinRequest'),
    Course: require('../models/Course'),
    Enrollment: require('../models/Enrollment'),
    MentorOffer: require('../models/MentorOffer'),
    MentorSession: require('../models/MentorSession'),
    Review: require('../models/Review'),
    Notification: require('../models/Notification'),
    Job: require('../models/Job'),
    Application: require('../models/Application'),
    CareerGoal: require('../models/CareerGoal'),
    Conversation: require('../models/Conversation'),
    Message: require('../models/Message'),
    ...require('../models/Catalog'),
  };

  await connectDB(env.MONGO_URI);
  await Promise.all(Object.values(models).map((M) => M.init())); // ensure indexes exist

  const syntheticPassword = process.env.SEED_USER_PASSWORD || 'Synthetic2026!';
  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'DemoPass123';
  const [syntheticHash, demoHash] = await Promise.all([bcrypt.hash(syntheticPassword, 12), bcrypt.hash(demoPassword, 12)]);
  const ref = (id) => oid(id);
  const counts = {};
  const t0 = Date.now();

  // Reference catalog
  for (const s of d.skills) {
    await models.Skill.updateOne({ name: s.name }, { $set: { category: s.category, aliases: s.aliases, prerequisites: s.prerequisites } }, { upsert: true });
  }
  for (const r of d.roles) {
    await models.RoleProfile.updateOne({ title: r.title }, { $set: { description: r.description, skills: r.skills } }, { upsert: true });
  }
  counts.skills = d.skills.length;
  counts.roles = d.roles.length;

  // Demo account with a realistic starting point.
  const demoUser = {
    id: DEMO.id, firstName: 'Demo', lastName: 'Student', email: DEMO.email, role: 'both',
    headline: 'Aspiring Full Stack Developer · React, Node.js, MongoDB',
    bio: 'Demo account for exploring SkillBridge AI. Synthetic profile — feel free to edit everything.',
    location: 'Bengaluru, India', university: 'Northbridge Institute of Technology', graduationYear: 2027,
    skills: [
      { name: 'JavaScript', level: 'intermediate', yearsOfExperience: 2 },
      { name: 'React', level: 'intermediate', yearsOfExperience: 1.5 },
      { name: 'HTML', level: 'advanced', yearsOfExperience: 2 },
      { name: 'CSS', level: 'intermediate', yearsOfExperience: 2 },
      { name: 'Node.js', level: 'beginner', yearsOfExperience: 0.5 },
      { name: 'Git', level: 'intermediate', yearsOfExperience: 1 },
      { name: 'Python', level: 'beginner', yearsOfExperience: 1 },
    ],
    interests: ['hackathons', 'edtech', 'open source'], lookingForTeam: true, availability: 'part-time',
    links: { github: 'https://github.example/demo-student', linkedin: '', portfolio: '' },
    createdAt: '2026-06-01T10:00:00.000Z', isSynthetic: true,
  };

  const userDocs = [...d.users, demoUser].map(({ id, track, ...u }) => ({
    ...u, _id: ref(id), password: id === DEMO.id ? demoHash : syntheticHash, isActive: true,
  }));
  counts.users = await upsertMany(models.User, userDocs, { insertOnly: ['password'] });

  counts.courses = await upsertMany(models.Course, d.courses.map(({ id, ...c }) => ({ ...c, _id: ref(id) })));

  const demoProject = {
    id: 'project-demo', owner: DEMO.id, title: 'SkillSwap Campus', summary: 'Peer-to-peer skill exchange for students.',
    description: 'A demo project owned by the demo account: students list skills they can teach and want to learn, and get matched for swaps. Synthetic demo data.',
    category: 'web', techStack: ['React', 'Node.js', 'MongoDB', 'Express.js'], rolesNeeded: ['UI/UX Design', 'Docker'],
    status: 'in-progress', difficulty: 'intermediate', members: [DEMO.id], maxTeamSize: 4, lookingForMembers: true,
    createdAt: '2026-08-15T10:00:00.000Z', isSynthetic: true,
  };
  const projectDocs = [...d.projects, demoProject].map(({ id, owner, members, ...p }) => ({
    ...p, _id: ref(id), owner: ref(owner), members: members.map(ref),
  }));
  counts.projects = await upsertMany(models.Project, projectDocs, { addToSet: ['members'] });
  // Demo user is also a member of two synthetic projects.
  await models.Project.updateMany({ _id: { $in: [ref('project-0001'), ref('project-0002')] } }, { $addToSet: { members: ref(DEMO.id) } });

  counts.jobs = await upsertMany(models.Job, d.jobs.map(({ id, ...j }) => ({ ...j, _id: ref(id) })));
  counts.mentor_offers = await upsertMany(models.MentorOffer, d.mentor_offers.map(({ id, mentor, ...o }) => ({ ...o, _id: ref(id), mentor: ref(mentor) })));
  counts.mentor_sessions = await upsertMany(models.MentorSession, d.mentor_sessions.map(({ id, offer, mentor, learner, ...s }) => ({
    ...s, _id: ref(id), offer: ref(offer), mentor: ref(mentor), learner: ref(learner),
  })));
  counts.reviews = await upsertMany(models.Review, d.reviews.map(({ id, reviewer, subject, session, ...r }) => ({
    ...r, _id: ref(id), reviewer: ref(reviewer), subject: ref(subject), session: ref(session),
  })));

  const demoEnrollments = [
    { id: 'enrollment-demo-1', user: DEMO.id, course: d.courses.find((c) => c.slug === 'react-intermediate')?.id, completedModules: [0, 1, 2], lastActivityAt: '2026-09-28T18:00:00.000Z' },
    { id: 'enrollment-demo-2', user: DEMO.id, course: d.courses.find((c) => c.slug === 'nodejs-beginner')?.id, completedModules: [0], lastActivityAt: '2026-09-25T18:00:00.000Z' },
  ].filter((e) => e.course).map((e) => {
    const course = d.courses.find((c) => c.id === e.course);
    const progress = Math.round((e.completedModules.length / course.modules.length) * 100);
    return { ...e, progress, status: progress === 100 ? 'completed' : 'in-progress', isSynthetic: true };
  });
  counts.enrollments = await upsertMany(models.Enrollment, [...d.enrollments, ...demoEnrollments].map(({ id, user, course, ...e }) => ({
    ...e, _id: ref(id), user: ref(user), course: ref(course), completedAt: e.completedAt || undefined,
  })));

  counts.bookmarks = await upsertMany(models.Bookmark, d.bookmarks.map(({ id, user, project, ...b }) => ({ ...b, _id: ref(id), user: ref(user), project: ref(project) })));
  counts.join_requests = await upsertMany(models.JoinRequest, d.join_requests.map(({ id, user, project, ...j }) => ({ ...j, _id: ref(id), user: ref(user), project: ref(project) })));

  const demoApps = d.jobs.filter((j) => j.title.includes('Full Stack') || j.title.includes('Frontend')).slice(0, 4)
    .map((j, i) => {
      const status = ['saved', 'applied', 'interviewing', 'applied'][i];
      const flow = ['saved', 'applied', 'interviewing'].slice(0, ['saved', 'applied', 'interviewing'].indexOf(status) + 1);
      const history = flow.map((s, k) => ({ status: s, at: new Date(Date.parse('2026-09-01T10:00:00Z') + (i * 5 + k * 3) * 864e5).toISOString() }));
      return { id: `application-demo-${i + 1}`, user: DEMO.id, job: j.id, status, notes: '', appliedAt: history.find((h) => h.status === 'applied')?.at, statusHistory: history, isSynthetic: true };
    });
  counts.applications = await upsertMany(models.Application, [...d.applications, ...demoApps].map(({ id, user, job, ...a }) => ({
    ...a, _id: ref(id), user: ref(user), job: ref(job), appliedAt: a.appliedAt || undefined,
  })));

  const demoGoal = { id: 'goal-demo', user: DEMO.id, targetRole: 'Full Stack Developer', targetDate: '2027-06-30T00:00:00.000Z', hoursPerWeek: 8, status: 'active', notes: '', isSynthetic: true };
  counts.career_goals = await upsertMany(models.CareerGoal, [...d.career_goals, demoGoal].map(({ id, user, ...g }) => ({ ...g, _id: ref(id), user: ref(user) })));

  const demoNotes = [
    { id: 'notification-demo-1', user: DEMO.id, type: 'system', title: 'Welcome to SkillBridge AI 👋', body: 'Complete your profile and upload a resume to unlock AI recommendations.', link: '/profile', read: false, createdAt: '2026-09-30T09:00:00.000Z', isSynthetic: true },
  ];
  counts.notifications = await upsertMany(models.Notification, [...d.notifications, ...demoNotes].map(({ id, user, ...n }) => ({ ...n, _id: ref(id), user: ref(user) })));

  // A demo conversation so chat is not empty on first login.
  const partner = d.users[0];
  const convoId = ref('conversation-demo-1');
  const msgs = [
    { from: partner.id, body: `Hi Demo! I saw you're into React — want to team up for the next hackathon? (synthetic)` },
    { from: DEMO.id, body: 'Sounds great! I am learning Node.js right now, so a full-stack idea would be perfect.' },
    { from: partner.id, body: 'Perfect. Let us sync this weekend 🚀' },
  ];
  await upsertMany(models.Message, msgs.map((m, i) => ({
    _id: ref(`message-demo-${i + 1}`), conversation: convoId, sender: ref(m.from), body: m.body,
    readBy: [ref(m.from)], createdAt: new Date(Date.parse('2026-09-29T10:00:00Z') + i * 6e4).toISOString(),
  })));
  const participants = [ref(DEMO.id), ref(partner.id)];
  await models.Conversation.updateOne(
    { _id: convoId },
    { $set: { participants, key: models.Conversation.keyFor(...participants), lastMessagePreview: msgs.at(-1).body, lastMessageSender: ref(partner.id) },
      $setOnInsert: { lastMessageAt: new Date('2026-09-29T10:02:00Z') } },
    { upsert: true }
  );

  // Recompute derived counters from the actual data (covers real + synthetic records).
  const [bookmarkAgg, enrollAgg, reviewAgg] = await Promise.all([
    models.Bookmark.aggregate([{ $group: { _id: '$project', n: { $sum: 1 } } }]),
    models.Enrollment.aggregate([{ $group: { _id: '$course', n: { $sum: 1 } } }]),
    models.Review.aggregate([{ $group: { _id: '$subject', avg: { $avg: '$rating' }, n: { $sum: 1 } } }]),
  ]);
  await models.Project.bulkWrite(bookmarkAgg.map((b) => ({ updateOne: { filter: { _id: b._id }, update: { bookmarkCount: b.n } } })), { timestamps: false });
  await models.Course.bulkWrite(enrollAgg.map((e) => ({ updateOne: { filter: { _id: e._id }, update: { enrolledCount: e.n } } })), { timestamps: false });
  await models.User.bulkWrite(reviewAgg.map((r) => ({ updateOne: { filter: { _id: r._id }, update: { ratingAverage: Math.round(r.avg * 10) / 10, ratingCount: r.n } } })), { timestamps: false });

  console.log(`\n✅ Seed complete in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.table(counts);
  console.log(`Demo login → ${DEMO.email} / ${process.env.SEED_DEMO_PASSWORD ? '(SEED_DEMO_PASSWORD)' : demoPassword}`);
  console.log(`Synthetic users → <any synthetic email> / ${process.env.SEED_USER_PASSWORD ? '(SEED_USER_PASSWORD)' : syntheticPassword}`);
  await disconnectDB();
};

const main = async () => {
  const data = loadData();
  const errors = validateData(data);
  console.log('Dataset counts:', Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])));
  if (errors.length) {
    console.error(`❌ Dataset validation failed (${errors.length} problems):`);
    errors.slice(0, 30).forEach((e) => console.error('  -', e));
    process.exit(1);
  }
  console.log('✅ Dataset validation passed: counts, required fields, references and skill names are consistent.');
  if (process.argv.includes('--validate-only')) return;
  await seed(data);
};

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  });
}

module.exports = { loadData, validateData, oid };
