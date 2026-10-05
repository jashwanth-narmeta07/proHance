import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const registerDeviceSchema = {
  body: z.object({
    deviceName: z.string().min(1).max(150),
    os: z.string().max(50).optional(),
    osVersion: z.string().max(50).optional(),
    agentVersion: z.string().max(50).optional(),
  }),
};

export const registerForEmployeeSchema = {
  params: z.object({ userId: objectId }),
  body: z.object({
    deviceName: z.string().min(1).max(150),
    os: z.string().max(50).optional(),
    osVersion: z.string().max(50).optional(),
    agentVersion: z.string().max(50).optional(),
  }),
};

export const idParamSchema = {
  params: z.object({ id: objectId }),
};