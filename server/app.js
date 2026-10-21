// Builds the Express app (without starting it) so tests can import it.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1); // correct client IPs behind Render/Railway proxies (rate limiting)

app.use(helmet());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / server-to-server requests (no Origin header) and configured clients.
      if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

app.get('/', (req, res) => {
  res.json({ message: '🌉 SkillBridge AI API is running', version: '1.0.0', docs: '/docs/API.md' });
});

app.use('/api', apiLimiter, apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
