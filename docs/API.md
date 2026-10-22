# REST API reference

Base URL: `http://localhost:5000/api` (production: `https://<your-api-host>/api`).

**Auth:** every endpoint except `/health` and `/auth/register|signup|login` needs
`Authorization: Bearer <token>`. Tokens are revoked on logout.

**Responses:** success → `{ "success": true, "message"?, "data": … }`;
error → `{ "success": false, "message": "...", "errors"?: [{ "field", "message" }] }`.

**Status codes:** 400 validation · 401 not logged in / token revoked · 403 not allowed (e.g. not the owner) ·
404 not found · 409 duplicate · 413 body too large · 429 rate limited · 503 AI service unavailable.

**Pagination:** list endpoints accept `page` and `limit` (max 100) and return
`{ items, pagination: { page, limit, total, pages } }`.

**Rate limits:** login/register 10 attempts / 15 min per account (plus 100 / 15 min per IP); AI endpoints 30 / min and everything else 300 / min **per logged-in user** (anonymous requests per IP). Keyed by account so students behind one campus IP are not locked out together.

---

## Health
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | `200 {status:"ok", database:"connected"}` or `503` if MongoDB is down |

## Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` (alias `/auth/signup`) | `firstName, lastName, email, password (≥8, letter+digit), role?` | → `201 {user, token}`; 409 if email exists |
| POST | `/auth/login` | `email, password` | → `{user, token}`; same 401 message for unknown email and wrong password |
| POST | `/auth/logout` | – | Invalidates all of the user's tokens |
| GET | `/auth/me` | – | Current user |

## Users & profile
| Method | Path | Notes |
|---|---|---|
| GET | `/users?q&skill&role&lookingForTeam&page&limit` | People search |
| GET | `/users/:id` | Public profile + `projects`, `reviews`, `offers`, `online` |
| GET | `/users/:id/reviews` | Paginated reviews |
| PATCH | `/users/me` | `firstName, lastName, role, headline, bio, location, university, graduationYear, profileImage, links{github,linkedin,portfolio}, interests[], lookingForTeam, availability` (http(s) URLs only) |
| PUT | `/users/me/skills` | `{skills:[{name, level: beginner|intermediate|advanced|expert, yearsOfExperience}]}` — replaces the list, duplicates removed |

## Catalog
| GET | `/catalog/skills?q&limit` | Skill autocomplete |
|---|---|---|
| GET | `/catalog/roles` | Target roles with weighted skills |

## Projects
| Method | Path | Notes |
|---|---|---|
| GET | `/projects?q&skill&category&status&lookingForMembers&sort=newest|popular` | Includes `isBookmarked` |
| POST | `/projects` | `title, description (≥20), summary?, category?, techStack[], rolesNeeded[], status?, difficulty?, repoUrl?, demoUrl?, maxTeamSize?, lookingForMembers?` |
| GET | `/projects/mine` · `/projects/bookmarks` | |
| GET | `/projects/:id` | Includes `isOwner, isMember, isBookmarked, myJoinRequest` |
| PATCH / DELETE | `/projects/:id` | Owner only (403 otherwise). Delete also removes bookmarks & join requests |
| POST / DELETE | `/projects/:id/bookmark` | Idempotent |
| POST | `/projects/:id/join-requests` | `{message?}` — notifies the owner; 409 if already pending |
| GET | `/projects/:id/join-requests` | Owner only |
| PATCH | `/projects/:id/join-requests/:requestId` | Owner only, `{status: accepted|declined}` — notifies requester |
| DELETE | `/projects/:id/members/:userId` | Owner removes a member, or a member removes themself (leave) |

## Learning
| GET | `/courses?q&skill&level` | Includes the user's `enrollment` |
|---|---|---|
| GET | `/courses/enrollments/me` | Learning history |
| GET | `/courses/:id` | |
| POST | `/courses/:id/enroll` | 201 first time, 200 if already enrolled |
| PATCH | `/courses/:id/progress` | `{moduleIndex, completed}` → recalculates progress; completion sends a notification |

## Mentoring
| Method | Path | Notes |
|---|---|---|
| GET | `/mentoring/offers?q&skill&mentor` · `/mentoring/offers/mine` | |
| POST | `/mentoring/offers` | `title, skill, description?, level?, sessionMinutes (30/45/60/90), mode?` |
| PATCH / DELETE | `/mentoring/offers/:id` | Own offers only; delete archives |
| POST | `/mentoring/offers/:id/sessions` | `{scheduledAt (future), message?}` — cannot book your own offer |
| GET | `/mentoring/sessions?as=mentor|learner|all&status` | |
| PATCH | `/mentoring/sessions/:id` | `{status, meetingLink?}` — requested→accepted/declined (mentor), accepted→completed, requested/accepted→cancelled (either) |
| POST | `/mentoring/sessions/:id/review` | Learner only, completed sessions, once: `{rating 1-5, comment?}` — recomputes the mentor's rating |

