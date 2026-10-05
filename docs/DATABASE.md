# Database

MongoDB via Mongoose. Every organization-owned collection carries an `organizationId` field, indexed, and every query that reads/writes it goes through a repository method that folds `organizationId` into the filter automatically (see `server/src/repositories/baseRepository.js` and `docs/ARCHITECTURE.md`).

## Models

| Model | Purpose | Key relationships |
|---|---|---|
| `Organization` | One per tenant. `slug` is the human-facing identifier used at login (not the `_id`). | - |
| `User` | Every human account - `SUPER_ADMIN` (platform-level, no `organizationId`) or an org-scoped role. | `organizationId`, `departmentId`, `teamId`, `managerId` |
| `Department` | Top of the org structure. | `organizationId` |
| `Team` | Sits under a department, has one `managerId`. | `organizationId`, `departmentId`, `managerId` -> `User` |
| `Invitation` | Pending member invites. Token is stored hashed; the raw token is only ever in the invitation email. | `organizationId`, `invitedBy` -> `User` |
| `Device` | A registered desktop-agent installation. Token stored hashed (`deviceTokenHash`). | `organizationId`, `userId` |
| `Attendance` | One record per user per day - check-in/out, status, flags. | `organizationId`, `userId`, `workSessionId` |
| `WorkSession` | One record per check-in -> check-out span. Durations always computed from `ActivityEvent`, never wall-clock. | `organizationId`, `userId`, `deviceId` |
| `ActivityEvent` | Append-only, granular event ledger everything else is computed from. | `organizationId`, `userId`, `deviceId`, `workSessionId` |
| `Request` | Employee requests (leave, WFH, corrections, ...). Manager/HR to notify are resolved server-side. | `organizationId`, `requesterId`, `managerId`, `hrId` |
| `Notification` | In-app notifications, also pushed live via Socket.IO. | `organizationId`, `recipientId` -> `User` |
| `Project` / `Task` | Standard project/task tracking. | `organizationId`, `projectManagerId`/`assigneeId` -> `User` |
| `OrganizationPolicy` | One per org (get-or-create on first read). Grouped settings: idle/attendance/break/overtime/activity-collection/device/notification. | `organizationId` |
| `AuditLog` | Append-only record of sensitive actions. Never stores secrets. | `organizationId`, `actorId` -> `User`, `targetId` (polymorphic, paired with `targetEntity`) |

## Notable indexes

- `Organization.slug` - unique (login lookup path).
- `User`: compound `(organizationId, email)` unique - email is unique *per organization*, not globally, so tenant data never collides on a global constraint.
- `Team`: compound `(organizationId, departmentId, name)` unique.
- `Device.deviceTokenHash` - unique, used for the device-auth lookup.
- `ActivityEvent`: compound `(organizationId, userId, clientEventId)` unique - this is what makes the desktop agent's sync idempotent; retrying a batch after a dropped connection is a no-op, not a duplicate.
- `Attendance`: compound `(organizationId, userId, date)` unique - one attendance record per user per day.
- `WorkSession`, `Request`, `Notification`, `AuditLog`: indexed on `(organizationId, userId/recipientId/actorId, createdAt)` or similar, matching the recent-first, scoped-list query patterns their endpoints actually use.

## Why three separate collections for attendance/activity

`Attendance`, `WorkSession`, and `ActivityEvent` are deliberately not collapsed into one document. See `docs/ARCHITECTURE.md`'s "Activity/attendance data model" section for the full reasoning - in short: `ActivityEvent` is the source of truth, `WorkSession` is a computed rollup of one session's events, and `Attendance` is the daily-level record HR/managers look at. Keeping them separate means recomputing a `WorkSession`'s durations (e.g. after a policy change) never requires touching the underlying event history.

## Offboarding and history

`User.status` moves to `EXITED` on offboarding - the document is never deleted. Every `Attendance`, `WorkSession`, `ActivityEvent`, `Request`, etc. that referenced that user's `_id` keeps working, so historical reports for a departed employee remain intact (Section 7/16 of the spec).
