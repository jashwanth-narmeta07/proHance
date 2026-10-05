import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const checkInSchema = {
  body: z.object({
    deviceId: objectId.optional(),
  }),
};

export const historySchema = {
  query: z.object({
    from: z.string().datetime().optional().or(z.string().date().optional()),
    to: z.string().datetime().optional().or(z.string().date().optional()),
  }),
};

export const teamAttendanceSchema = {
  query: z.object({
    date: z.string().optional(),
  }),
};
