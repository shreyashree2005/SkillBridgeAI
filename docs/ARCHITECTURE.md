# Architecture

## Services
| Service | Stack | Port | Responsibility |
|---|---|---|---|
| `client/` | React 19, Vite, React Router 7, socket.io-client, lucide-react | 5173 | SPA; all UI state; talks only to the API |
| `server/` | Node 20+, Express 5, Mongoose 9, Socket.IO 4, zod, helmet, express-rate-limit, multer | 5000 | Auth, business rules, persistence, realtime, orchestration of AI calls |
| `ai-service/` | Python 3.11+, FastAPI, scikit-learn, pypdf, python-docx, optional anthropic SDK / Ollama | 8000 | Stateless algorithms: parsing, matching, recommendations, roadmap, interview, assistant |
| MongoDB | local or Atlas | 27017 | Persistent data |

## Server layout (MVC + services)
```
server/
├── server.js            boot: env → DB → HTTP + Socket.IO → graceful shutdown
├── app.js               Express app (helmet, CORS allow-list, JSON limits, rate limits, routes, errors)
├── config/              env.js (zod-validated env), db.js
├── models/              Mongoose schemas (18 models)
├── validators/          zod request schemas (unknown fields stripped)
├── middleware/          authMiddleware, validate, errorHandler, rateLimiters, upload
├── controllers/         one per domain; thin, call services/models
├── services/            aiClient, chatService, notificationService, profileContext, realtime
├── sockets/             Socket.IO auth + chat events
├── routes/              index.js (all /api routes), auth.js, health.routes.js
├── scripts/seed.js      dataset validation + idempotent seeding
└── tests/               node:test + supertest (+ socket.io-client)
```
Express 5 forwards errors from async handlers automatically; every error ends in `middleware/errorHandler.js`, which
maps validation, cast, duplicate-key, multer and JSON errors to clean 4xx responses and hides internals on 5xx.

## Security measures
- bcrypt (cost 12) password hashing; passwords and token versions never serialised.
- JWT with a per-user `tokenVersion` → logout revokes all existing tokens; sockets use the same check.
- zod validation on every body/query/param; unknown fields stripped (no mass assignment of `owner`, `rating`, …).
- Ownership/participation checks on every mutating route (projects, offers, sessions, chats, applications, resumes).
- helmet headers, CORS allow-list (`CLIENT_URL`), JSON body limit 200 KB, rate limiting (auth/AI/general).
- Uploads: memory only, size limit, extension + MIME + magic-byte signature checks; only extracted text is kept.
- Regex inputs escaped (no ReDoS); user links restricted to http(s).
- Server ↔ AI service authenticated with a shared secret (constant-time comparison); required in production.
- Secrets only in git-ignored `.env` files; LLM API keys stay on the AI service.

## Request flow example: job match
1. Browser `GET /api/jobs/:id/match` with the JWT.
2. `authMiddleware` → `validate` → `job.controller.matchJob`.
3. `profileContext.getCandidateProfile` loads profile skills + the latest resume text.
4. `aiClient.match` → `POST ai-service/match` (with `X-Internal-Key`).
5. Result returned; `matchScore` saved on the user's application if one exists.

## Database schema overview
| Collection | Key fields | Relationships / indexes |
|---|---|---|
| users | name, email (unique), password (hashed, hidden), tokenVersion, role, headline, bio, skills[{name, level, years}], interests, links, lookingForTeam, availability, ratingAverage/Count, isSynthetic | text index; `skills.name`; `lookingForTeam+role` |
| projects | owner → users, members[] → users, title, description, techStack, rolesNeeded, status, category, bookmarkCount | text index; techStack; members |
| bookmarks | user, project | unique (user, project) |
| joinrequests | project, user, message, status | unique (project, user) |
| courses | slug (unique), title, skills, level, modules[{title, durationMinutes}], enrolledCount | skills+level; text |
| enrollments | user, course, completedModules[], progress, status | unique (user, course) |
| mentoroffers | mentor → users, title, skill, level, sessionMinutes, mode, isActive | skill+isActive |
| mentorsessions | offer, mentor, learner, scheduledAt, status, meetingLink, reviewed | mentor; learner |
| reviews | reviewer, subject (mentor), session (unique), rating 1-5, comment | subject |
| conversations | participants[2], key (unique sorted pair), lastMessage* | participants+lastMessageAt |
| messages | conversation, sender, body, readBy[] | conversation+createdAt |
| notifications | user, type, title, body, link, read | user+read+createdAt |
| jobs | externalId, title, company, requiredSkills, niceToHaveSkills, minYearsExperience, salary, remote | text; requiredSkills; postedAt |
| applications | user, job, status, statusHistory[], notes, matchScore | unique (user, job) |
| resumes | user, originalName, text (hidden), parsed{skills, sections, years, education}, analysis{score, breakdown, …} | user |
| careergoals | user, targetRole, targetDate, hoursPerWeek, status | user |
| interviewsessions | user, role, questions[{qid, question, answer, evaluation}], overallScore, status | user |
| assistantmessages | user, role, content, provider, sources | user+createdAt |
| skills / roleprofiles | taxonomy reference data | name / title unique |

## Frontend structure
```
client/src/
├── App.jsx              routes (lazy-loaded pages), providers
├── context/             Auth, Theme, Toast, Realtime (single socket, unread counts)
├── lib/                 api.js (fetch wrapper), hooks.js, format.js
├── components/          ui.jsx (design-system components), Layout, charts, SkillInput, ProjectForm, MatchResult
├── pages/               one file per area
└── styles/              tokens.css (light/dark), base, components, layout
```
Design tokens live in `styles/tokens.css`; dark mode follows the OS unless the user toggles it (`data-theme`).
Charts are hand-written SVG/HTML using a colour-blind-validated palette, with hover tooltips and screen-reader tables.
