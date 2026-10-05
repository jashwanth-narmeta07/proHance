import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createTeamSchema = {
  body: z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    departmentId: objectId,
    managerId: objectId.optional(),
  }),
};

export const updateTeamSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    managerId: objectId.nullable().optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  }),
};

export const idParamSchema = {
  params: z.object({ id: objectId }),
};
