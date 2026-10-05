const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Without this, an uncaught exception anywhere in the main process (e.g.
// the Tray-construction crash this was added alongside) kills the whole
// app instantly and silently - no dialog, nothing in Task Manager, no way
// to tell "it's not working" apart from "it's not even running". This
// doesn't attempt to recover; it just guarantees there's a trace of *why*
// before the process goes down, since a crash you can't see is a crash
// you can't fix.
function logCrash(label, err) {
  try {
    const logPath = path.join(app.getPath('userData'), 'crash.log');
    const line = `[${new Date().toISOString()}] ${label}: ${err?.stack || err}\n`;
    fs.appendFileSync(logPath, line);
  } catch {
    // logging itself failing is not something to crash further over
  }
}
process.on('uncaughtException', (err) => logCrash('uncaughtException', err));
process.on('unhandledRejection', (err) => logCrash('unhandledRejection', err));

const localStore = require('../storage/localStore.js');
const { IdleMonitor } = require('../monitors/idleMonitor.js');
const { AppTracker } = require('../monitors/appTracker.js');
const { SyncManager, recordEvent } = require('../sync/syncQueue.js');
const api = require('../services/apiClient.js');
const { showIdleWarning, showAgentStatusNotification } = require('../notifications/notify.js');

let tray = null;
let setupWindow = null;
let idlePopupWindow = null;
let statusWindow = null;

const idleMonitor = new IdleMonitor();
const appTracker = new AppTracker();
const syncManager = new SyncManager({
  onSyncError: () => {
    /* stays queued locally - Section 31; surfaced via tray tooltip below */
  },
});

let agentStatus = {
  connected: false,
  lastHeartbeatAt: null,
  pendingIdleJustification: null, // { startedAt, endedAt }
  trackingActive: false, // true only while the employee has an open attendance check-in
};

function updateTrayTooltip() {
  if (!tray) return;
  const pending = localStore.queueLength();
  tray.setToolTip(
    `Workforce SaaS Agent - ${agentStatus.connected ? 'Connected' : 'Offline'}${
      pending > 0 ? ` - ${pending} event(s) queued` : ''
    }`
  );
}

function broadcastStatus() {
  updateTrayTooltip();
  if (statusWindow) {
    statusWindow.webContents.send('status:update', { ...agentStatus, pendingSync: localStore.queueLength() });
  }
}

// --- Windows -----------------------------------------------------------

function createSetupWindow() {
  if (setupWindow) {
    setupWindow.focus();
    return;
  }
  setupWindow = new BrowserWindow({
    width: 420,
    height: 480,
    resizable: false,
    title: 'Workforce SaaS Agent Setup',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  setupWindow.setMenuBarVisibility(false);
  setupWindow.loadFile(path.join(__dirname, '..', 'renderer', 'setup.html'));
  setupWindow.on('closed', () => {
    setupWindow = null;
  });
}

function createStatusWindow() {
  if (statusWindow) {
    statusWindow.focus();
    return;
  }
  statusWindow = new BrowserWindow({
    width: 340,
    height: 360,
    resizable: false,
    title: 'Workforce SaaS Agent',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  statusWindow.setMenuBarVisibility(false);
  statusWindow.loadFile(path.join(__dirname, '..', 'renderer', 'status.html'));
  statusWindow.on('closed', () => {
    statusWindow = null;
  });
}

/**
 * Section 13/14: shown when the justification threshold is crossed. The
 * popup is intentionally small, always-on-top, and cannot be dismissed by
 * clicking away - the employee must either pick a reason or explicitly
 * leave it unclassified, matching the spec's dropdown + "Other" text field.
 */
function showIdleJustificationPopup(idleWindow) {
  agentStatus.pendingIdleJustification = idleWindow;
  broadcastStatus();

  if (idlePopupWindow) {
    idlePopupWindow.webContents.send('idle:prompt', idleWindow);
    idlePopupWindow.focus();
    return;
  }

  idlePopupWindow = new BrowserWindow({
    width: 380,
    height: 340,
    resizable: false,
    alwaysOnTop: true,
    title: 'What were you doing?',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  idlePopupWindow.setMenuBarVisibility(false);
  idlePopupWindow.loadFile(path.join(__dirname, '..', 'renderer', 'idle-prompt.html'));
  idlePopupWindow.webContents.once('did-finish-load', () => {
    idlePopupWindow.webContents.send('idle:prompt', idleWindow);
  });
  idlePopupWindow.on('closed', () => {
    idlePopupWindow = null;
  });
}

// --- Tray ----------------------------------------------------------------

function createTray() {
  // A real, non-empty icon - some Electron/Windows combinations throw when
  // constructing a Tray from nativeImage.createEmpty(), which (with no
  // global handler in place) would silently crash the whole main process
  // the instant startAgent() runs, with zero trace of why. See the
  // uncaughtException/unhandledRejection handlers below for the other half
  // of this fix - this icon existing is the fix for THIS specific crash;
  // those handlers are the fix for the next unknown one.
  const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Status', click: createStatusWindow },
    { label: 'Reconfigure device', click: createSetupWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  updateTrayTooltip();
}

// --- Agent lifecycle -------------------------------------------------------

/**
 * Tracking (idle detection + app usage) only runs while the employee has an
 * open attendance check-in - not merely because this process happens to be
 * running. isCheckedIn comes from the backend's /agent/config response
 * (server/src/services/activitySync.service.js resolves it from the same
 * Attendance record the web app's Check In/Check Out buttons write to), so
 * clicking Check In on the web app is what (indirectly) starts tracking
 * here, and Check Out is what stops it - this poll is how that reaches a
 * separate desktop process without a push channel between them.
 */
function setTrackingActive(active) {
  if (active === agentStatus.trackingActive) return;
  agentStatus.trackingActive = active;
  if (active) {
    idleMonitor.start();
    appTracker.start();
    showAgentStatusNotification('Checked in - activity tracking has started.');
  } else {
    idleMonitor.stop();
    appTracker.stop();
    showAgentStatusNotification('Checked out - activity tracking has stopped.');
  }
}

async function refreshAgentConfig() {
  try {
    const config = await api.fetchAgentConfig();
    idleMonitor.updatePolicy(config.idlePolicy);
    appTracker.configure(config.activityCollectionPolicy?.collectAppMetadata);
    agentStatus.connected = true;
    setTrackingActive(!!config.isCheckedIn);
  } catch {
    agentStatus.connected = false;
  }
  broadcastStatus();
}

async function heartbeatLoop() {
  try {
    // 'warned' (past the warning threshold but not yet past the
    // justification threshold) still means the person isn't at the
    // keyboard, so it counts as idle for the Devices page's status too -
    // only 'active' is not idle.
    const isIdle = idleMonitor.getState().state !== 'active';
    await api.sendHeartbeat(isIdle, agentStatus.trackingActive);
    agentStatus.connected = true;
    agentStatus.lastHeartbeatAt = new Date().toISOString();
  } catch {
    agentStatus.connected = false;
  }
  broadcastStatus();
}

let lastActiveHeartbeatRecordedAt = 0;
const ACTIVE_HEARTBEAT_RECORD_INTERVAL_MS = 60 * 1000;

function wireIdleMonitor() {
  idleMonitor.on('warning', ({ idleMinutes }) => {
    const remaining = Math.max(0, Math.ceil(idleMonitor.policy.justificationThresholdMinutes - idleMinutes));
    showIdleWarning(remaining);
  });

  idleMonitor.on('idle-start', ({ startedAt }) => {
    appTracker.setPaused(true);
    recordEvent('IDLE_STARTED', { idleStartedAt: startedAt.toISOString() });
    // The employee is still idle right now - there's no real "end" yet, just
    // the moment this popup happened to open. ongoing:true tells the
    // renderer to keep ticking that shown end time forward live instead of
    // freezing it, and to use the actual time-of-click as endedAt if they
    // respond from this still-idle state (see idle-prompt.js).
    showIdleJustificationPopup({
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      ongoing: true,
    });
  });

  idleMonitor.on('idle-end', ({ startedAt, endedAt }) => {
    appTracker.setPaused(false);
    // The event itself is recorded once the employee justifies it (or
    // explicitly skips) - see idle:submit-justification below. We open the
    // popup here so the classification happens right when they return,
    // per Section 14 ("when the employee returns, allow them to classify").
    // endedAt here is real - the employee has already moved again - so
    // ongoing:false keeps the display (and the submitted value) fixed.
    if (idlePopupWindow || agentStatus.pendingIdleJustification) {
      showIdleJustificationPopup({ startedAt: startedAt.toISOString(), endedAt: endedAt.toISOString(), ongoing: false });
    }
  });

  // The monitor polls every 5s (see idleMonitor.js POLL_INTERVAL_MS) and
  // fires 'active-heartbeat' on every tick while active - recording an
  // ActivityEvent on every single tick would flood the sync queue and the
  // database with ~720 events/hour per user. We throttle what we actually
  // persist to one heartbeat per minute; the backend's active-time
  // aggregation (server/src/services/attendance.service.js) treats each
  // recorded ACTIVITY_DETECTED event as representing this same interval,
  // so the throttle value here and the aggregation's per-event duration
  // must stay in sync if either changes.
  idleMonitor.on('active-heartbeat', () => {
    const now = Date.now();
    if (now - lastActiveHeartbeatRecordedAt < ACTIVE_HEARTBEAT_RECORD_INTERVAL_MS) return;
    lastActiveHeartbeatRecordedAt = now;
    recordEvent('ACTIVITY_DETECTED');
  });
}

function wireAppTracker() {
  // App-name-only, gated behind OrganizationPolicy.activityCollectionPolicy.
  // collectAppMetadata - see appTracker.js for the full rationale. Each
  // sample is recorded through the same offline-safe queue as every other
  // event; the backend attributes it to whichever WorkSession is open.
  appTracker.on('sample', ({ appName, durationSeconds }) => {
    recordEvent('APP_USAGE', { metadata: { appName, durationSeconds } });
  });
}

function startAgent() {
  createTray();
  wireIdleMonitor();
  wireAppTracker();
  syncManager.start();
  // idleMonitor/appTracker are deliberately NOT started here - refreshAgentConfig()
  // below decides that based on isCheckedIn, and re-checks every 15s.

  refreshAgentConfig();
  heartbeatLoop();
  // 15s each rather than 60s: these two intervals run independently, so a
  // 60s cadence on both meant up to ~2 minutes of worst-case lag between
  // clicking Check In/Out on the web app and the Devices page's
  // Active/Idle/Offline badge catching up (see server/src/models/Device.js
  // HEARTBEAT_STALE_MS, sized to match this cadence).
  setInterval(refreshAgentConfig, 15 * 1000); // also doubles as the check-in/out poll - see setTrackingActive
  setInterval(heartbeatLoop, 15 * 1000);
  setInterval(broadcastStatus, 10 * 1000);

  recordEvent('AGENT_STARTED');
  showAgentStatusNotification('Agent started - waiting for check-in to begin tracking.');
}

// --- IPC handlers ----------------------------------------------------------

ipcMain.handle('config:get', () => localStore.getConfig());

ipcMain.handle('config:test-connection', async (_event, apiBaseUrl) => {
  try {
    await axios.get(`${apiBaseUrl.replace(/\/api\/v1\/?$/, '')}/health`, { timeout: 5000 });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('config:save-setup', (_event, { apiBaseUrl, deviceToken, deviceName, userEmail }) => {
  localStore.saveConfig({ apiBaseUrl, deviceToken, deviceName, userEmail });
  if (setupWindow) setupWindow.close();
  startAgent();
  return { ok: true };
});

ipcMain.handle('idle:submit-justification', (_event, { startedAt, endedAt, idleReason, idleReasonNote }) => {
  recordEvent('IDLE_JUSTIFIED', {
    idleStartedAt: startedAt,
    idleEndedAt: endedAt,
    idleReason: idleReason || undefined, // absent = UNCLASSIFIED_IDLE, never auto-labeled
    idleReasonNote: idleReasonNote || undefined,
  });
  agentStatus.pendingIdleJustification = null;
  broadcastStatus();
  syncManager.flush();
  if (idlePopupWindow) idlePopupWindow.close();
  return { ok: true };
});

ipcMain.handle('status:get', () => ({ ...agentStatus, pendingSync: localStore.queueLength() }));

// --- App lifecycle -----------------------------------------------------------

app.whenReady().then(() => {
  if (localStore.isConfigured()) {
    startAgent();
  } else {
    createSetupWindow();
  }
});

app.on('window-all-closed', () => {
  // The agent is tray-resident by design (Section 12: runs in the
  // background) - closing a visible window should never quit the app.
});

app.on('before-quit', () => {
  recordEvent('AGENT_STOPPED');
  syncManager.flush();
});