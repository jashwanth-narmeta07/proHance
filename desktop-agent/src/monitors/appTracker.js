const { EventEmitter } = require('events');

// Loaded lazily/defensively: active-win is a native addon (prebuilt binary
// per-OS/arch, see package.json). If it fails to load - wrong platform, a
// missing binary, a sandboxed/locked-down machine - app-usage tracking is
// simply unavailable and the rest of the agent (idle tracking, heartbeats,
// attendance) must keep working completely unaffected. This is why every
// call into it below is wrapped in its own try/catch rather than letting a
// failure here take down anything else.
let activeWindow;
try {
  activeWindow = require('active-win');
} catch {
  activeWindow = null;
}

const SAMPLE_INTERVAL_MS = 30000;

/**
 * App-name-only usage tracking - deliberately the *app* (e.g. "Google
 * Chrome", "Visual Studio Code"), never the window title. A window title
 * would leak document names, email subject lines, browser tab contents,
 * etc. - a materially more invasive category of data than this product's
 * stated design ("what app, never what's on screen"). See
 * docs/DESKTOP_AGENT.md for the full privacy boundary this respects.
 *
 * Gated entirely behind OrganizationPolicy.activityCollectionPolicy.
 * collectAppMetadata (server/src/models/OrganizationPolicy.js) - off by
 * default, and this tracker does nothing at all unless the org has
 * explicitly opted in via Policies. configure() below is how main.js wires
 * that flag in after each config refresh.
 *
 * Samples the foreground app on a fixed interval and attributes the whole
 * interval to whichever app was in focus at sample time - this is
 * approximate (a rapid app switch between samples is missed), not exact
 * per-second accounting, which is an intentional simplicity/cost trade-off
 * matching the same throttling philosophy as the idle-heartbeat throttle
 * in main.js (one recorded sample per interval, not a flood of events).
 */
class AppTracker extends EventEmitter {
  constructor() {
    super();
    this._timer = null;
    this._enabled = false;
    this._paused = false; // true while the user is idle - don't attribute idle time to an app
  }

  isSupported() {
    return !!activeWindow;
  }

  configure(enabled) {
    this._enabled = !!enabled;
  }

  setPaused(paused) {
    this._paused = paused;
  }

  start() {
    if (this._timer || !activeWindow) return;
    this._timer = setInterval(() => this._tick(), SAMPLE_INTERVAL_MS);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async _tick() {
    if (!this._enabled || this._paused || !activeWindow) return;
    try {
      const win = await activeWindow();
      const appName = win?.owner?.name;
      if (!appName) return; // e.g. desktop/no window focused
      this.emit('sample', { appName, durationSeconds: SAMPLE_INTERVAL_MS / 1000 });
    } catch {
      // Platform permission not yet granted (e.g. macOS Screen Recording
      // permission), or a transient OS-call failure - skip this sample,
      // never let it throw into the interval timer.
    }
  }
}

module.exports = { AppTracker };
