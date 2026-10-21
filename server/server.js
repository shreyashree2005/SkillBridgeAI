// Entry point: connect to MongoDB, start HTTP + Socket.IO, shut down cleanly.
const http = require('http');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');
const initSockets = require('./sockets');
const logger = require('./utils/logger');

const start = async () => {
  try {
    await connectDB(env.MONGO_URI);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    logger.error('Check MONGO_URI in server/.env and that MongoDB is running (see README → Troubleshooting).');
    process.exit(1);
  }

  const server = http.createServer(app);
  initSockets(server);

  server.listen(env.PORT, () => {
    logger.info(`✅ Server running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down…`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));

start();
