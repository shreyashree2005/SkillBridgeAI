const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const chatService = require('../services/chatService');
const realtime = require('../services/realtime');

const PERSON = 'firstName lastName headline profileImage';

// GET /api/chat/conversations — my conversations with unread counts.
const listConversations = async (req, res) => {
  const me = req.user._id;
  const convos = await Conversation.find({ participants: me })
    .populate('participants', PERSON)
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .lean();

  const unread = await Message.aggregate([
    { $match: { conversation: { $in: convos.map((c) => c._id) }, readBy: { $ne: me } } },
    { $group: { _id: '$conversation', count: { $sum: 1 } } },
  ]);
  const unreadBy = new Map(unread.map((u) => [String(u._id), u.count]));

  const items = convos.map((c) => {
    const other = c.participants.find((p) => String(p._id) !== String(me)) || c.participants[0];
    return {
      _id: c._id,
      other: { ...other, online: realtime.isOnline(other._id) },
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageSender: c.lastMessageSender,
      unread: unreadBy.get(String(c._id)) || 0,
    };
  });
  res.json({ success: true, data: { items } });
};

// POST /api/chat/conversations { userId } — open (or reuse) a chat with someone.
const startConversation = async (req, res) => {
  const convo = await chatService.getOrCreateConversation(req.user._id, req.valid.body.userId);
  res.status(201).json({ success: true, data: { conversation: convo } });
};

// GET /api/chat/conversations/:id/messages?before=&limit=
const getMessages = async (req, res) => {
  const convo = await chatService.getConversationFor(req.user._id, req.valid.params.id);
  const { before, limit = 50 } = req.valid.query;
  const filter = { conversation: convo._id };
  if (before) filter.createdAt = { $lt: before };
  const items = (await Message.find(filter).sort({ createdAt: -1 }).limit(limit).lean()).reverse();
  res.json({ success: true, data: { items, hasMore: items.length === limit } });
};

// POST /api/chat/conversations/:id/messages — REST fallback when sockets are unavailable.
const sendMessage = async (req, res) => {
  const message = await chatService.sendMessage(req.user._id, req.valid.params.id, req.valid.body.body);
  res.status(201).json({ success: true, data: { message } });
};

// POST /api/chat/conversations/:id/read
const markRead = async (req, res) => {
  const convo = await chatService.getConversationFor(req.user._id, req.valid.params.id);
  await Message.updateMany({ conversation: convo._id, readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
  res.json({ success: true });
};

// GET /api/chat/unread-count
const unreadCount = async (req, res) => {
  const convos = await Conversation.find({ participants: req.user._id }).select('_id').lean();
  const count = await Message.countDocuments({ conversation: { $in: convos.map((c) => c._id) }, readBy: { $ne: req.user._id } });
  res.json({ success: true, data: { count } });
};

module.exports = { listConversations, startConversation, getMessages, sendMessage, markRead, unreadCount };
