import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: {
      type: String,
      enum: [
        'REQUEST_SUBMITTED',
        'REQUEST_STATUS_CHANGED',
        'REQUEST_ASSIGNED_FOR_REVIEW',
        'MEMBER_INVITED',
        'MEMBER_JOINED',
        'DEVICE_REVOKED',
        'IDLE_JUSTIFICATION_NEEDED',
        'GENERAL',
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    relatedEntityType: { type: String, trim: true }, // e.g. 'Request', 'Device'
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },

    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ organizationId: 1, recipientId: 1, read: 1, createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);
