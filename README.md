# Workforce SaaS

A multi-tenant workforce management and work-time analytics platform: organizations, departments/teams, attendance, work sessions, activity/idle tracking via a desktop agent, employee requests, projects/tasks, analytics, and organization policies - with role-based access control and strict tenant isolation throughout.

Built as three packages in one repository:

```
client/           React + Vite + Tailwind web app
server/           Node.js + Express + MongoDB API, Socket.IO
desktop-agent/    Electron desktop agent (Windows-compatible)
docs/             Detailed documentation (this folder's siblings)
```

See `docs/DEVELOPMENT_PHASES.md` for what's built at full depth versus lighter scaffolding, and `docs/ARCHITECTURE.md` for how the pieces fit together.

## Quick start

You'll need Node.js 20+ and a running MongoDB instance (local, Docker, or Atlas).

### 1. Server

```bash
cd server
cp .env.example .env
# edit .env: set MONGO_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET at minimum
npm install
npm run dev
```

The API starts on `http://localhost:5000`. Verify it's up:

```bash
curl http://localhost:5000/health
```

### 2. Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. Register a new organization from the landing page - the first account you create becomes that organization's `ORGANIZATION_ADMIN`.

### 3. Desktop agent (optional for a first run)

```bash
cd desktop-agent
npm install
npm start
```

On first launch it opens a setup window asking for the backend URL and a device token. Get a token from the web app: log in, go to **Devices**, click **Register device**, and copy the token shown (it's only shown once).

See `docs/DESKTOP_AGENT.md` for the full idle-detection/sync design and how to build a Windows installer.

## Running tests

```bash
cd server
npm test
```

This spins up an ephemeral MongoDB via `mongodb-memory-server` and runs the suite against the real HTTP API (auth, tenant isolation, RBAC, attendance). See `server/tests/README.md` if the test run fails to download MongoDB's binary in a network-restricted environment.

## Environment variables

See `server/.env.example` for the full list. At minimum for local development:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Long random strings - never reuse between environments |
| `CLIENT_URL` | Used for CORS and Socket.IO origin |

## Documentation index

- `docs/ARCHITECTURE.md` - layering, multi-tenancy, request flow
- `docs/API.md` - endpoint reference
- `docs/DATABASE.md` - models, relationships, indexes
- `docs/SECURITY.md` - auth, tenant isolation, RBAC, device security
- `docs/DEPLOYMENT.md` - deploying client/server/agent to production
- `docs/DESKTOP_AGENT.md` - idle detection, sync, and device security in depth
- `docs/DEVELOPMENT_PHASES.md` - what's built, at what depth, and what's next
