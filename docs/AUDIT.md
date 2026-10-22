# Audit report and repair log

## Starting point (audited before any change)
| Area | Found |
|---|---|
| Git | 4 commits: skeleton README/folders and a Vite starter screen. Server code, `backend/` and root deps were untracked. **Root `.gitignore` was empty** — `.env` files (JWT secret) would have been committed by `git add .` |
| `server/` | Express 5 app with `/api/health` and `/api/auth/{signup,login,me}`. Starting it worked; **signup crashed** (`next is not a function`: Mongoose 9 no longer passes `next` to `pre('save')`) — reproduced live |
| Dependencies | `mongoose` and `bcryptjs` missing from `server/package.json`; they were installed in the repository root and only resolved by accident. `nodemon` brought audit vulnerabilities |
| Case bug | Code required `../models/User` but the file was `user.js` — works on Windows, crashes on Linux hosting |
| `backend/` | A second, incomplete Express API (requires missing `./routes/auth` and `./utils/jwt`; cannot start) |
| `client/` | Vite + React 19 starter with one branded screen; no routing or pages |
| `ai-service/`, `datasets/`, `docs/` | Empty (`.gitkeep` only) |
| Security | No helmet, CORS open to all, no rate limiting, raw error messages returned to clients, fragile email regex |
| Tests | None |
| Database | Local MongoDB service running; `skillbridge` DB empty; legacy `skillshare` DB with 1 user (left untouched) |

## Repair & completion phases (each committed on branch `feature/complete-platform`)
1. **Git safety** — wrote `.gitignore` (env files, venvs, build output, legacy `backend/`), created the work branch,
   committed a checkpoint of the original code before modifying it.
2. **Backend foundation** — fixed the Mongoose hook, declared real dependencies, fixed the file-name case, replaced
   `nodemon` with `node --watch`, added env validation, security middleware, central error handling, token-version
   logout, 18 models, zod validators, controllers, services and Socket.IO. Original routes (`/signup`) kept working.
3. **Data** — curated taxonomy (144 skills, 17 roles, 99 interview questions); reproducible generator; idempotent,
   validating seed script (verified: identical counts after re-running).
4. **AI service** — FastAPI service with resume parsing, matching, gap analysis, roadmap, recommendations, interview
   evaluation and a grounded assistant with optional Ollama/Anthropic.
5. **Tests** — 31 pytest tests (including extraction accuracy on 500 resumes), 21 server integration tests
   (including live AI integration and Socket.IO). Found and fixed: raw resume text leaking in the upload response.
6. **Frontend** — design system with light/dark themes, responsive layout, all feature pages.
7. **Browser E2E** — 27-step real-browser journey. Found and fixed: post-registration redirect hijacked by the
   public-route guard; bare `github.com/...` links detected as a GitHub skill (a corrupted regex escape);
   unreadable chart labels on narrow cards.
8. **Docs & deployment** — README, API, AI, architecture, deployment guides; Render blueprint; SPA rewrites.

## Decisions
- **`server/` is the single backend.** It matched the README's architecture and was the more complete prototype;
  `backend/` is kept on disk (git-ignored) for reference and can be deleted.
- **Root `package.json`** now only holds helper scripts. The leftover root `node_modules/` from the earlier misplaced
  install is unused and can be deleted.
- **Bearer tokens** were kept (the original design) and hardened with server-side revocation.
- **Resume files are not stored** — only extracted text and analysis — to minimise sensitive data.

## Open items / suggestions
- E-mail verification and password reset need an e-mail provider.
- Optional: httpOnly-cookie sessions, group chat, file attachments, OCR for scanned resumes, CI pipeline
  (GitHub Actions running the three test suites).

---

## Pre-merge audit (second pass)

Re-ran every suite and added a 13-step two-user browser suite for workflows the first suite did not cover.

| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | 1,335 of 2,634 seeded notifications linked to dataset ids (`/projects/project-0348`) → "Project not found" | Functional bug | Seed rewrites links to real ObjectIds; re-seeding repaired existing documents (0 broken links verified) |
| 2 | Rate limits keyed only by IP: students behind one campus/hostel IP would lock each other out (20 logins / 15 min for the whole network) | Design bug | Login/register limited per account+IP (10/15 min) with a 100/15 min per-IP backstop; API and AI limits per logged-in user. Verified: 11th bad login on one account → 429 while another account on the same IP logs in |
| 3 | Top search bar did nothing when already on the Projects page | UI bug | Projects page now follows the `q` URL parameter |
| 4 | A browser tab closing mid-WebSocket crashed the Vite dev/preview server (`ECONNABORTED` in its proxy) | Dev-experience bug | Proxy error handlers in `vite.config.js`; server survived 6 consecutive suite runs |
| 5 | JWT verification did not pin the algorithm | Hardening | Sign and verify with `HS256` only; test proves `alg: none` and wrong-key tokens are rejected |
| 6 | Login answered faster for unknown e-mails (timing could reveal registered accounts) | Hardening | Unknown e-mails are compared against a dummy bcrypt hash |
| 7 | AI service exposed `/docs` and `/openapi.json` in production | Hardening | Disabled when `AI_ENV=production` (verified 404) |

Verified without changes: no `.env` ever committed and neither real JWT secret appears in history; hostile inputs
(Mongo operators in body and query, 300 KB bodies, malformed JSON, `javascript:` URLs, invalid ids, other users'
resources) are rejected or scoped; AI outage → clear 503 while the rest of the app works; production start-up refuses
weak secrets or a missing AI key; seeded data has 0 broken references and consistent counters; every frontend API
call (87) maps to a backend route and every in-app link (71) to a page.
