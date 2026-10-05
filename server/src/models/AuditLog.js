import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    action: { type: String, required: true, trim: true }, // e.g. 'MEMBER_ROLE_CHANGED'
    targetEntity: { type: String, required: true, trim: true }, // e.g. 'User', 'Device'
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },

    previousValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },

    ipAddress: { type: String, trim: true },
    userAgent: { type: String, trim: true },
  },
  { timestamps: true }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, targetEntity: 1, targetId: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
