const Project = require('../models/Project');
const Bookmark = require('../models/Bookmark');
const JoinRequest = require('../models/JoinRequest');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { notify } = require('../services/notificationService');
const { getPagination, paginated, exactCI, escapeRegex, uniqueCI, sameId } = require('../utils/helpers');

const PERSON = 'firstName lastName headline profileImage skills';

const loadProject = async (id) => {
  const project = await Project.findById(id);
  if (!project) throw AppError.notFound('Project not found.');
  return project;
};

const assertOwner = (project, user) => {
  if (!sameId(project.owner, user._id)) throw AppError.forbidden('Only the project owner can do that.');
};

const cleanLists = (body) => {
  if (body.techStack) body.techStack = uniqueCI(body.techStack);
  if (body.rolesNeeded) body.rolesNeeded = uniqueCI(body.rolesNeeded);
  return body;
};

// GET /api/projects — discovery with search, filters and pagination.
const listProjects = async (req, res) => {
  const { q, skill, category, status, lookingForMembers, sort } = req.valid.query;
  const pg = getPagination(req.valid.query, { defaultLimit: 12 });
  const filter = {};
  if (skill) filter.$or = [{ techStack: exactCI(skill) }, { rolesNeeded: exactCI(skill) }];
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (lookingForMembers !== undefined) filter.lookingForMembers = lookingForMembers;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$and = [{ $or: [{ title: rx }, { summary: rx }, { techStack: rx }, { description: rx }] }];
  }
  const order = sort === 'popular' ? { bookmarkCount: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total, bookmarks] = await Promise.all([
    Project.find(filter).populate('owner', PERSON).sort(order).skip(pg.skip).limit(pg.limit).lean(),
    Project.countDocuments(filter),
    Bookmark.find({ user: req.user._id }).select('project').lean(),
  ]);
  const marked = new Set(bookmarks.map((b) => String(b.project)));
  for (const p of items) p.isBookmarked = marked.has(String(p._id));
  res.json({ success: true, data: paginated(items, total, pg) });
};

// GET /api/projects/mine — projects I own or am a member of.
const myProjects = async (req, res) => {
  const items = await Project.find({ $or: [{ owner: req.user._id }, { members: req.user._id }] })
    .populate('owner', PERSON)
    .sort({ updatedAt: -1 });
  res.json({ success: true, data: { items } });
};

// GET /api/projects/bookmarks
const myBookmarks = async (req, res) => {
  const bookmarks = await Bookmark.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate({ path: 'project', populate: { path: 'owner', select: PERSON } })
    .lean();
  const items = bookmarks.filter((b) => b.project).map((b) => ({ ...b.project, isBookmarked: true }));
  res.json({ success: true, data: { items } });
};

// GET /api/projects/:id
const getProject = async (req, res) => {
  const project = await Project.findById(req.valid.params.id)
    .populate('owner', PERSON)
    .populate('members', PERSON)
    .lean();
  if (!project) throw AppError.notFound('Project not found.');

  const [bookmarked, myRequest] = await Promise.all([
    Bookmark.exists({ user: req.user._id, project: project._id }),
    JoinRequest.findOne({ user: req.user._id, project: project._id }).select('status message createdAt').lean(),
  ]);
  project.isBookmarked = Boolean(bookmarked);
  project.isOwner = sameId(project.owner._id, req.user._id);
  project.isMember = project.members.some((m) => sameId(m._id, req.user._id));
  project.myJoinRequest = myRequest;
  res.json({ success: true, data: { project } });
};

// POST /api/projects
const createProject = async (req, res) => {
  const project = await Project.create({ ...cleanLists(req.valid.body), owner: req.user._id, members: [req.user._id] });
  res.status(201).json({ success: true, message: 'Project created.', data: { project } });
};

// PATCH /api/projects/:id (owner only)
const updateProject = async (req, res) => {
  const project = await loadProject(req.valid.params.id);
  assertOwner(project, req.user);
  Object.assign(project, cleanLists(req.valid.body));
  await project.save();
  res.json({ success: true, message: 'Project updated.', data: { project } });
};

// DELETE /api/projects/:id (owner only) — also cleans up related records.
const deleteProject = async (req, res) => {
  const project = await loadProject(req.valid.params.id);
  assertOwner(project, req.user);
  await Promise.all([
    Bookmark.deleteMany({ project: project._id }),
    JoinRequest.deleteMany({ project: project._id }),
    project.deleteOne(),
  ]);
  res.json({ success: true, message: 'Project deleted.' });
};

