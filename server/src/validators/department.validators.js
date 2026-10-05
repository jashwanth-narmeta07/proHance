import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createDepartmentSchema = {
  body: z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
  }),
};

export const updateDepartmentSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
  }),
};

export const idParamSchema = {
  params: z.object({ id: objectId }),
};
