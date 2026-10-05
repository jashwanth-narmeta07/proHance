# Running the server test suite

```bash
cd server
npm install
npm test
```

## What's covered

- `tests/auth.test.js` - organization registration (atomic), login, refresh, logout/token revocation, rejecting missing/malformed tokens.
- `tests/tenantIsolation.test.js` - the exact scenario Section 34 calls out: a valid, authenticated admin from Organization B cannot read Organization A's departments, members, or organization settings, even when given a real, valid id. Also covers device-token auth being tenant-scoped.
- `tests/rbac.test.js` - manager A cannot manage manager B's team (ownership, not just role, is checked); an employee cannot approve their own request; HR cannot escalate a member to HR/Admin; an employee cannot read the org-wide device list.
- `tests/attendance.test.js` - check-in/check-out lifecycle, duplicate check-in/out rejected, break accumulation, and that active time is genuinely 0 with no desktop agent connected (not approximated from wall-clock time) - the core guarantee behind Section 37.11. Also covers employee-to-employee activity privacy.

These call the real HTTP API via supertest against the real Express app, not a mocked-out shortcut - so they exercise the actual routes, middleware, and services exactly as they run in production.

## Why this couldn't be verified inside the sandbox that built this project

`tests/setup.js` spins up a real, ephemeral MongoDB instance via `mongodb-memory-server`, which downloads a `mongod` binary from `fastdl.mongodb.org` on first run. The sandbox this project was built in only permits outbound network access to a small allowlist of package registries (npm, PyPI, GitHub) - MongoDB's binary host isn't on it. Running `npm test` there fails with a download error, not a code error:

```
Download failed for url "https://fastdl.mongodb.org/...": Status Code is 403
```

Everything up to that point - Jest picking up the suite, `beforeAll` running, the app importing and serving requests - worked correctly. This is an environment limitation, not a signal that the tests themselves are broken. Run `npm test` on a machine with normal internet access (or in CI) and it will download the binary once, cache it, and run normally afterward.
