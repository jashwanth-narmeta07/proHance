const { EventEmitter } = require('events');
const { powerMonitor } = require('electron');

const POLL_INTERVAL_MS = 5000;

/**
 * Section 13: default policy is 5 min -> warning, 10 min -> justification
 * required, but these numbers are never hardcoded here - they come from
 * fetchAgentConfig() (server getAgentConfig, which reads
 * OrganizationPolicy.idlePolicy). If the config fetch hasn't completed yet,
 * sane defaults matching the spec are used as a fallback so the agent still
 * functions offline.
 *
 * powerMonitor.getSystemIdleTime() is a native OS call - it reflects
 * keyboard/mouse input system-wide, not just activity inside this app, which
 * is what makes it correct for "is the computer being used at all" rather
 * than "is our window focused".
 */
class IdleMonitor extends EventEmitter {
  constructor() {
    super();
    this.policy = {
      warningThresholdMinutes: 5,
      justificationThresholdMinutes: 10,
    };
    this._timer = null;
    this._state = 'active'; // 'active' | 'warned' | 'idle'
    this._idleStartedAt = null;

    // Registered once, for the life of the process - start()/stop() now
    // toggle on every check-in/check-out cycle (not just once at process
    // startup), so binding these inside start() would accumulate a new
    // pair of listeners on Electron's powerMonitor singleton every single
    // cycle. Gating on this._timer here instead keeps start()/stop() safe
    // to call any number of times.
    powerMonitor.on('lock-screen', () => {
      if (this._timer) this._forceIdle();
    });
    powerMonitor.on('resume', () => {
      if (this._timer) this._tick();
    });
  }

  updatePolicy(idlePolicy) {
    if (!idlePolicy) return;
    this.policy = {
      warningThresholdMinutes: idlePolicy.warningThresholdMinutes ?? this.policy.warningThresholdMinutes,
      justificationThresholdMinutes:
        idlePolicy.justificationThresholdMinutes ?? this.policy.justificationThresholdMinutes,
    };
  }

  start() {
    if (this._timer) return;
    this._state = 'active';
    this._idleStartedAt = null;
    this._timer = setInterval(() => this._tick(), POLL_INTERVAL_MS);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    // heartbeatLoop() reads getState() on every heartbeat regardless of
    // whether tracking is active (see main.js) - without this reset, a
    // check-out that happens while idle/warned would leave that state
    // frozen there indefinitely, showing the device as permanently "Idle"
    // on the Devices page even hours later, long after it's actually
    // stopped meaning anything.
    this._state = 'active';
    this._idleStartedAt = null;
  }

  _forceIdle() {
    if (this._state === 'idle') return;
    this._state = 'idle';
    this._idleStartedAt = new Date();
    this.emit('idle-start', { startedAt: this._idleStartedAt, reasonHint: 'LOCKED' });
  }

  _tick() {
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const idleMinutes = idleSeconds / 60;
    const warningAt = this.policy.warningThresholdMinutes;
    const justificationAt = this.policy.justificationThresholdMinutes;

    if (idleMinutes < warningAt) {
      if (this._state !== 'active') {
        const idleStartedAt = this._idleStartedAt;
        this._state = 'active';
        this._idleStartedAt = null;
        if (idleStartedAt) {
          this.emit('idle-end', { startedAt: idleStartedAt, endedAt: new Date() });
        }
      } else {
        this.emit('active-heartbeat');
      }
      return;
    }

    if (idleMinutes >= justificationAt && this._state !== 'idle') {
      if (this._state === 'active') {
        // Skipped straight past the warning (e.g. app just started while
        // already idle) - still record idle-start for correct duration math.
        this._idleStartedAt = new Date(Date.now() - idleSeconds * 1000);
      }
      this._state = 'idle';
      this.emit('idle-start', { startedAt: this._idleStartedAt });
      return;
    }

    if (idleMinutes >= warningAt && this._state === 'active') {
      this._state = 'warned';
      this._idleStartedAt = new Date(Date.now() - idleSeconds * 1000);
      this.emit('warning', { idleMinutes });
    }
  }

  getState() {
    return { state: this._state, idleStartedAt: this._idleStartedAt };
  }
}

module.exports = { IdleMonitor };