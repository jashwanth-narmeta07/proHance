import mongoose from 'mongoose';

export const EVENT_TYPES = [
  'SESSION_STARTED',
  'SESSION_ENDED',
  'ACTIVITY_DETECTED',
  'IDLE_STARTED',
  'IDLE_JUSTIFIED',
  'BREAK_STARTED',
  'BREAK_ENDED',
  'MEETING_STARTED',
  'MEETING_ENDED',
  'DEVICE_ONLINE',
  'DEVICE_OFFLINE',
  'AGENT_STARTED',
  'AGENT_STOPPED',
  // metadata: { appName, durationSeconds } - app name only, never a window
  // title. Only emitted by the agent when the org has opted in via
  // OrganizationPolicy.activityCollectionPolicy.collectAppMetadata.
  'APP_USAGE',
];

export const IDLE_REASONS = [
  'BREAK',
  'MEETING',
  'LUNCH',
  'PHONE_CALL',
  'TRAINING',
  'READING_THINKING',
  'WORK_AWAY_FROM_COMPUTER',
  'OTHER',
];

const activityEventSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
    workSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkSession', default: null, index: true },

    // Client-generated unique ID so retried/offline-queued syncs are idempotent.
    clientEventId: { type: String, required: true },

    eventType: { type: String, enum: EVENT_TYPES, required: true },
    timestamp: { type: Date, required: true },

    // For IDLE_STARTED/IDLE_JUSTIFIED pairs
    idleStartedAt: { type: Date },
    idleEndedAt: { type: Date },
    idleReason: { type: String, enum: IDLE_REASONS, default: null },
    idleReasonNote: { type: String, trim: true }, // used when idleReason === 'OTHER'
    justified: { type: Boolean, default: false },

    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    source: { type: String, enum: ['DESKTOP_AGENT', 'WEB', 'SYSTEM'], default: 'DESKTOP_AGENT' },
  },
  { timestamps: true }
);

// Idempotency: the same client event synced twice must not create two documents.
activityEventSchema.index({ organizationId: 1, userId: 1, clientEventId: 1 }, { unique: true });
activityEventSchema.index({ organizationId: 1, workSessionId: 1, eventType: 1 });
activityEventSchema.index({ organizationId: 1, userId: 1, timestamp: -1 });

export default mongoose.model('ActivityEvent', activityEventSchema);