// POST /api/projects/:id/bookmark
const addBookmark = async (req, res) => {
  const project = await loadProject(req.valid.params.id);
  const result = await Bookmark.updateOne(
    { user: req.user._id, project: project._id },
    { $setOnInsert: { user: req.user._id, project: project._id } },
    { upsert: true }
  );
  if (result.upsertedCount) await Project.updateOne({ _id: project._id }, { $inc: { bookmarkCount: 1 } });
  res.json({ success: true, message: 'Bookmarked.', data: { isBookmarked: true } });
};

// DELETE /api/projects/:id/bookmark
const removeBookmark = async (req, res) => {
  const { deletedCount } = await Bookmark.deleteOne({ user: req.user._id, project: req.valid.params.id });
  if (deletedCount) {
    await Project.updateOne({ _id: req.valid.params.id, bookmarkCount: { $gt: 0 } }, { $inc: { bookmarkCount: -1 } });
  }
  res.json({ success: true, message: 'Bookmark removed.', data: { isBookmarked: false } });
};

// POST /api/projects/:id/join-requests
const requestToJoin = async (req, res) => {
  const project = await loadProject(req.valid.params.id);
  if (project.members.some((m) => sameId(m, req.user._id))) throw AppError.badRequest('You are already a member.');
  if (!project.lookingForMembers) throw AppError.badRequest('This project is not accepting new members.');
  if (project.members.length >= project.maxTeamSize) throw AppError.badRequest('This team is full.');

  const existing = await JoinRequest.findOne({ project: project._id, user: req.user._id });
  if (existing && existing.status === 'pending') throw AppError.conflict('You already have a pending request.');

  const request = existing || new JoinRequest({ project: project._id, user: req.user._id });
  request.status = 'pending';
  request.message = req.valid.body.message || '';
  await request.save();

  await notify(project.owner, {
    type: 'join-request',
    title: `${req.user.firstName} wants to join "${project.title}"`,
    body: request.message,
    link: `/projects/${project._id}`,
  });
  res.status(201).json({ success: true, message: 'Request sent.', data: { request } });
};

// GET /api/projects/:id/join-requests (owner only)
const listJoinRequests = async (req, res) => {
  const project = await loadProject(req.valid.params.id);
  assertOwner(project, req.user);
  const items = await JoinRequest.find({ project: project._id })
    .populate('user', PERSON)
    .sort({ status: -1, createdAt: -1 });
  res.json({ success: true, data: { items } });
};

// PATCH /api/projects/:id/join-requests/:requestId (owner only)
const decideJoinRequest = async (req, res) => {
  const { id, requestId } = req.valid.params;
  const project = await loadProject(id);
  assertOwner(project, req.user);
  const request = await JoinRequest.findOne({ _id: requestId, project: project._id });
  if (!request) throw AppError.notFound('Request not found.');
  if (request.status !== 'pending') throw AppError.badRequest('This request was already handled.');

  const { status } = req.valid.body;
  if (status === 'accepted') {
    if (project.members.length >= project.maxTeamSize) throw AppError.badRequest('The team is already full.');
    await Project.updateOne({ _id: project._id }, { $addToSet: { members: request.user } });
  }
  request.status = status;
  await request.save();

  await notify(request.user, {
    type: status === 'accepted' ? 'join-accepted' : 'join-declined',
    title: status === 'accepted' ? `You joined "${project.title}" 🎉` : `Your request for "${project.title}" was declined`,
    link: `/projects/${project._id}`,
  });
  res.json({ success: true, message: `Request ${status}.`, data: { request } });
};

// DELETE /api/projects/:id/members/:userId — owner removes a member, or a member leaves.
const removeMember = async (req, res) => {
  const { id, userId } = req.valid.params;
  const project = await loadProject(id);
  const isSelf = sameId(userId, req.user._id);
  if (!isSelf) assertOwner(project, req.user);
  if (sameId(project.owner, userId)) throw AppError.badRequest('The owner cannot leave their own project.');

  await Project.updateOne({ _id: project._id }, { $pull: { members: userId } });
  if (!isSelf && (await User.exists({ _id: userId }))) {
    await notify(userId, { type: 'system', title: `You were removed from "${project.title}"`, link: '/projects' });
  }
  res.json({ success: true, message: isSelf ? 'You left the project.' : 'Member removed.' });
};

module.exports = {
  listProjects, myProjects, myBookmarks, getProject, createProject, updateProject, deleteProject,
  addBookmark, removeBookmark, requestToJoin, listJoinRequests, decideJoinRequest, removeMember,
};
