import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const REQUEST_TYPES = [
  'LEAVE',
  'ATTENDANCE_CORRECTION',
  'WORK_FROM_HOME',
  'OVERTIME',
  'SHIFT_CHANGE',
  'IDLE_TIME_JUSTIFICATION',
  'PROFILE_CHANGE',
  'GENERAL',
];

export const createRequestSchema = {
  body: z.object({
    type: z.enum(REQUEST_TYPES),
    title: z.string().min(2).max(150),
    description: z.string().max(2000).optional(),
    payload: z.record(z.any()).optional(),
    attachments: z.array(z.string()).optional(),
  }),
};

export const listForReviewSchema = {
  query: z.object({
    status: z.enum(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
  }),
};

export const decisionSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    comment: z.string().max(1000).optional(),
  }),
};

export const idParamSchema = {
  params: z.object({ id: objectId }),
};
