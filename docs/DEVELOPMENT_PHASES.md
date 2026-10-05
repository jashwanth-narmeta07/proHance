# Development Phases

This tracks what's built, verified, and at what depth - so nothing is assumed to be more finished than it is.

## Full depth, verified end-to-end (backend + frontend, tested where the sandbox environment allowed)

| Phase | What | Notes |
|---|---|---|
| 1-2 | Foundation + Auth | Org registration (atomic), login, refresh, logout, RBAC middleware. |
| 3 | Organization | Settings, overview stats. |
| 4 | Member Invitations | Invite/accept/list/revoke, role-scoped visibility, history-preserving offboarding. |
| 5 | Departments/Teams | CRUD with manager-ownership enforcement (not just role-permission). |
| 6 | Attendance/WorkSessions | Check-in/out, breaks, late/overtime flags from policy, durations from `ActivityEvent` aggregation (never wall-clock). |
| 7-9 | Desktop Agent | Idle detection (`powerMonitor`), justification popup, offline queue with idempotent sync, device-token auth. Verified by actually launching the Electron binary headlessly. |
| 10 | Requests/Notifications/Socket.IO | Server-resolved manager/HR, real-time delivery, notification center. |
| 11 | Projects/Tasks | Visibility rules, assignee-limited status updates. |
| 12 | Analytics/Reports | Neutral terminology throughout, CSV export. |
| 13 | Policies/Audit/Devices | Grouped policy settings, audit trail on sensitive actions, device registration/revocation. |
| 34 | Testing | Jest+Supertest: auth, tenant isolation, RBAC, attendance lifecycle. See "Testing" below. |

## Scaffolded but lighter than full production depth

- **Frontend polish**: no code-splitting yet (client bundle is a single ~700KB chunk after adding recharts - fine for an MVP, worth splitting before a real production launch).
- **Email**: abstracted behind `email.service.js` with a `console` provider by default. SMTP/Resend/SendGrid implementations are stubbed as comments, not built - swap in a real provider by implementing one `send()` case.
- **Projects/Tasks**: functional CRUD + Kanban board; no time-tracking-per-task integration with WorkSessions yet (spec Section 18 flags this as a "later" connection).
- **Reports**: CSV export only; PDF export was explicitly deferred by the spec (Section 21).
- **Desktop agent**: no auto-launch-on-login, no crash-recovery watchdog beyond Electron defaults, no auto-update mechanism. See `docs/DESKTOP_AGENT.md`'s "Known limitations".

## Not built (explicitly deferred per spec Section 38)

Mobile app, advanced forecasting, custom dashboards/roles, advanced approval workflows, payroll/calendar/SSO/OAuth/Slack-Teams integrations, billing/subscriptions, multi-location/multi-shift/multi-currency, localization, advanced compliance features.

## Testing

The server test suite (`server/tests/`) is real - it calls the actual HTTP API via supertest, not mocked shortcuts - and covers the scenarios the spec calls out as must-test: tenant isolation, manager-to-manager isolation, and employee-to-employee activity privacy, alongside auth and the attendance lifecycle.

It could not be executed to completion inside the sandbox this project was built in: `mongodb-memory-server` needs to download a `mongod` binary from `fastdl.mongodb.org` on first run, and that sandbox's network allowlist doesn't include it. Everything up to that download (Jest startup, Express app boot, route resolution) ran correctly. See `server/tests/README.md` for the exact error and how to run the suite with normal internet access.

No frontend (React Testing Library) or Electron-specific automated tests were written yet - the Electron app was instead verified by launching the real binary headlessly (via `xvfb-run`) and confirming a clean start with no JavaScript errors, which caught real issues (see below) that static analysis alone would have missed.

## Bugs found and fixed during this build

Worth recording since they were real, not hypothetical:

1. **Manager team-ownership bypass**: a MANAGER's `TEAM_MANAGE` permission let them edit/delete any team, not just their own - permission alone doesn't prove ownership of a specific resource. Fixed in `team.service.js`, now regression-tested in `rbac.test.js`.
2. **HR missing org-structure permissions**: HR had no way to manage departments/teams at all, despite the spec describing HR as holding organization-level employee-management permissions. Added `DEPARTMENT_MANAGE`/`TEAM_MANAGE` to HR's permission set.
3. **Unthrottled activity heartbeats**: the desktop agent's idle monitor polls every 5 seconds and would have recorded an `ACTIVITY_DETECTED` event on every tick while active - roughly 720 events/hour/user, flooding the sync queue and database. Throttled to one recorded heartbeat per minute, with the backend's duration aggregation updated to match.
4. **Duplicate Mongoose index**: `Organization.slug` was indexed twice (once via the schema field's `unique: true`, once via an explicit `.index()` call), triggering a startup warning.

## Reading order for a new contributor

1. `README.md` - setup and quick start.
2. `docs/ARCHITECTURE.md` - layering, multi-tenancy, the core design decisions.
3. `docs/API.md` - what every endpoint does.
4. `docs/DATABASE.md`, `docs/SECURITY.md` - as needed for the area you're touching.
5. `docs/DESKTOP_AGENT.md` - only if working on the Electron piece.
