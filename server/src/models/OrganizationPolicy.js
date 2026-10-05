import mongoose from 'mongoose';

const organizationPolicySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },

    idlePolicy: {
      warningThresholdMinutes: { type: Number, default: 5 },
      justificationThresholdMinutes: { type: Number, default: 10 },
      requireJustification: { type: Boolean, default: true },
      allowedReasons: {
        type: [String],
        default: ['BREAK', 'MEETING', 'LUNCH', 'PHONE_CALL', 'TRAINING', 'READING_THINKING', 'WORK_AWAY_FROM_COMPUTER', 'OTHER'],
      },
    },

    attendancePolicy: {
      automaticCheckIn: { type: Boolean, default: false },
      graceMinutes: { type: Number, default: 10 },
      workStartTime: { type: String, default: '09:00' }, // HH:mm, org-local timezone
      workEndTime: { type: String, default: '18:00' },
      workDays: { type: [Number], default: [1, 2, 3, 4, 5] }, // 0=Sun..6=Sat
      // A calendar day only counts toward "Attendance days" once the
      // employee's total checked-in duration that day reaches this many
      // minutes - a two-minute check-in/check-out no longer counts as a
      // full day. Default 420 = 7h. See analytics.service.js summarizeForUsers.
      fullDayMinimumMinutes: { type: Number, default: 420 },
    },

    breakPolicy: {
      maxBreakMinutesPerDay: { type: Number, default: 60 },
    },

    overtimePolicy: {
      overtimeAfterMinutesPerDay: { type: Number, default: 540 }, // 9h
      requireApproval: { type: Boolean, default: true },
    },

    activityCollectionPolicy: {
      collectAppMetadata: { type: Boolean, default: false },
      collectScreenshots: { type: Boolean, default: false }, // MVP: must remain false
    },

    devicePolicy: {
      maxDevicesPerUser: { type: Number, default: 2 },
    },

    notificationPolicy: {
      emailOnRequestStatusChange: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model('OrganizationPolicy', organizationPolicySchema);