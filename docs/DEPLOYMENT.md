# Deployment guide

> Status: configuration is provided and documented, but SkillBridge AI has **not** been deployed to a live host as
> part of this work. Follow these steps with your own accounts.

Recommended free/low-cost setup:
- **MongoDB Atlas** — database
- **Render** — Node API (web service) and AI service (web service), using `render.yaml`
- **Render static site, Vercel or Netlify** — React frontend

## 1. MongoDB Atlas
1. Create a free M0 cluster at https://cloud.mongodb.com.
2. *Database Access* → add a user with a strong password (read/write to any database is fine for a single app).
3. *Network Access* → allow the hosting provider's outbound IPs (or `0.0.0.0/0` for a demo, understanding the risk).
4. *Connect → Drivers* → copy the URI and add the database name:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/skillbridge?retryWrites=true&w=majority`
5. Seed it once from your machine:
   ```bash
   cd server
   MONGO_URI="<atlas uri>" npm run seed        # PowerShell: $env:MONGO_URI="<atlas uri>"; npm run seed
   ```

## 2. Secrets
Generate two random values:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # AI_SERVICE_KEY (same value on both services)
```

## 3. Render (blueprint)
1. Push the repository to GitHub.
2. Render → *New → Blueprint* → select the repo. `render.yaml` creates three services.
3. Fill the `sync: false` variables:
   | Service | Variable | Value |
   |---|---|---|
   | skillbridge-ai-service | `AI_SERVICE_KEY` | the generated key |
   | skillbridge-ai-service | `LLM_PROVIDER` / `ANTHROPIC_API_KEY` | optional (`none` works) |
   | skillbridge-api | `MONGO_URI` | Atlas URI |
   | skillbridge-api | `AI_SERVICE_KEY` | same key |
   | skillbridge-api | `AI_SERVICE_URL` | `https://skillbridge-ai-service.onrender.com` |
   | skillbridge-api | `CLIENT_URL` | `https://skillbridge-client.onrender.com` (your frontend origin) |
   | skillbridge-client | `VITE_API_URL` | `https://skillbridge-api.onrender.com` |
4. Deploy. Check `https://<api>/api/health` → `{"status":"ok","database":"connected"}` and `https://<ai>/health`.

Notes:
- The server refuses to start in production without a ≥32-char `JWT_SECRET` and an `AI_SERVICE_KEY`; the AI service
  refuses to start without `AI_SERVICE_KEY`.
- The AI service reads `../datasets` relative to `ai-service/` (the whole repository is checked out on Render).
- Free Render instances sleep when idle; the first request can take ~30-60 s.
- Socket.IO works over Render's WebSocket support; `CLIENT_URL` must contain the exact frontend origin.

## 4. Frontend on Vercel or Netlify (alternative)
- Root directory `client`, build `npm run build`, output `dist`.
- Set `VITE_API_URL` to the API's public URL (it is baked in at build time — rebuild after changing it).
- SPA routing is handled by `client/vercel.json` (Vercel) and `client/public/_redirects` (Netlify).

## 5. Production checklist
- [ ] `NODE_ENV=production`, strong `JWT_SECRET`, `AI_SERVICE_KEY` set on both services
- [ ] `CLIENT_URL` matches the deployed frontend origin exactly
- [ ] Atlas network access restricted as tightly as your host allows
- [ ] Seeded data reviewed (it is synthetic; the demo password is public — change `SEED_DEMO_PASSWORD` or remove the demo user for a public deployment)
- [ ] Health endpoints return 200
- [ ] Run `npm run e2e` with `E2E_BASE_URL=<frontend url>` against the deployed site
