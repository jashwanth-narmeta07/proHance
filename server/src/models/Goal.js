import mongoose from 'mongoose';

/**
 * Org-wide goals only in this MVP - a goal applies to every active employee
 * in the organization, not a per-employee custom target. Evaluated on the
 * fly from Attendance/WorkSession data (see goal.service.js), never stored
 * per-day-per-user - that would mean a write on every check-in/out just to
 * keep goal-progress rows in sync, for something that's cheap to compute
 * at read time instead.
 */
const goalSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    metric: { type: String, enum: ['LOGGED_HOURS', 'ACTIVE_HOURS'], required: true },
    comparator: { type: String, enum: ['GTE', 'LTE'], default: 'GTE' },
    thresholdHours: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

goalSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export default mongoose.model('Goal', goalSchema);
