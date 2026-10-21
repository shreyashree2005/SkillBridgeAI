// HTTP client for the Python AI service (ai-service/).
// The browser never talks to the AI service directly — only this server does,
// authenticated with a shared secret header.
const env = require('../config/env');
const AppError = require('../utils/AppError');

const headers = () => (env.AI_SERVICE_KEY ? { 'X-Internal-Key': env.AI_SERVICE_KEY } : {});

const call = async (path, init = {}) => {
  let res;
  try {
    res = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      ...init,
      headers: { ...headers(), ...(init.headers || {}) },
      signal: AbortSignal.timeout(env.AI_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timed out' : 'is not reachable';
    throw new AppError(503, `The AI service ${reason}. Make sure it is running (see README → AI service).`);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI puts messages in `detail` (string or list of validation errors).
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail;
    const status = res.status === 422 || res.status === 400 ? 400 : 502;
    throw new AppError(status, detail ? `AI service: ${detail}` : 'The AI service returned an error.');
  }
  return data;
};

const post = (path, body) =>
  call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const parseResume = (file) => {
  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  return call('/resume/parse', { method: 'POST', body: form });
};

module.exports = {
  health: () => call('/health'),
  parseResume,
  match: (body) => post('/match', body),
  skillGap: (body) => post('/skill-gap', body),
  roadmap: (body) => post('/roadmap', body),
  recommendSkills: (body) => post('/recommend/skills', body),
  recommendProjects: (body) => post('/recommend/projects', body),
  recommendTeammates: (body) => post('/recommend/teammates', body),
  assistant: (body) => post('/assistant', body),
  interviewQuestions: (body) => post('/interview/questions', body),
  interviewEvaluate: (body) => post('/interview/evaluate', body),
};
