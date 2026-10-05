# Architecture

## Layering (server)

```
routes  ->  controllers  ->  services  ->  repositories  ->  models
```

- **routes**: wire URL + HTTP method to a controller, and declare which middleware guards it (`authenticate`, `requireOrganizationContext`, `requirePermission`, `validate`). No business logic.
- **controllers**: parse `req`, call exactly one service function, format the response via `sendSuccess`. No business logic.
- **services**: all business logic and authorization *decisions* (as opposed to authorization *gates*, which live in middleware) live here. Services are what tests call directly when they need to bypass HTTP for setup.
- **repositories**: the only layer that talks to Mongoose models directly. `BaseRepository` provides tenant-scoped helpers (`findByIdInOrg`, `createInOrg`, etc.) so "forgetting to filter by organizationId" is structurally hard rather than a habit to remember.
- **models**: Mongoose schemas, validation, indexes.

Nothing skips a layer. A controller never touches a model directly; a service never touches `req`/`res`.

## Multi-tenancy

Every organization-owned document carries `organizationId`. The rule that makes tenant isolation actually hold:

**`organizationId` is never read from the request body, query string, or URL params.** It comes from exactly one place: `req.user.organizationId`, which the `authenticate` middleware derives from the verified JWT and nothing else. Every repository method that reads/writes org-scoped data requires an explicit `organizationId` argument, and `BaseRepository`'s scoped methods (`findInOrg`, `updateByIdInOrg`, ...) fold it into the Mongo filter automatically.

The desktop agent's device-token auth follows the identical pattern: `req.device.organizationId` resolves server-side from the device token, never from anything the agent sends in its payload.

See `docs/SECURITY.md` and `server/tests/tenantIsolation.test.js` for how this is verified.

## Authentication

- **Human users**: JWT access token (short-lived, ~15 min) + refresh token (long-lived, ~7 days). `refreshTokenVersion` on the `User` document is incremented on logout or password change, instantly invalidating every outstanding refresh token for that user across all devices/tabs.
- **Desktop agent**: a per-device token, generated once at registration, stored hashed (`sha256`) on the `Device` document. The agent authenticates with `X-Device-Token`, never the user's JWT - so a compromised agent binary can only ever act as "this one device," independently revocable without touching the user's login session.

## Authorization

Role names alone never gate a route. Every protected route requires a **permission** (`requirePermission('EMPLOYEE_READ')`, etc.), and the role → permission mapping lives in one place: `server/src/config/permissions.js`. This means:

- Adding a new role, or changing what a role can do, is a one-file change.
- A route's required permission and a role's granted permissions can be diffed independently - you can answer "what can a MANAGER do" without reading every route file.

Permission checks answer "can this role do this *kind* of thing at all." Some actions also need an **ownership** check on top - e.g. a MANAGER holds `TEAM_MANAGE`, but editing a *specific* team additionally requires being that team's `managerId`. These ownership checks live in the service layer (see `team.service.js`'s `assertCanManageTeam`), not in route middleware, because they require loading the specific resource first.

## Real-time (Socket.IO)

One authenticated Socket.IO connection per client, joined into rooms derived from the verified JWT (never client-supplied):

- `user:<id>` - direct notifications
- `org:<organizationId>` - org-wide broadcasts (device online/offline, unclassified-idle alerts)
- `team:<teamId>` - team-scoped updates

The desktop agent does not use Socket.IO - it communicates over plain REST (`/api/v1/agent/*`), since its connection needs to survive being offline for extended periods and retry with idempotent batches, which fits a request/response + local queue model better than a persistent socket.

## Activity/attendance data model

Three distinct layers, deliberately not collapsed into one:

1. **`Attendance`** - one record per user per day: check-in/out, status (PRESENT/LATE/ABSENT), flags (LATE_ARRIVAL, OVERTIME).
2. **`WorkSession`** - one record per check-in→check-out span: `activeDurationSeconds`, `idleDurationSeconds`, `breakDurationSeconds`, `meetingDurationSeconds`, `unclassifiedIdleSeconds`.
3. **`ActivityEvent`** - the granular, append-only ledger everything else is computed from (`SESSION_STARTED`, `ACTIVITY_DETECTED`, `IDLE_STARTED`, `IDLE_JUSTIFIED`, `BREAK_STARTED/ENDED`, ...).

`WorkSession` durations are **always** computed by aggregating that session's `ActivityEvent`s at checkout time - never by subtracting checkout time from checkin time. This is what guarantees "PC-on time is never work time" (spec Section 37.11) holds structurally rather than by convention: with no desktop agent connected, `activeDurationSeconds` is correctly `0`, not an approximation. See `attendance.service.js`'s `aggregateSessionDurations` and the accompanying test in `attendance.test.js`.

## Desktop agent sync

The agent never assumes it has connectivity. Every event gets a client-generated `clientEventId` before touching the network; a unique index on `(organizationId, userId, clientEventId)` on the server makes retrying a batch after a dropped connection a no-op rather than a duplicate. See `docs/DESKTOP_AGENT.md`.
