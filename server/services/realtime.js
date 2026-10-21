// Keeps a reference to the Socket.IO server so any service can push events
// to a user's private room ("user:<id>"). Safe to call when sockets are not
// initialised (e.g. in tests) — it simply does nothing.
let io = null;
const online = new Map(); // userId -> number of open sockets

module.exports = {
  setIO: (instance) => { io = instance; },
  emitToUser: (userId, event, payload) => {
    if (io) io.to(`user:${userId}`).emit(event, payload);
  },
  markOnline: (userId) => online.set(userId, (online.get(userId) || 0) + 1),
  markOffline: (userId) => {
    const n = (online.get(userId) || 1) - 1;
    if (n <= 0) online.delete(userId);
    else online.set(userId, n);
    return n <= 0;
  },
  isOnline: (userId) => online.has(String(userId)),
};
