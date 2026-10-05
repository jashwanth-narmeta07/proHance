import { z } from 'zod';

export const updateOrganizationSchema = {
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    industry: z.string().optional(),
    companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
    country: z.string().optional(),
    timezone: z.string().optional(),
    website: z.string().url().optional(),
    logoUrl: z.string().url().optional(),
    contactPhone: z.string().optional(),
  }),
};
