const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Connects to MongoDB (local or Atlas — only the URI differs).
// Throws instead of exiting so the caller decides what to do.
const connectDB = async (uri) => {
  mongoose.set('strictQuery', true);
  const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  logger.info(`MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
  return conn;
};

const disconnectDB = () => mongoose.disconnect();

module.exports = { connectDB, disconnectDB };
