import mongoose from 'mongoose';

const workSessionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },

    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date, default: null },

    // Computed at checkout time by aggregating this session's ActivityEvents -
    // never derived from raw wall-clock (PC-on) duration.
    activeDurationSeconds: { type: Number, default: 0 },
    idleDurationSeconds: { type: Number, default: 0 },
    breakDurationSeconds: { type: Number, default: 0 },
    meetingDurationSeconds: { type: Number, default: 0 },
    unclassifiedIdleSeconds: { type: Number, default: 0 },

    status: { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

workSessionSchema.index({ organizationId: 1, userId: 1, checkInAt: -1 });
workSessionSchema.index({ organizationId: 1, status: 1 });

export default mongoose.model('WorkSession', workSessionSchema);
