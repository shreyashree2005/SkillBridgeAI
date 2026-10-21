const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { getPagination, paginated } = require('../utils/helpers');

// GET /api/notifications?unread=true
const list = async (req, res) => {
  const pg = getPagination(req.query);
  const filter = { user: req.user._id };
  if (req.query.unread === 'true') filter.read = false;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({ success: true, data: { ...paginated(items, total, pg), unread } });
};

// GET /api/notifications/unread-count
const unreadCount = async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ success: true, data: { count } });
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.valid.params.id, user: req.user._id },
    { read: true },
    { returnDocument: 'after' }
  );
  if (!n) throw AppError.notFound('Notification not found.');
  res.json({ success: true, data: { notification: n } });
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  const { modifiedCount } = await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ success: true, message: `${modifiedCount} marked as read.` });
};

// DELETE /api/notifications/:id
const remove = async (req, res) => {
  const { deletedCount } = await Notification.deleteOne({ _id: req.valid.params.id, user: req.user._id });
  if (!deletedCount) throw AppError.notFound('Notification not found.');
  res.json({ success: true });
};

module.exports = { list, unreadCount, markRead, markAllRead, remove };