## Chat
| GET | `/chat/conversations` | With `other` participant, `unread`, online status |
|---|---|---|
| POST | `/chat/conversations` | `{userId}` — get or create the 1:1 conversation |
| GET | `/chat/conversations/:id/messages?before&limit` | Participants only |
| POST | `/chat/conversations/:id/messages` | `{body ≤2000}` (REST fallback for the socket) |
| POST | `/chat/conversations/:id/read` | |
| GET | `/chat/unread-count` | |

### Socket.IO (same origin as the API)
Connect with `io(API_URL, { auth: { token } })`. Invalid tokens are rejected at the handshake.

| Direction | Event | Payload |
|---|---|---|
| client → server | `message:send` | `{conversationId, body}` + ack `→ {ok, message}` or `{ok:false, error}` |
| client → server | `typing` | `{conversationId}` |
| server → client | `message:new` | message document |
| server → client | `typing` | `{conversationId, userId}` |
| server → client | `notification:new` | notification document |
| server → client | `presence:update` | `{userId, online}` |

## Notifications
`GET /notifications?unread=true` · `GET /notifications/unread-count` · `PATCH /notifications/:id/read` ·
`PATCH /notifications/read-all` · `DELETE /notifications/:id`

## Jobs & applications
| GET | `/jobs?q&skill&remote&employmentType&experienceLevel` | Includes the user's `application` |
|---|---|---|
| GET | `/jobs/:id` | |
| GET | `/jobs/:id/match` | Match vs latest resume (or profile skills) → `{match, basedOn}`; stores `matchScore` on a tracked application |
| GET | `/applications?status` | |
| POST | `/applications` | `{jobId, status?, notes?}` — 409 if already tracked |
| PATCH | `/applications/:id` | `{status?, notes?}` — status changes are appended to `statusHistory` |
| DELETE | `/applications/:id` | |

## Resumes
| POST | `/resumes` | `multipart/form-data`, field **`resume`**: PDF/DOCX/TXT ≤ `MAX_UPLOAD_MB`. Extension, MIME type and file signature are checked. Only extracted text + analysis are stored (max 10 resumes per user) |
|---|---|---|
| GET | `/resumes` · `/resumes/:id` | |
| DELETE | `/resumes/:id` | |
| POST | `/resumes/:id/match` | `{jobId}` or `{jobDescription (≥30 chars)}` |

## AI career features
| Method | Path | Notes |
|---|---|---|
| GET | `/ai/status` | Whether the AI service is reachable |
| GET | `/ai/recommendations/skills?targetRole` | Defaults to the active goal |
| GET | `/ai/recommendations/projects` | Ranked projects with reasons |
| GET | `/ai/recommendations/teammates?projectId` | Project members only |
| POST | `/ai/skill-gap` | `{targetRole}` |
| POST | `/ai/roadmap` | `{targetRole, hoursPerWeek}` |
| POST | `/ai/assistant` · GET/DELETE `/ai/assistant/history` | `{message}` → stored reply with `provider` and `sources` |
| POST | `/ai/interview` · GET `/ai/interview` · GET `/ai/interview/:id` | `{role, count 3-10}` |
| POST | `/ai/interview/:id/answers` | `{qid, answer}` → evaluation; session completes when all are answered |

## Goals & dashboard
`GET/POST /goals` · `PATCH/DELETE /goals/:id` (creating or activating a goal pauses the previous active one) ·
`GET /dashboard` (stats, application funnel, 8-week activity, skill levels, interview trend, courses, sessions,
profile completeness).

---

## AI service (internal) — `http://localhost:8000`
Interactive docs at `/docs`. All routes except `/health` require header `X-Internal-Key` when `AI_SERVICE_KEY` is set.
`POST /resume/parse` (multipart `file`), `/match`, `/skill-gap`, `/roadmap`, `/recommend/skills`,
`/recommend/projects`, `/recommend/teammates`, `/assistant`, `/interview/questions`, `/interview/evaluate`,
`GET /roles`. See [AI.md](AI.md) for inputs, outputs and algorithms.
