import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createProjectSchema = {
  body: z.object({
    name: z.string().min(2).max(150),
    description: z.string().max(1000).optional(),
    projectManagerId: objectId.optional(),
    members: z.array(objectId).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
};

export const updateProjectSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().min(2).max(150).optional(),
      description: z.string().max(1000).optional(),
      projectManagerId: objectId.optional(),
      members: z.array(objectId).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.enum(['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' }),
};

export const idParamSchema = {
  params: z.object({ id: objectId }),
};

export const projectIdParamSchema = {
  params: z.object({ projectId: objectId }),
};

export const createTaskSchema = {
  params: z.object({ projectId: objectId }),
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    assigneeId: objectId.optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    dueDate: z.string().optional(),
  }),
};

export const updateTaskSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      assigneeId: objectId.nullable().optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED']).optional(),
      dueDate: z.string().nullable().optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' }),
};
