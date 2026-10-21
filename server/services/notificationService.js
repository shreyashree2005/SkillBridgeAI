const Notification = require('../models/Notification');
const realtime = require('./realtime');
const logger = require('../utils/logger');

// Create a notification and push it live to the user if they are connected.
// Notification failures must never break the main action, so errors are logged.
const notify = async (userId, { type = 'system', title, body = '', link = '' }) => {
  try {
    const notification = await Notification.create({ user: userId, type, title, body, link });
    realtime.emitToUser(String(userId), 'notification:new', notification.toJSON());
    return notification;
  } catch (err) {
    logger.error('Failed to create notification', err);
    return null;
  }
};

module.exports = { notify };
