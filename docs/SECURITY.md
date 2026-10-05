# Security

## Authentication

- Passwords hashed with bcrypt (`User.hashPassword`/`comparePassword`), never stored or logged in plaintext.
- JWT access tokens (short-lived, ~15 min) + refresh tokens (long-lived, ~7 days). `User.refreshTokenVersion` is incremented on logout, invalidating every outstanding refresh token for that user immediately - across every device/tab, not just the one that logged out.
- The desktop agent never uses a user's JWT. It authenticates with a per-device token (`X-Device-Token`), generated once at registration and stored server-side only as a `sha256` hash - the raw token is shown to the user exactly once and is not recoverable from the database. See `docs/DESKTOP_AGENT.md`.

## Tenant isolation

`organizationId` is never read from the request body, query string, or URL params - it comes from exactly one place: `req.user.organizationId` (or `req.device.organizationId` for the agent), both derived server-side from a verified token. See `docs/ARCHITECTURE.md` and `server/tests/tenantIsolation.test.js` for the enforced guarantee and its test coverage.

A cross-tenant read of a real, valid document ID returns `404`, not `403` - a `403` confirms the resource exists (an information leak), a `404` doesn't.

## Authorization (RBAC)

- Every protected route requires a permission (`requirePermission('EMPLOYEE_READ')`), never a raw role check. The role -> permission map is centralized in `server/src/config/permissions.js`.
- Some actions require an additional ownership check beyond the permission - e.g. a MANAGER's `TEAM_MANAGE` permission only lets them edit a team where they are the recorded `managerId`, checked in the service layer against the loaded resource, not assumed from the permission alone.
- Role-escalation is explicitly blocked: HR can change a member's role but cannot promote anyone to `HR` or `ORGANIZATION_ADMIN` (`ROLE_ESCALATION_BLOCKED`).

## Input validation

Every route with a body/query/params uses a Zod schema via the `validate()` middleware before the controller ever sees the request. Unknown fields are stripped by default - this is also how the activity-collection policy structurally prevents `collectScreenshots` from ever being settable through the API, regardless of what a client sends (Section 12/38 of the spec).

## Transport & headers

- `helmet()` for standard security headers.
- CORS restricted to `CLIENT_URL`.
- `express-mongo-sanitize` strips `$`/`.` operators from user input to prevent NoSQL injection via crafted query objects.
- Rate limiting: a global limiter on all routes, a stricter one on credential-guessing surfaces (`/auth/login`, `/auth/register-organization`, `/members/accept-invitation`), and a separate, more generous limiter on `/agent/*` since the desktop agent legitimately calls it far more frequently than a human.

## Secrets

- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MONGO_URI`, and email provider credentials live only in `server/.env` (gitignored), never in client or desktop-agent code.
- The desktop agent contains no organization secrets or admin credentials - only its own device token, scoped to one device, independently revocable.

## Error handling

Production error responses never include a stack trace - `server/src/middleware/errorHandler.js` returns `{ success: false, message, code }` and logs the full error server-side via Winston. Unexpected (non-`ApiError`) exceptions are logged with full detail internally but surfaced to the client as a generic message.

## Audit trail

Sensitive actions - role/manager/team/department changes, offboarding, device revocation, policy updates - are recorded via `auditLog.service.js`'s `recordAudit()`, which never accepts or stores passwords, tokens, or other secrets, and never throws into the caller's request flow (an audit-write failure is logged loudly but never blocks the underlying action).

## What's intentionally not collected (Section 12/38)

By design, the desktop agent does not collect: passwords, keystroke content, webcam/microphone data, screen content, or private message contents. It collects: system-wide idle/active state (via Electron's `powerMonitor`, not per-application focus), idle justification reasons the employee explicitly provides, and device/heartbeat metadata. `activityCollectionPolicy.collectScreenshots` is not exposed anywhere in the policy-update API - there is no supported path to enabling it in this codebase.
