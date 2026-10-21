// Shared test setup. Tests run against a SEPARATE database (default
// mongodb://localhost:27017/skillbridge_test) which is wiped between test files.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/skillbridge_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../app');
const { connectDB } = require('../config/db');

const setup = async () => {
  await connectDB(process.env.MONGO_URI);
  const dbName = mongoose.connection.db.databaseName;
  if (!dbName.endsWith('_test')) throw new Error(`Refusing to wipe non-test database "${dbName}"`);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
};

const teardown = () => mongoose.disconnect();

let counter = 0;
const registerUser = async (overrides = {}) => {
  counter += 1;
  const body = {
    firstName: 'Test',
    lastName: `User${counter}`,
    email: `user${counter}.${Date.now()}@test.example`,
    password: 'Passw0rd!',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.token, user: res.body.data.user, password: body.password };
};

const api = (token) => {
  const wrap = (method) => (url) => {
    const r = request(app)[method](url);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
  };
  return { get: wrap('get'), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), delete: wrap('delete') };
};

// AI-dependent tests are skipped (not faked) when the AI service is not running.
const aiAvailable = async () => {
  try {
    const res = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
};

module.exports = { app, setup, teardown, registerUser, api, aiAvailable, request };
