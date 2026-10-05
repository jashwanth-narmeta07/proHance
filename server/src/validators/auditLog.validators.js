import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const listAuditLogsSchema = {
  query: z.object({
    targetEntity: z.string().optional(),
    actorId: objectId.optional(),
    before: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
};
