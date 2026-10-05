import mongoose from 'mongoose';
import crypto from 'crypto';
import { ROLES } from '../config/permissions.js';

const invitationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: Object.values(ROLES), required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Only the hash is stored; the raw token is emailed once and never persisted.
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
      default: 'PENDING',
    },
    acceptedAt: { type: Date },
  },
  { timestamps: true }
);

invitationSchema.index({ organizationId: 1, email: 1, status: 1 });

invitationSchema.statics.generateToken = function generateToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

invitationSchema.statics.hashToken = function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
};

export default mongoose.model('Invitation', invitationSchema);
