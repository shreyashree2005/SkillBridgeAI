// server/config/env.js
//
// Reads and validates environment variables ONCE at startup.
// If something required is missing, the server refuses to start with a clear
// message instead of failing later in a confusing way.

const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required (e.g. mongodb://localhost:27017/skillbridge)'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Comma-separated list of allowed browser origins for CORS and Socket.IO.
  CLIENT_URL: z.string().default('http://localhost:5173'),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  // Shared secret sent to the AI service. Optional in development.
  AI_SERVICE_KEY: z.string().default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`❌ Invalid environment configuration:\n${problems}\nSee server/.env.example`);
  process.exit(1);
}

const env = parsed.data;

if (env.NODE_ENV === 'production') {
  if (env.JWT_SECRET.length < 32) {
    console.error('❌ In production JWT_SECRET must be at least 32 characters.');
    process.exit(1);
  }
  if (!env.AI_SERVICE_KEY) {
    console.error('❌ In production AI_SERVICE_KEY must be set.');
    process.exit(1);
  }
}

env.clientOrigins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
env.isTest = env.NODE_ENV === 'test';
env.isProd = env.NODE_ENV === 'production';

module.exports = env;
