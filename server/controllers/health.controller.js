const mongoose = require('mongoose');

const getHealth = (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.status(dbUp ? 200 : 503).json({
    status: dbUp ? 'ok' : 'degraded',
    message: dbUp ? 'SkillBridge AI server is healthy 💚' : 'Database is not connected',
    database: dbUp ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: `${process.uptime().toFixed(0)} seconds`,
  });
};

module.exports = { getHealth };
