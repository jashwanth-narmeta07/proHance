import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    deviceName: { type: String, required: true, trim: true },
    os: { type: String, trim: true },
    osVersion: { type: String, trim: true },
    agentVersion: { type: String, trim: true },

    // Secret used by the desktop agent to authenticate device-scoped sync calls.
    deviceTokenHash: { type: String, select: false },

    lastHeartbeatAt: { type: Date },
    lastSyncAt: { type: Date },
    onlineStatus: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE' },
    // Reported by the agent on every heartbeat (see apiClient.js sendHeartbeat)
    // - whether the machine is currently past the idle warning threshold.
    // Only meaningful alongside a recent lastHeartbeatAt; see activityStatus.
    lastKnownIdle: { type: Boolean, default: false },
    // Whether the employee has an open attendance check-in right now, per
    // the agent's own config poll (main.js refreshAgentConfig). The agent
    // heartbeats continuously whether or not anyone's checked in - without
    // this, a laptop just left running showed as "Active" even hours after
    // the employee checked out for the day.
    lastKnownCheckedIn: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['REGISTERED', 'ACTIVE', 'OFFLINE', 'REVOKED'],
      default: 'REGISTERED',
    },
  },
  { timestamps: true }
);

// The agent heartbeats every 15s (main.js heartbeatLoop) - three missed
// beats means it's actually gone (app closed, laptop asleep, network
// down), not just briefly slow, so anything older than this is stale.
const HEARTBEAT_STALE_MS = 45 * 1000;

/**
 * Active/Idle/Offline as the Devices page actually needs it - computed fresh from the clock on every read instead of a flag
 * some past write set and then never revisited, which is exactly what made
 * "status" look permanently frozen before this existed: recordHeartbeat
 * only ever moved it forward to ACTIVE and nothing ever moved it back once
 * heartbeats stopped arriving.
 */
deviceSchema.virtual('activityStatus').get(function () {
  if (this.status === 'REVOKED') return 'REVOKED';
  if (this.status === 'REGISTERED' && !this.lastHeartbeatAt) return 'REGISTERED';
  const lastBeat = this.lastHeartbeatAt ? this.lastHeartbeatAt.getTime() : 0;
  if (Date.now() - lastBeat > HEARTBEAT_STALE_MS) return 'OFFLINE';
  // Checked out counts as Offline too, even though the agent may still be
  // running and heartbeating fine - Active/Idle only mean something while
  // the employee actually has an open check-in.
  if (!this.lastKnownCheckedIn) return 'OFFLINE';
  return this.lastKnownIdle ? 'IDLE' : 'ACTIVE';
});

deviceSchema.set('toJSON', { virtuals: true });
deviceSchema.set('toObject', { virtuals: true });

deviceSchema.index({ organizationId: 1, userId: 1 });

export default mongoose.model('Device', deviceSchema);