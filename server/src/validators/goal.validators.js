import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createGoalSchema = {
  body: z.object({
    name: z.string().min(2).max(100),
    metric: z.enum(['LOGGED_HOURS', 'ACTIVE_HOURS']),
    comparator: z.enum(['GTE', 'LTE']).optional(),
    thresholdHours: z.number().min(0).max(24),
  }),
};

export const updateGoalSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    metric: z.enum(['LOGGED_HOURS', 'ACTIVE_HOURS']).optional(),
    comparator: z.enum(['GTE', 'LTE']).optional(),
    thresholdHours: z.number().min(0).max(24).optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  }),
};

export const idParamSchema = {
  params: z.object({ id: objectId }),
};

export const progressQuerySchema = {
  query: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
};
