# API Reference

Base URL: `/api/v1`. All responses use the envelope:

```json
{ "success": true, "data": { ... }, "message": "..." }
{ "success": false, "message": "...", "code": "...", "details": [ ... ] }
```

`code` is a stable machine-readable string (e.g. `SLUG_TAKEN`, `NOT_TEAM_MANAGER`) safe to branch on in client code - see the individual service files for the full set. `details` appears only on validation errors, one entry per failing field.

**Auth header:** `Authorization: Bearer <accessToken>` for all human-user routes. The desktop agent uses `X-Device-Token: <deviceToken>` instead (see Agent section) and never a user JWT.

Every route below (except where noted **Public**) requires authentication. Most also require an organization context and a specific permission - see `server/src/config/permissions.js` for the full role → permission map, and the corresponding `*.routes.js` file for exactly which permission each route requires.

---

## Auth (`/auth`)

| Method | Path | Notes |
|---|---|---|
| POST | `/register-organization` | **Public.** Creates an Organization + its ORGANIZATION_ADMIN atomically. |
| POST | `/login` | **Public.** Body: `{ organizationSlug, email, password }`. |
| POST | `/refresh` | **Public.** Body: `{ refreshToken }`. |
| POST | `/logout` | Bumps `refreshTokenVersion`, invalidating all outstanding refresh tokens. |
| GET | `/me` | Current user profile. |

## Organizations (`/organizations`)

| Method | Path | Permission |
|---|---|---|
| GET | `/me` | any authenticated org member |
| GET | `/overview` | `ORGANIZATION_MANAGE` |
| PATCH | `/me` | `ORGANIZATION_MANAGE` |

## Members & Invitations (`/members`)

| Method | Path | Permission |
|---|---|---|
| POST | `/accept-invitation` | **Public** - identity comes from the invitation token, not a session. |
| POST | `/invitations` | `MEMBER_INVITE` |
| GET | `/invitations` | `MEMBER_INVITE` |
| DELETE | `/invitations/:id` | `MEMBER_INVITE` |
| GET | `/` | `EMPLOYEE_READ` |
| GET | `/:id` | `EMPLOYEE_READ` |
| PATCH | `/:id` | `EMPLOYEE_UPDATE` (role/manager/team/department/status changes are further restricted to HR/Admin in the service layer, with role-escalation blocked for HR) |
| POST | `/:id/offboard` | `MEMBER_MANAGE` - sets status to EXITED, preserves all history |

## Departments (`/departments`) & Teams (`/teams`)

Standard CRUD, permissions `DEPARTMENT_READ`/`DEPARTMENT_MANAGE` and `TEAM_READ`/`TEAM_MANAGE`. A MANAGER holding `TEAM_MANAGE` can only edit/delete a team they are the `managerId` of - checked in the service layer, not just by permission. `GET /teams/:id/members` lists a team's roster.

## Attendance (`/attendance`)

| Method | Path | Notes |
|---|---|---|
| POST | `/check-in` | Self-service. Body: `{ deviceId? }`. Creates an `Attendance` + `WorkSession` pair. |
| POST | `/check-out` | Closes both, aggregates `WorkSession` durations from `ActivityEvent`s. |
| POST | `/break/start` / `/break/end` | Explicit breaks - never require idle justification. |
| GET | `/today` | Current user's attendance state for today. |
| GET | `/me` | Own attendance history. Query: `from`, `to`. |
| GET | `/team` | Requires `ATTENDANCE_READ`. Manager sees direct reports; HR/Admin see the org. |

## Requests (`/requests`) & Notifications (`/notifications`)

| Method | Path | Notes |
|---|---|---|
| POST | `/requests` | Requires `REQUEST_CREATE`. Manager + HR to notify are resolved server-side - never client-supplied. |
| GET | `/requests/me` | Own requests. |
| GET | `/requests/for-review` | Requires `REQUEST_APPROVE`; scoped to what this reviewer is allowed to see. |
| GET | `/requests/:id` | |
| POST | `/requests/:id/approve` / `/reject` | Requires `REQUEST_APPROVE`. |
| GET | `/notifications` | Own notifications. |
| GET | `/notifications/unread-count` | |
| PATCH | `/notifications/:id/read` | |
| POST | `/notifications/mark-all-read` | |

Real-time delivery also happens over Socket.IO (`notification:new` event) - see `server/src/sockets/index.js`.

## Projects (`/projects`) & Tasks (`/tasks`)

| Method | Path | Permission |
|---|---|---|
| GET/POST `/projects` | `PROJECT_READ` / `PROJECT_MANAGE` |
| GET/PATCH/DELETE `/projects/:id` | visibility: member, project manager, or org-level role |
| GET `/projects/:projectId/tasks` | `TASK_READ` |
| POST `/projects/:projectId/tasks` | `TASK_MANAGE` |
| GET `/tasks/me` | own assigned tasks |
| PATCH `/tasks/:id` | an assignee without `TASK_MANAGE` may only change `status`, nothing else |
| DELETE `/tasks/:id` | `TASK_MANAGE` |

## Analytics (`/analytics`) & Reports (`/reports`)

| Method | Path | Notes |
|---|---|---|
| GET | `/analytics/me` | Own summary: Computer Active Time, Meeting Time, Break Time, Unclassified Idle Time (see `docs/ARCHITECTURE.md` on neutral terminology). |
| GET | `/analytics/team` | Manager's direct reports, or HR/Admin filtered by `teamId`. |
| GET | `/analytics/organization` | Requires org-level role. Optional `departmentId` filter. |
| GET | `/reports/attendance.csv` | Requires `REPORT_EXPORT`. Scoped the same way as `/attendance/team`. |

## Policies (`/policies`)

| Method | Path | Permission |
|---|---|---|
| GET | `/` | `POLICY_READ` |
| PATCH | `/` | `POLICY_MANAGE` (Admin only by default). Body is grouped (`idlePolicy`, `attendancePolicy`, `breakPolicy`, `overtimePolicy`, `activityCollectionPolicy`, `devicePolicy`, `notificationPolicy`); unknown fields are stripped, so e.g. screenshot collection cannot be enabled through this endpoint regardless of what's sent. |

## Devices (`/devices`)

| Method | Path | Notes |
|---|---|---|
| POST | `/` | Self-service registration. Returns `{ device, deviceToken }` - the raw token is shown exactly once. |
| GET | `/me` | Own devices. |
| GET | `/` | Requires `DEVICE_MANAGE` - org-wide device list. |
| DELETE | `/:id` | Requires `DEVICE_MANAGE`. |
| DELETE | `/:id/self-revoke` | Any device owner can revoke their own device without `DEVICE_MANAGE`. |

## Audit Logs (`/audit-logs`)

| Method | Path | Permission |
|---|---|---|
| GET | `/` | `AUDIT_LOG_READ` (Admin only by default). Query: `targetEntity`, `actorId`, `before`, `limit`. |

## Agent (`/agent`) - device-token auth only

Not reachable with a user JWT. Requires `X-Device-Token: <token>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/config` | Returns the org's current `idlePolicy` and `activityCollectionPolicy` - the agent never hardcodes thresholds. |
| POST | `/heartbeat` | Marks the device online, updates `lastHeartbeatAt`. |
| POST | `/sync` | Body: `{ events: [...] }` (max 200/batch). Idempotent on `clientEventId` - safe to retry. |
