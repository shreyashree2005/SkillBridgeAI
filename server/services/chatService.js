// Chat business logic shared by the REST API and Socket.IO.
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const realtime = require('./realtime');
const { sameId } = require('../utils/helpers');

const getOrCreateConversation = async (userId, otherId) => {
  if (sameId(userId, otherId)) throw AppError.badRequest('You cannot start a chat with yourself.');
  const other = await User.exists({ _id: otherId, isActive: true });
  if (!other) throw AppError.notFound('User not found.');

  const key = Conversation.keyFor(userId, otherId);
  return Conversation.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, participants: [userId, otherId], lastMessageAt: new Date() } },
    { upsert: true, returnDocument: 'after' }
  );
};

// Loads a conversation and checks the user is a participant.
const getConversationFor = async (userId, conversationId) => {
  const convo = await Conversation.findById(conversationId);
  if (!convo || !convo.participants.some((p) => sameId(p, userId))) {
    throw AppError.notFound('Conversation not found.');
  }
  return convo;
};

const sendMessage = async (userId, conversationId, rawBody) => {
  const body = String(rawBody || '').trim();
  if (!body) throw AppError.badRequest('Message cannot be empty.');
  if (body.length > 2000) throw AppError.badRequest('Message is too long (max 2000 characters).');

  const convo = await getConversationFor(userId, conversationId);
  const message = await Message.create({ conversation: convo._id, sender: userId, body, readBy: [userId] });

  convo.lastMessageAt = message.createdAt;
  convo.lastMessagePreview = body.slice(0, 140);
  convo.lastMessageSender = userId;
  await convo.save();

  const payload = message.toJSON();
  for (const participant of convo.participants) {
    realtime.emitToUser(String(participant), 'message:new', payload);
  }
  return payload;
};

module.exports = { getOrCreateConversation, getConversationFor, sendMessage };
