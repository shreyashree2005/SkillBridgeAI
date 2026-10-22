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
