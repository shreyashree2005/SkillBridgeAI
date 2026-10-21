const MentorOffer = require('../models/MentorOffer');
const MentorSession = require('../models/MentorSession');
const Review = require('../models/Review');
const AppError = require('../utils/AppError');
const { notify } = require('../services/notificationService');
const { getPagination, paginated, exactCI, escapeRegex, sameId } = require('../utils/helpers');

const PERSON = 'firstName lastName headline profileImage ratingAverage ratingCount';

// ---------- Offers ----------

// GET /api/mentoring/offers
const listOffers = async (req, res) => {
  const { q, skill, mentor } = req.valid.query;
  const pg = getPagination(req.valid.query, { defaultLimit: 12 });
  const filter = { isActive: true };
  if (skill) filter.skill = exactCI(skill);
  if (mentor) filter.mentor = mentor;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { skill: rx }, { description: rx }];
  }
  const [items, total] = await Promise.all([
    MentorOffer.find(filter).populate('mentor', PERSON).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    MentorOffer.countDocuments(filter),
  ]);
  res.json({ success: true, data: paginated(items, total, pg) });
};

// GET /api/mentoring/offers/mine
const myOffers = async (req, res) => {
  const items = await MentorOffer.find({ mentor: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: { items } });
};

// POST /api/mentoring/offers
const createOffer = async (req, res) => {
  const offer = await MentorOffer.create({ ...req.valid.body, mentor: req.user._id });
  // Offering mentorship makes the user a mentor as well.
  if (req.user.role === 'student') {
    req.user.role = 'both';
    await req.user.save();
  }
  res.status(201).json({ success: true, message: 'Mentoring offer published.', data: { offer } });
};

const loadOwnOffer = async (id, user) => {
  const offer = await MentorOffer.findById(id);
  if (!offer) throw AppError.notFound('Offer not found.');
  if (!sameId(offer.mentor, user._id)) throw AppError.forbidden('You can only manage your own offers.');
  return offer;
};

// PATCH /api/mentoring/offers/:id
const updateOffer = async (req, res) => {
  const offer = await loadOwnOffer(req.valid.params.id, req.user);
  Object.assign(offer, req.valid.body);
  await offer.save();
  res.json({ success: true, message: 'Offer updated.', data: { offer } });
};

// DELETE /api/mentoring/offers/:id — soft delete keeps session history intact.
const deleteOffer = async (req, res) => {
  const offer = await loadOwnOffer(req.valid.params.id, req.user);
  offer.isActive = false;
  await offer.save();
  res.json({ success: true, message: 'Offer archived.' });
};

// ---------- Sessions ----------

// POST /api/mentoring/offers/:id/sessions — learner requests a session.
const requestSession = async (req, res) => {
  const offer = await MentorOffer.findOne({ _id: req.valid.params.id, isActive: true });
  if (!offer) throw AppError.notFound('Offer not found.');
  if (sameId(offer.mentor, req.user._id)) throw AppError.badRequest('You cannot book your own offer.');

  const session = await MentorSession.create({
    offer: offer._id,
    mentor: offer.mentor,
    learner: req.user._id,
    skill: offer.skill,
    durationMinutes: offer.sessionMinutes,
    scheduledAt: req.valid.body.scheduledAt,
    message: req.valid.body.message || '',
  });
  await notify(offer.mentor, {
    type: 'session-requested',
    title: `${req.user.firstName} requested a ${offer.skill} session`,
    body: req.valid.body.message || '',
    link: '/mentoring?tab=sessions',
  });
  res.status(201).json({ success: true, message: 'Session requested.', data: { session } });
};

// GET /api/mentoring/sessions?as=mentor|learner|all
const listSessions = async (req, res) => {
  const { as = 'all', status } = req.valid.query;
  const me = req.user._id;
  const filter = as === 'mentor' ? { mentor: me } : as === 'learner' ? { learner: me } : { $or: [{ mentor: me }, { learner: me }] };
  if (status) filter.status = status;
  const items = await MentorSession.find(filter)
    .populate('mentor', PERSON)
    .populate('learner', PERSON)
    .populate('offer', 'title skill')
    .sort({ scheduledAt: -1 })
    .limit(100);
  res.json({ success: true, data: { items } });
};

// Allowed status changes and who may make them.
const TRANSITIONS = {
  accepted: { from: ['requested'], by: 'mentor' },
  declined: { from: ['requested'], by: 'mentor' },
  completed: { from: ['accepted'], by: 'either' },
  cancelled: { from: ['requested', 'accepted'], by: 'either' },
};

// PATCH /api/mentoring/sessions/:id
const updateSession = async (req, res) => {
  const session = await MentorSession.findById(req.valid.params.id);
  if (!session) throw AppError.notFound('Session not found.');
  const isMentor = sameId(session.mentor, req.user._id);
  const isLearner = sameId(session.learner, req.user._id);
  if (!isMentor && !isLearner) throw AppError.notFound('Session not found.');

  const { status, meetingLink } = req.valid.body;
  const rule = TRANSITIONS[status];
  if (!rule.from.includes(session.status)) {
    throw AppError.badRequest(`Cannot change a ${session.status} session to ${status}.`);
  }
  if (rule.by === 'mentor' && !isMentor) throw AppError.forbidden('Only the mentor can do that.');

  session.status = status;
  if (meetingLink !== undefined && isMentor) session.meetingLink = meetingLink;
  await session.save();

  const other = isMentor ? session.learner : session.mentor;
  await notify(other, {
    type: 'session-updated',
    title: `Your ${session.skill} session was ${status}`,
    link: '/mentoring?tab=sessions',
  });
  res.json({ success: true, message: `Session ${status}.`, data: { session } });
};

// POST /api/mentoring/sessions/:id/review — learner rates a completed session.
const reviewSession = async (req, res) => {
  const session = await MentorSession.findById(req.valid.params.id);
  if (!session || !sameId(session.learner, req.user._id)) throw AppError.notFound('Session not found.');
  if (session.status !== 'completed') throw AppError.badRequest('You can only review completed sessions.');
  if (session.reviewed) throw AppError.conflict('You already reviewed this session.');

  const review = await Review.create({
    reviewer: req.user._id,
    subject: session.mentor,
    session: session._id,
    rating: req.valid.body.rating,
    comment: req.valid.body.comment || '',
  });
  session.reviewed = true;
  await session.save();
  await Review.recomputeFor(session.mentor);
  await notify(session.mentor, {
    type: 'review-received',
    title: `${req.user.firstName} rated your session ${review.rating}★`,
    body: review.comment,
    link: `/profile/${session.mentor}`,
  });
  res.status(201).json({ success: true, message: 'Thanks for your review!', data: { review } });
};

module.exports = {
  listOffers, myOffers, createOffer, updateOffer, deleteOffer,
  requestSession, listSessions, updateSession, reviewSession,
};
