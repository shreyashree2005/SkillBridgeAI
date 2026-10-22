# 🌉 SkillBridge AI

> **Learn • Teach • Collaborate • Build • Get Hired**

SkillBridge AI is a full-stack, AI-assisted platform for students and early-career developers. It combines a
professional profile (LinkedIn-style), project collaboration and team finding (GitHub/Discord-style), courses and
peer mentoring (Coursera/Fiverr-style) and an explainable AI career assistant — resume analysis, job matching,
skill-gap analysis, learning roadmaps and interview practice.

Every AI score in the app shows **how it was calculated**. The AI features are rule-based and statistical
algorithms (TF-IDF, co-occurrence statistics, a prerequisite graph); an optional language model (local Ollama or
Anthropic Claude) can rephrase the career assistant's answers, which are always grounded in the user's own data.

---

## Contents
1. [Features](#features)
2. [Architecture](#architecture)
3. [Quick start (local)](#quick-start-local)
4. [Environment variables](#environment-variables)
5. [Datasets & seeding](#datasets--seeding)
6. [Testing](#testing)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)
9. [Known limitations](#known-limitations)
10. [Project status & history](#project-status--history)

More detail: [docs/API.md](docs/API.md) · [docs/AI.md](docs/AI.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · [docs/AUDIT.md](docs/AUDIT.md)

---

## Features

| Area | What works end to end |
|---|---|
| **Accounts** | Register, login, logout (server-side token revocation), protected routes, bcrypt password hashing, rate-limited auth |
| **Profiles & skills** | Editable profile, links, interests, skills with level & years, public profiles with projects/offers/reviews, profile-strength score |
| **Projects** | Create / edit / delete (owner only), search & filters, bookmarks, join requests (accept/decline), member management, AI project recommendations |
| **Team finder** | Complementary-teammate recommendations per project, people search |
| **Learning** | Course catalog, enrolment, module-by-module progress, learning history, completion notifications |
| **Teaching & mentoring** | Mentoring offers, session booking, accept/decline/complete/cancel workflow, meeting links, reviews & ratings |
| **Chat** | Real-time 1:1 messaging over Socket.IO (typing indicator, presence, unread counts) with REST fallback |
| **Notifications** | Stored + pushed live; mark read / all read / delete |
| **Resume analyzer** | PDF/DOCX/TXT upload (type + signature checked), text extraction, skill/section/experience parsing, 100-point rubric with suggestions |
| **Job match** | Weighted match score vs any listed job or a pasted job description, with matched/missing/inferred skills |
| **Jobs & applications** | Job discovery with filters, application tracker board with status history and notes |
| **AI career coach** | Skill-gap analysis, prerequisite-ordered learning roadmap with courses, skill recommendations, grounded chat assistant |
| **Interview prep** | Role-specific question sets, transparent rubric scoring with covered/missed points |
| **Dashboard** | Real aggregated analytics: weekly activity, pipeline, skill levels, interview trend, upcoming sessions |
| **UI** | Responsive layout, dark/light mode, loading skeletons, error & empty states, accessible charts |

---

## Architecture

```
SkillBridgeAI/
├── client/        React 19 + Vite SPA (React Router, Socket.IO client)
├── server/        Node.js + Express 5 REST API, Socket.IO, Mongoose (MVC + services + validators)
├── ai-service/    Python FastAPI service: resume parsing, matching, recommendations, roadmap, interview, assistant
├── datasets/      taxonomy/ (skills, roles, interview bank) + generator/ + generated/ synthetic data (JSON & CSV)
├── docs/          API, AI, architecture, deployment and audit documentation
└── render.yaml    Render blueprint for the three services
```

```
Browser ──HTTP/WebSocket──▶ Node API (Express + Socket.IO) ──▶ MongoDB (local or Atlas)
                                   │
                                   └──HTTP + shared secret──▶ Python AI service (stateless)
```

The browser never calls the AI service directly. The Node server gathers the user's data from MongoDB, sends it to
the AI service, and stores results. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Quick start (local)

### Prerequisites
- **Node.js 20.10+** (developed on 24) and npm
- **Python 3.11+** (developed on 3.13)
- **MongoDB** — a local MongoDB server *or* a free MongoDB Atlas cluster
- Optional: **Ollama** for a local language model in the career assistant

### 1. Install
```bash
# from the repository root
npm run setup                      # installs server/ and client/ dependencies

cd ai-service
python -m venv .venv
# Windows:  .venv\Scripts\activate      macOS/Linux:  source .venv/bin/activate
pip install -r requirements-dev.txt
cd ..
```

### 2. Configure
```bash
cp server/.env.example server/.env         # then edit MONGO_URI and JWT_SECRET
cp ai-service/.env.example ai-service/.env # optional; defaults work locally
cp client/.env.example client/.env         # optional; leave VITE_API_URL empty locally
```
Generate a JWT secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 3. Seed the database (≈5 seconds)
```bash
npm run seed
```
Expected output ends with `✅ Seed complete` and prints the demo login:
**demo@skillbridge.example / DemoPass123**

### 4. Run the three services (three terminals)
```bash
# Terminal 1 — AI service (venv activated)
cd ai-service && uvicorn app.main:app --port 8000 --reload

# Terminal 2 — API server
npm run dev:server          # http://localhost:5000/api/health

# Terminal 3 — frontend
npm run dev:client          # http://localhost:5173
```
Open http://localhost:5173 and log in with the demo account, or create your own.

---

## Environment variables

| Service | Variable | Required | Purpose |
|---|---|---|---|
| server | `MONGO_URI` | ✅ | MongoDB connection string (local or Atlas) |
| server | `JWT_SECRET` | ✅ | Token signing key (≥16 chars; ≥32 in production) |
| server | `JWT_EXPIRES_IN` | | Token lifetime, default `7d` |
| server | `CLIENT_URL` | prod | Allowed browser origin(s) for CORS & Socket.IO (comma-separated) |
| server | `AI_SERVICE_URL` | | AI service URL, default `http://localhost:8000` |
| server | `AI_SERVICE_KEY` | prod | Shared secret sent to the AI service |
| server | `MAX_UPLOAD_MB` | | Resume size limit, default 5 |
| ai-service | `AI_SERVICE_KEY` | prod | Must equal the server's value |
| ai-service | `LLM_PROVIDER` | | `none` (default), `ollama` or `anthropic` |
| ai-service | `OLLAMA_URL`, `OLLAMA_MODEL` | | Local model, e.g. `qwen2.5:3b` |
| ai-service | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | | Claude API key (server-side only), default model `claude-opus-5-5` |
| client | `VITE_API_URL` | prod | Public URL of the API server; empty in development |

`.env` files are git-ignored. Only `.env.example` files are committed.

**Enabling a language model for the assistant (optional):**
- *Ollama (free, local):* install Ollama, run `ollama pull qwen2.5:3b`, then set `LLM_PROVIDER=ollama` (and
  `OLLAMA_MODEL`) in `ai-service/.env`. Verified with `qwen2.5-coder:3b`.
- *Anthropic:* set `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`. Requests enable server-side refusal fallback.
  This path is implemented with the official SDK but was **not exercised against the live API** during development
  (no key available).
- If the model is unreachable, the assistant automatically returns its grounded rule-based answer and the UI shows
  which engine produced each reply.

---

## Datasets & seeding

`datasets/taxonomy/` is hand-curated reference data: **144 skills** (aliases, categories, prerequisites),
**17 role profiles** (weighted skills) and a **99-question interview bank** with grading key points.

`datasets/generated/` is produced by `python datasets/generator/generate.py` (fixed seed → byte-identical output):

| Collection | Count | Collection | Count |
|---|---|---|---|
| users | 1,000 | enrollments (learning history) | 3,000 |
| projects | 500 | bookmarks | 2,500 |
| jobs | 300 | applications | 1,500 |
| resumes (text + ground-truth skills) | 500 | career goals | 700 |
| courses | 228 | notifications | 2,633 |
| mentor offers / sessions | 260 / 900 | reviews | 398 |
| join requests | 450 | | |

All records are labelled `isSynthetic: true`, use the reserved `.example` e-mail domain, and reference fictional
universities and companies. CSV versions of users, projects, jobs, courses and resumes are included.

`npm run seed` validates counts, required fields, cross-references and skill names, then **upserts** every record
with a deterministic id — re-running it never creates duplicates and never deletes data (verified: identical
collection counts after a second run). `npm --prefix server run seed:validate` checks the files without touching the
database. Synthetic users can log in with `Synthetic2026!` (override with `SEED_USER_PASSWORD`).

---

## Testing

| Suite | Command | What it covers | Result at hand-off |
|---|---|---|---|
| AI service | `cd ai-service && python -m pytest -q` | Parsing (real PDF & DOCX), matching, gap, roadmap ordering, recommenders, interview rubric, assistant grounding, API auth/validation, **skill-extraction accuracy on 500 resumes** | 31 passed |
| Server | `npm run test:server` | Auth & token revocation, validation, ownership checks, projects, learning, mentoring + reviews, chat, applications, dashboard, **real AI-service integration**, **Socket.IO live delivery** | 21 passed |
| Client lint/build | `npm run lint:client && npm run build:client` | oxlint (no-undef, unused vars, hooks rules) + production build | 0 errors |
| Browser E2E | `npm run e2e` (needs all services running) | 27 real-browser steps: register, profile, every page, project, resume, job match, roadmap, assistant, interview, two-user live chat, dark mode, mobile layout, logout | 27/27, 3 consecutive runs |

Server tests use an isolated `skillbridge_test` database (the helper refuses to wipe any database not ending in
`_test`). AI-dependent server tests are **skipped, not faked,** when the AI service is down. E2E uses an installed
Chrome/Edge via `playwright-core`; set `E2E_BASE_URL` to point at the frontend.

---

## Deployment

The repository contains a [Render blueprint](render.yaml) (API + AI service + static site), `client/vercel.json`
and `client/public/_redirects` for SPA hosting on Vercel/Netlify. Database: MongoDB Atlas.
Step-by-step guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

> The application has **not** been deployed to a live URL as part of this work; the configuration is provided and
> documented but unverified against a real hosting account.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration` on server start | Copy `server/.env.example` → `server/.env` and fill `MONGO_URI`, `JWT_SECRET` |
| `MongoDB connection failed` | Start MongoDB (Windows service "MongoDB"), or check the Atlas URI, user/password and *Network Access* IP allow-list |
| Banner "AI service unavailable" / HTTP 503 from AI features | Start the AI service on port 8000 (`uvicorn app.main:app --port 8000`) and check `AI_SERVICE_URL` |
| `401 Invalid or missing internal service key` in AI logs | `AI_SERVICE_KEY` must be identical in `server/.env` and `ai-service/.env` (or empty in both for local dev) |
| Resume upload: "Could not find enough text" | The PDF is probably a scanned image; export a text-based PDF or DOCX |
| Login works but chat doesn't update live | Check the browser console for WebSocket errors; in production `CLIENT_URL` must list the frontend origin |
| `npm run seed` says dataset files missing | Run `npm run datasets` (needs Python) |
| Port already in use | Change `PORT` (server) or `--port` (AI/Vite); update `AI_SERVICE_URL`/proxy accordingly |

---

## Known limitations
- AI features are **transparent algorithms, not trained ML models**: TF-IDF similarity, co-occurrence statistics,
  keyword rubrics and rule-based parsing. Interview scoring checks key-point keywords, so a well-phrased answer
  using unexpected vocabulary can be under-scored.
- Skill-extraction accuracy (precision 0.997 / recall 1.000) is measured on **template-generated** resumes; real
  resumes with unusual layouts will score lower. Scanned (image-only) PDFs are not OCR'd.
- Chat is 1:1 only (no group channels or file attachments). Notifications are in-app only (no e-mail).
- Synthetic data is for demonstration; job listings and companies are fictional.
- JWTs are stored in `localStorage` (simple, works with sockets); an httpOnly-cookie session would further reduce
  XSS exposure.
- No e-mail verification or password reset flow.

---

## Project status & history
This project began as a skeleton (README, empty folders, Vite starter screen and a prototype auth API). An audit
found the signup endpoint crashing under Mongoose 9, an empty `.gitignore`, misplaced dependencies and a second
abandoned backend. All findings and fixes are recorded in [docs/AUDIT.md](docs/AUDIT.md).

The original prototype in `backend/` is kept on disk for reference but is git-ignored and unused; `server/` is the
single backend.

## Author
Built as a portfolio project to demonstrate full-stack + AI engineering. All demo data is synthetic.
