# SkillBridge AI — client

React 19 + Vite single-page app. See the [root README](../README.md) for full setup.

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api and /socket.io to http://localhost:5000)
npm run lint
npm run build
npm run e2e      # browser journeys; needs the full stack running (E2E_BASE_URL to override)
```

Set `VITE_API_URL` (see `.env.example`) when the API is on a different origin in production.
