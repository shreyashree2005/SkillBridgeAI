// Socket.IO setup: authenticates each connection with the same JWT as the
// REST API, puts the user in a private room and handles chat events.
const { Server } = require('socket.io');
const env = require('../config/env');
const realtime = require('../services/realtime');
const chatService = require('../services/chatService');
const { authenticateToken } = require('../middleware/authMiddleware');
const User = require('../models/User');
const logger = require('../utils/logger');

const initSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins, credentials: true },
    maxHttpBufferSize: 1e5, // 100 KB per message is plenty for chat
  });

  io.use(async (socket, next) => {
    try {
      socket.user = await authenticateToken(socket.handshake.auth?.token);
      next();
    } catch (err) {
      next(new Error(err.message || 'Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user._id);
    socket.join(`user:${userId}`);
    realtime.markOnline(userId);
    io.emit('presence:update', { userId, online: true });

    socket.on('message:send', async (data, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const message = await chatService.sendMessage(userId, data?.conversationId, data?.body);
        reply({ ok: true, message });
      } catch (err) {
        reply({ ok: false, error: err.isOperational ? err.message : 'Could not send message.' });
      }
    });

    socket.on('typing', async (data) => {
      try {
        const convo = await chatService.getConversationFor(userId, data?.conversationId);
        for (const p of convo.participants) {
          if (String(p) !== userId) realtime.emitToUser(String(p), 'typing', { conversationId: String(convo._id), userId });
        }
      } catch {
        /* ignore typing events for invalid conversations */
      }
    });

    socket.on('disconnect', async () => {
      if (realtime.markOffline(userId)) {
        io.emit('presence:update', { userId, online: false });
        await User.updateOne({ _id: userId }, { lastSeenAt: new Date() }).catch((e) => logger.error(e));
      }
    });
  });

  realtime.setIO(io);
  return io;
};

module.exports = initSockets;
