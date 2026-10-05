import ActivityEvent from '../models/ActivityEvent.js';
import attendanceRepository from '../repositories/attendance.repository.js';
import policyRepository from '../repositories/policy.repository.js';
import { emitToOrganization, emitToUser } from '../sockets/index.js';
import logger from '../config/logger.js';

/**
 * Section 31/32: the agent never sends its own idea of "who I am" beyond the
 * device token - userId/organizationId/workSessionId are always resolved
 * server-side from req.device, never trusted from the event payload. This
 * also means a synced event automatically attaches to whichever WorkSession
 * is currently open for that user, even if the agent was offline when the
 * session started.
 *
 * Idempotency: each event carries a client-generated clientEventId. The
 * unique index on (organizationId, userId, clientEventId) means a retried
 * sync of the same event is a no-op, not a duplicate - this is what makes
 * the offline queue safe to replay after a network outage (Section 31).
 */
export async function syncActivityEvents(device, events) {
  const { organizationId, userId, _id: deviceId } = device;

  const attendance = await attendanceRepository.findOpenForUser(userId, organizationId);
  const workSessionId = attendance?.workSessionId || null;

  const results = [];
  for (const evt of events) {
    try {
      const doc = await ActivityEvent.findOneAndUpdate(
        { organizationId, userId, clientEventId: evt.clientEventId },
        {
          $setOnInsert: {
            organizationId,
            userId,
            deviceId,
            workSessionId,
            clientEventId: evt.clientEventId,
            eventType: evt.eventType,
            timestamp: new Date(evt.timestamp),
            idleStartedAt: evt.idleStartedAt ? new Date(evt.idleStartedAt) : undefined,
            idleEndedAt: evt.idleEndedAt ? new Date(evt.idleEndedAt) : undefined,
            idleReason: evt.idleReason || null,
            idleReasonNote: evt.idleReasonNote,
            justified: !!evt.idleReason,
            metadata: evt.metadata || {},
            source: 'DESKTOP_AGENT',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push({ clientEventId: evt.clientEventId, status: 'ok', id: doc._id });
    } catch (err) {
      // A duplicate-key race (two near-simultaneous retries) is expected and
      // harmless under this idempotency scheme - anything else is logged.
      if (err.code !== 11000) {
        logger.error('Failed to sync activity event', { clientEventId: evt.clientEventId, error: err.message });
        results.push({ clientEventId: evt.clientEventId, status: 'error', error: err.message });
      } else {
        results.push({ clientEventId: evt.clientEventId, status: 'ok' });
      }
    }
  }

  const hasIdleJustified = events.some((e) => e.eventType === 'IDLE_JUSTIFIED' && !e.idleReason);
  if (hasIdleJustified) {
    // An unjustified idle window closed - let managers/HR see it live rather
    // than only on the next report pull.
    emitToOrganization(organizationId.toString(), 'activity:unclassified-idle', { userId: userId.toString() });
  }

  return results;
}

/**
 * Section 12/22: the agent asks the backend for its config, never hardcodes
 * thresholds. Also carries isCheckedIn - main.js uses this to gate whether
 * idle-monitoring/app-tracking should actually be running: the agent
 * should only observe activity while the employee has an open attendance
 * session, not merely because the Electron process happens to be running.
 * Polled every 15s (see main.js's refreshAgentConfig interval), so there's
 * up to ~15s of lag between clicking Check In on the web app and tracking
 * actually starting - an accepted trade-off for not building a push
 * channel between the web app and a separate desktop process.
 */
export async function getAgentConfig(device) {
  const policy = await policyRepository.getOrCreate(device.organizationId);
  const openAttendance = await attendanceRepository.findOpenForUser(device.userId, device.organizationId);
  return {
    idlePolicy: policy.idlePolicy,
    activityCollectionPolicy: policy.activityCollectionPolicy,
    isCheckedIn: !!openAttendance,
  };
}

export async function heartbeatAck(device) {
  emitToUser(device.userId.toString(), 'device:heartbeat', { deviceId: device._id, at: new Date() });
}