import { z } from 'zod';

export const updatePolicySchema = {
  body: z.object({
    idlePolicy: z
      .object({
        warningThresholdMinutes: z.number().int().min(1).max(120).optional(),
        justificationThresholdMinutes: z.number().int().min(1).max(240).optional(),
        requireJustification: z.boolean().optional(),
        allowedReasons: z.array(z.string()).optional(),
      })
      .optional(),
    attendancePolicy: z
      .object({
        automaticCheckIn: z.boolean().optional(),
        graceMinutes: z.number().int().min(0).max(120).optional(),
        workStartTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm')
          .optional(),
        workEndTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm')
          .optional(),
        workDays: z.array(z.number().int().min(0).max(6)).optional(),
      })
      .optional(),
    breakPolicy: z
      .object({
        maxBreakMinutesPerDay: z.number().int().min(0).max(480).optional(),
      })
      .optional(),
    overtimePolicy: z
      .object({
        overtimeAfterMinutesPerDay: z.number().int().min(0).max(1440).optional(),
        requireApproval: z.boolean().optional(),
      })
      .optional(),
    activityCollectionPolicy: z
      .object({
        collectAppMetadata: z.boolean().optional(),
        // collectScreenshots intentionally omitted from the schema - Section
        // 12/38 requires this to stay off in the MVP regardless of what a
        // client sends; there is no supported way to enable it via this API.
      })
      .optional(),
    devicePolicy: z
      .object({
        maxDevicesPerUser: z.number().int().min(1).max(10).optional(),
      })
      .optional(),
    notificationPolicy: z
      .object({
        emailOnRequestStatusChange: z.boolean().optional(),
      })
      .optional(),
  }),
};
