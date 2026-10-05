import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    workSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkSession', default: null },

    date: { type: Date, required: true }, // normalized to 00:00 of the attendance day
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date, default: null },

    breakDurationSeconds: { type: Number, default: 0 },
    totalDurationSeconds: { type: Number, default: 0 },

    // The currently-open (or most recently closed) session for today - what
    // startBreak/endBreak/getToday and the agent's activity sync scope
    // events to. workSessionIds keeps the full history of every check-in
    // cycle for the day, since Attendance stays one record per user per
    // day even when they check in/out more than once (Section 37.11 still
    // applies per-session; this just lets a day span several sessions).
    workSessionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkSession' }],

    status: {
      type: String,
      enum: ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'CORRECTED'],
      default: 'PRESENT',
    },
    flags: [{ type: String, enum: ['LATE_ARRIVAL', 'EARLY_DEPARTURE', 'OVERTIME'] }],

    isCorrected: { type: Boolean, default: false },
    correctionReason: { type: String, trim: true },
  },
  { timestamps: true }
);

attendanceSchema.index({ organizationId: 1, userId: 1, date: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
