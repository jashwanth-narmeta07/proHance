# Deployment

This describes a reasonable production path for each piece; adapt to whatever hosting you actually use.

## Server (Node/Express + Socket.IO)

- Any Node host that supports long-lived processes and WebSocket upgrades (Socket.IO needs both) - e.g. a container platform (Fly.io, Render, Railway, ECS) or a plain VM behind a reverse proxy. Serverless request/response platforms that don't support persistent connections are a poor fit for the Socket.IO piece specifically.
- Set every variable in `server/.env.example` in the platform's environment/secrets manager - never commit a real `.env`. At minimum: `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `NODE_ENV=production`.
- Put the server behind HTTPS (terminate TLS at the load balancer/reverse proxy, or directly if the platform requires it) - JWTs and device tokens must never travel over plain HTTP in production.
- `app.set('trust proxy', 1)` is already set (needed for correct rate-limiting/IP logging behind a reverse proxy).
- Run `npm install --production` (or your platform's build step) then `npm start`.

## MongoDB

- Use a replica set in production (Atlas provisions one by default). This project's writes don't currently use multi-document transactions - organization+admin creation uses an explicit compensating-delete instead of a transaction specifically so it works on both a standalone Mongo and a replica set - but a replica set is still recommended for durability/failover regardless.
- Point `MONGO_URI` at it; nothing else in the code assumes a specific deployment topology.

## Client (React/Vite)

- `npm run build` produces a static `dist/` - deploy it to any static host/CDN (Vercel, Netlify, S3+CloudFront, etc.).
- Set `VITE_API_URL` and `VITE_SOCKET_URL` at build time to the deployed server's URL.
- Because Socket.IO needs to reach the same backend, make sure the static host's origin is included in the server's `CLIENT_URL` (CORS) config.

## Socket.IO at scale

A single server instance handles Socket.IO out of the box. If you run more than one server instance behind a load balancer, add the `socket.io` Redis adapter (or similar) so room broadcasts (`org:<id>`, `team:<id>`, `user:<id>`) reach clients connected to a different instance - this isn't wired up yet since the MVP assumes a single instance.

## Electron desktop agent

- `cd desktop-agent && npm run build:win` produces an NSIS installer via `electron-builder` (see `docs/DESKTOP_AGENT.md`).
- The agent's only required configuration at install time is the backend URL (set once in the setup screen, or pre-seed a default in `localStore.js` if every install points at the same backend) - it does not need any secret baked into the binary.
- Distribute the installer however your organization normally distributes internal software (shared drive, MDM, etc.) - there's no auto-update mechanism built yet.

## Environment separation

Keep entirely separate `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` values and MongoDB databases between development, staging, and production - never reuse a secret across environments, and never point a dev build at a production database.

## Health checks

`GET /health` (unauthenticated, unversioned) returns `{ status: 'ok', uptime, timestamp }` - use this for your platform's health-check/readiness probe.
