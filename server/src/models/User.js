import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/permissions.js';

const userSchema = new mongoose.Schema(
  {
    // SUPER_ADMIN users have organizationId = null; every other role requires it.
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },

    role: { type: String, enum: Object.values(ROLES), required: true },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    profilePhotoUrl: { type: String, trim: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },

    employeeId: { type: String, trim: true },
    designation: { type: String, trim: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    joiningDate: { type: Date },
    employmentType: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
      default: 'FULL_TIME',
    },

    workLocation: { type: String, trim: true },
    timezone: { type: String, default: 'UTC' },
    shift: { type: String, trim: true },

    status: {
      type: String,
      enum: ['INVITED', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'DEACTIVATED', 'EXITED'],
      default: 'ACTIVE',
    },

    lastLoginAt: { type: Date },
    refreshTokenVersion: { type: Number, default: 0 }, // bump to invalidate all refresh tokens
  },
  { timestamps: true }
);

// Email must be unique per-organization, not globally (SUPER_ADMIN aside) -
// two different companies may have an employee with the same work email pattern is unlikely
// but the tenant-scoped uniqueness is the correct invariant for a multi-tenant system.
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ organizationId: 1, role: 1 });
userSchema.index({ organizationId: 1, managerId: 1 });
userSchema.index({ organizationId: 1, teamId: 1 });
userSchema.index({ organizationId: 1, departmentId: 1 });

userSchema.methods.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject({ versionKey: false });
  delete obj.passwordHash;
  delete obj.refreshTokenVersion;
  return obj;
};

userSchema.statics.hashPassword = async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
};

export default mongoose.model('User', userSchema);
