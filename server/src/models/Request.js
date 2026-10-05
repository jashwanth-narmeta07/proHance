import mongoose from 'mongoose';

export const REQUEST_TYPES = [
  'LEAVE',
  'ATTENDANCE_CORRECTION',
  'WORK_FROM_HOME',
  'OVERTIME',
  'SHIFT_CHANGE',
  'IDLE_TIME_JUSTIFICATION',
  'PROFILE_CHANGE',
  'GENERAL',
];

const approvalHistorySchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['SUBMITTED', 'MOVED_TO_REVIEW', 'APPROVED', 'REJECTED', 'COMMENTED'], required: true },
    comment: { type: String, trim: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },

    // Automatically resolved server-side from the requester's profile - never client-supplied.
    requesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    hrId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    type: { type: String, enum: REQUEST_TYPES, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Flexible structured payload per request type (dates, correction times, etc.)
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },

    attachments: [{ type: String }], // URLs/paths

    status: {
      type: String,
      enum: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'SUBMITTED',
    },

    approvalHistory: [approvalHistorySchema],
  },
  { timestamps: true }
);

requestSchema.index({ organizationId: 1, requesterId: 1, createdAt: -1 });
requestSchema.index({ organizationId: 1, managerId: 1, status: 1 });
requestSchema.index({ organizationId: 1, hrId: 1, status: 1 });

export default mongoose.model('Request', requestSchema);
