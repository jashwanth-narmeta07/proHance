import { z } from 'zod';
import { EVENT_TYPES, IDLE_REASONS } from '../models/ActivityEvent.js';

const activityEvent = z.object({
  clientEventId: z.string().min(1).max(100),
  eventType: z.enum(EVENT_TYPES),
  timestamp: z.string(),
  idleStartedAt: z.string().optional(),
  idleEndedAt: z.string().optional(),
  idleReason: z.enum(IDLE_REASONS).optional(),
  idleReasonNote: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const syncEventsSchema = {
  body: z.object({
    events: z.array(activityEvent).min(1).max(200),
  }),
};

// All optional and all best-effort - an older agent build that doesn't send
// these yet should still heartbeat successfully, it just won't update the
// device's OS info until it upgrades.
export const heartbeatSchema = {
  body: z.object({
    os: z.string().max(100).optional(),
    osVersion: z.string().max(100).optional(),
    agentVersion: z.string().max(50).optional(),
    isIdle: z.boolean().optional(),
    isCheckedIn: z.boolean().optional(),
  }),
};