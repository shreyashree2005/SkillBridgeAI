// Request validation schemas (zod). Each route declares exactly what it accepts;
// unknown fields are stripped, so clients can't set things like `owner` or `role`
// on records they shouldn't control.
const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const idParam = z.object({ id: objectId });
const str = (max, min = 0) => z.string().trim().min(min).max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Must be a valid http(s) URL')
  .optional();
const skillName = str(60, 1);
const skillList = z.array(skillName).max(30);
const pageQuery = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};
const boolish = z.enum(['true', 'false']).transform((v) => v === 'true');

// ---------- Auth ----------
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const auth = {
  register: z.object({
    firstName: str(50, 1),
    lastName: str(50, 1),
    email: z.string().trim().toLowerCase().pipe(z.email('Please provide a valid email')),
    password,
    role: z.enum(['student', 'mentor', 'both']).optional(),
  }),
  login: z.object({
    email: z.string().trim().toLowerCase().pipe(z.email('Please provide a valid email')),
    password: z.string().min(1, 'Password is required').max(128),
  }),
};

// ---------- Users / profile ----------
const skillEntry = z.object({
  name: skillName,
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('beginner'),
  yearsOfExperience: z.coerce.number().min(0).max(50).default(0),
});

const users = {
  updateMe: z
    .object({
      firstName: str(50, 1),
      lastName: str(50, 1),
      role: z.enum(['student', 'mentor', 'both']),
      headline: str(120),
      bio: str(1500),
      location: str(100),
      university: str(120),
      graduationYear: z.coerce.number().int().min(1980).max(2040).nullable(),
      profileImage: optionalUrl,
      links: z.object({ github: optionalUrl, linkedin: optionalUrl, portfolio: optionalUrl }).partial(),
      interests: z.array(str(40, 1)).max(20),
      lookingForTeam: z.boolean(),
      availability: z.enum(['full-time', 'part-time', 'weekends', 'unavailable']),
    })
    .partial(),
  setSkills: z.object({ skills: z.array(skillEntry).max(40) }),
  list: z.object({
    ...pageQuery,
    q: str(100).optional(),
    skill: skillName.optional(),
    role: z.enum(['student', 'mentor', 'both']).optional(),
    lookingForTeam: boolish.optional(),
  }),
};

// ---------- Projects ----------
const projectBody = z.object({
  title: str(120, 3),
  summary: str(200).optional(),
  description: str(5000, 20),
  category: z.enum(['web', 'mobile', 'ai-ml', 'data', 'devops', 'security', 'game', 'iot', 'blockchain', 'other']).optional(),
  techStack: skillList.optional(),
  rolesNeeded: skillList.optional(),
  status: z.enum(['idea', 'in-progress', 'completed']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  repoUrl: optionalUrl,
  demoUrl: optionalUrl,
  maxTeamSize: z.coerce.number().int().min(1).max(20).optional(),
  lookingForMembers: z.boolean().optional(),
});

const projects = {
  create: projectBody,
  update: projectBody.partial(),
  list: z.object({
    ...pageQuery,
    q: str(100).optional(),
    skill: skillName.optional(),
    category: z.string().max(20).optional(),
    status: z.enum(['idea', 'in-progress', 'completed']).optional(),
    lookingForMembers: boolish.optional(),
    sort: z.enum(['newest', 'popular']).optional(),
  }),
  joinRequest: z.object({ message: str(500).optional() }),
  decideRequest: z.object({ status: z.enum(['accepted', 'declined']) }),
  requestParams: z.object({ id: objectId, requestId: objectId }),
  memberParams: z.object({ id: objectId, userId: objectId }),
};

// ---------- Learning ----------
const courses = {
  list: z.object({
    ...pageQuery,
    q: str(100).optional(),
    skill: skillName.optional(),
    level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  }),
  progress: z.object({ moduleIndex: z.coerce.number().int().min(0), completed: z.boolean() }),
};

// ---------- Mentoring ----------
const offerBody = z.object({
  title: str(120, 5),
  skill: skillName,
  description: str(2000).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  sessionMinutes: z.coerce.number().refine((n) => [30, 45, 60, 90].includes(n), 'Must be 30, 45, 60 or 90').optional(),
  mode: z.enum(['online', 'in-person']).optional(),
  isActive: z.boolean().optional(),
});

const mentoring = {
  createOffer: offerBody,
  updateOffer: offerBody.partial(),
  listOffers: z.object({ ...pageQuery, q: str(100).optional(), skill: skillName.optional(), mentor: objectId.optional() }),
  requestSession: z.object({
    scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), 'Pick a time in the future'),
    message: str(1000).optional(),
  }),
  listSessions: z.object({ as: z.enum(['mentor', 'learner', 'all']).optional(), status: z.string().max(20).optional() }),
  updateSession: z.object({
    status: z.enum(['accepted', 'declined', 'completed', 'cancelled']),
    meetingLink: optionalUrl,
  }),
  review: z.object({ rating: z.coerce.number().int().min(1).max(5), comment: str(1000).optional() }),
};

// ---------- Chat ----------
const chat = {
  start: z.object({ userId: objectId }),
  send: z.object({ body: str(2000, 1) }),
  history: z.object({ before: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }),
};

// ---------- Jobs & applications ----------
const jobs = {
  list: z.object({
    ...pageQuery,
    q: str(100).optional(),
    skill: skillName.optional(),
    remote: boolish.optional(),
    employmentType: z.enum(['full-time', 'part-time', 'internship', 'contract']).optional(),
    experienceLevel: z.enum(['internship', 'entry', 'mid', 'senior']).optional(),
  }),
};

const applications = {
  create: z.object({
    jobId: objectId,
    status: z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn']).optional(),
    notes: str(2000).optional(),
  }),
  update: z
    .object({
      status: z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn']),
      notes: str(2000),
    })
    .partial(),
};

// ---------- Resumes & AI ----------
const ai = {
  match: z
    .object({ jobId: objectId.optional(), jobDescription: str(8000).optional() })
    .refine((v) => v.jobId || (v.jobDescription && v.jobDescription.length >= 30), 'Provide a jobId or a job description (30+ characters)'),
  targetRole: z.object({ targetRole: str(80, 2) }),
  roadmap: z.object({
    targetRole: str(80, 2),
    hoursPerWeek: z.coerce.number().int().min(1).max(60).default(8),
  }),
  assistant: z.object({ message: str(2000, 1) }),
  interviewStart: z.object({
    role: str(80, 2),
    count: z.coerce.number().int().min(3).max(10).default(5),
  }),
  interviewAnswer: z.object({ qid: str(40, 1), answer: str(5000, 1) }),
  teammates: z.object({ projectId: objectId }),
};

const goals = {
  create: z.object({
    targetRole: str(80, 2),
    targetDate: z.coerce.date().optional(),
    hoursPerWeek: z.coerce.number().int().min(1).max(60).optional(),
    notes: str(1000).optional(),
  }),
  update: z
    .object({
      targetRole: str(80, 2),
      targetDate: z.coerce.date().nullable(),
      hoursPerWeek: z.coerce.number().int().min(1).max(60),
      status: z.enum(['active', 'achieved', 'paused']),
      notes: str(1000),
    })
    .partial(),
};

module.exports = {
  objectId, idParam, auth, users, projects, courses, mentoring, chat, jobs, applications, ai, goals,
  catalogQuery: z.object({ q: str(60).optional(), limit: z.coerce.number().int().min(1).max(200).optional() }),
};
