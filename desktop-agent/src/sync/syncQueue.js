const { randomUUID } = require('crypto');
const api = require('../services/apiClient.js');
const { enqueueEvent, peekQueue, removeFromQueue, queueLength } = require('../storage/localStore.js');

const FLUSH_INTERVAL_MS = 30000;
const BATCH_SIZE = 50;

/**
 * Section 31: every event gets a client-generated UUID before it ever
 * touches the network. If a sync request succeeds but the response is lost
 * (e.g. connection drops right after the server processed it), retrying the
 * same batch is safe - the server's unique index on clientEventId makes the
 * retry a no-op rather than a duplicate.
 */
function recordEvent(eventType, extra = {}) {
  const event = {
    clientEventId: randomUUID(),
    eventType,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  enqueueEvent(event);
  return event;
}

class SyncManager {
  constructor({ onSyncError } = {}) {
    this._timer = null;
    this._flushing = false;
    this._onSyncError = onSyncError;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    this.flush(); // attempt an immediate flush on start, e.g. after being offline
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async flush() {
    if (this._flushing) return; // avoid overlapping flushes if one is slow
    if (queueLength() === 0) return;
    this._flushing = true;
    try {
      const batch = peekQueue(BATCH_SIZE);
      if (batch.length === 0) return;

      const results = await api.syncEvents(batch);
      const acceptedIds = results.filter((r) => r.status === 'ok').map((r) => r.clientEventId);
      if (acceptedIds.length > 0) removeFromQueue(acceptedIds);

      // Anything the server explicitly rejected (validation failure, not a
      // network error) also gets dropped rather than retried forever - an
      // infinitely-retried malformed event would otherwise jam the queue.
      const rejectedIds = results.filter((r) => r.status === 'error').map((r) => r.clientEventId);
      if (rejectedIds.length > 0) removeFromQueue(rejectedIds);
    } catch (err) {
      // Network/auth failure - events stay queued for the next attempt.
      // This is the offline case Section 31 describes: keep locally, retry later.
      this._onSyncError?.(err);
    } finally {
      this._flushing = false;
    }
  }

  pendingCount() {
    return queueLength();
  }
}

module.exports = { recordEvent, SyncManager };
