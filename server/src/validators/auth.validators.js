import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const loginSchema = {
  body: z.object({
    organizationSlug: z.string().min(1, 'Organization is required'),
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

export const refreshSchema = {
  body: z.object({
    refreshToken: z.string().min(1),
  }),
};

export const registerOrganizationSchema = {
  body: z.object({
    organization: z.object({
      name: z.string().min(2).max(120),
      companyEmail: z.string().email(),
      industry: z.string().optional(),
      companySize: z.enum(['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+']).optional(),
      country: z.string().optional(),
      timezone: z.string().optional(),
      website: z.string().url().optional().or(z.literal('')),
      slug: z
        .string()
        .min(2)
        .max(60)
        .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
    }),
    admin: z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      password,
    }),
  }),
};

export const acceptInvitationSchema = {
  body: z.object({
    token: z.string().min(1),
    password,
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
};
