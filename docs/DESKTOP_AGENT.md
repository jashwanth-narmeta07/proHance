# Desktop Agent

Electron app, Windows-compatible, source in `desktop-agent/`.

## Responsibilities

- Detect system-wide idle/active state via Electron's `powerMonitor.getSystemIdleTime()` - a native OS call reflecting keyboard/mouse input anywhere on the machine, not just inside this app's window.
- Show a warning notification after the configured idle-warning threshold, and an idle-justification popup after the justification threshold (both pulled from the org's policy via `GET /agent/config`, never hardcoded).
- Queue events locally and sync them to the backend, tolerating extended offline periods.
- Register itself as a `Device`, authenticate with a device token (not the user's login), and send periodic heartbeats.

## What it does NOT collect

Per Section 12/38 of the spec: no passwords, no keystroke content, no webcam/microphone, no screen content, no private message contents. See `docs/SECURITY.md`.

## Idle detection state machine (`src/monitors/idleMonitor.js`)

```
active --(idle >= warningThresholdMinutes)--> warned --(idle >= justificationThresholdMinutes)--> idle
  ^                                                                                                 |
  '-------------------------------- input resumes / idle-end -----------------------------------'
```

A `lock-screen` event forces an immediate transition to `idle` regardless of the timer - a locked screen is an unambiguous "away" signal (Section 13's own rationale for distinguishing "no input" from "walked away").

On `idle-end` (input resumes), the main process opens the justification popup (`renderer/idle-prompt.html`) with the exact window `{ startedAt, endedAt }`. The employee either:
- picks a reason from the dropdown (Break / Meeting / Lunch / Phone Call / Training / Reading-Thinking / Work Away From Computer / Other, with a free-text field for Other) -> recorded as `IDLE_JUSTIFIED` with that `idleReason`.
- clicks "Skip for now" -> recorded as `IDLE_JUSTIFIED` with no reason, which the backend treats as `UNCLASSIFIED_IDLE` - never auto-labeled unproductive.

## Active-time heartbeats and their throttle

While active, the monitor polls every 5 seconds. Recording an `ACTIVITY_DETECTED` event on every single poll would produce roughly 720 events/hour/user - so `main.js` throttles what's actually persisted to one heartbeat per 60 seconds (`ACTIVE_HEARTBEAT_RECORD_INTERVAL_MS`). The backend's duration aggregation (`attendance.service.js`) treats each persisted `ACTIVITY_DETECTED` event as representing that same 60-second interval when computing `WorkSession.activeDurationSeconds`. If you change the throttle interval, update the corresponding constant server-side too - they are currently two independent constants kept in sync manually (a natural follow-up is having the agent fetch this interval from `/agent/config` alongside the idle policy).

## Offline sync (`src/sync/syncQueue.js`, `src/storage/localStore.js`)

Every event gets a client-generated UUID (`clientEventId`) before touching the network, stored locally via `electron-store`. A background timer flushes the queue every 30 seconds in batches of up to 50. On the server, `activitySync.service.js` upserts on `(organizationId, userId, clientEventId)` - a unique index makes retrying an already-processed batch a no-op rather than a duplicate, which is what makes it safe to replay the entire local queue after an extended outage.

Events the server explicitly rejects (validation failure) are dropped from the local queue rather than retried forever, so a single malformed event can't jam the sync pipeline.

## Device registration & security

1. In the web app: Devices -> Register device, name it, and copy the token shown (shown exactly once, never recoverable afterward).
2. In the agent's setup window: paste the backend URL and the token, test the connection, save.
3. The agent stores the token locally (via `electron-store`) and sends it as `X-Device-Token` on every request to `/agent/*`. The server stores only its `sha256` hash.
4. An admin/HR (or the device's own user) can revoke it any time from Devices - revocation is immediate and independent of the user's login session.

See `docs/SECURITY.md` for the full rationale.

## Building a Windows installer

```bash
cd desktop-agent
npm install
npm run build:win
```

Uses `electron-builder` (see the `build` config in `desktop-agent/package.json`) targeting an NSIS installer. Replace the placeholder tray icon (`nativeImage.createEmpty()` in `main.js`) with a real `.ico` asset before shipping.

## Known limitations (MVP)

- No auto-launch-on-login wiring yet (`app.setLoginItemSettings` is the natural next step, gated by an agent-level policy).
- No crash-recovery/watchdog process beyond what Electron provides by default.
- The active-heartbeat throttle interval is duplicated (agent + server) rather than centrally configured - see above.
