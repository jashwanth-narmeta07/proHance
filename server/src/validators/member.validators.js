import { z } from 'zod';
import { ROLES } from '../config/permissions.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

// A member is invited into one of the organization-scoped roles - SUPER_ADMIN
// is platform-level and can never be granted through this flow.
const invitableRole = z.enum([ROLES.ORGANIZATION_ADMIN, ROLES.HR, ROLES.MANAGER, ROLES.EMPLOYEE]);

export const inviteMemberSchema = {
  body: z.object({
    email: z.string().email(),
    role: invitableRole,
    departmentId: objectId.optional(),
    teamId: objectId.optional(),
    managerId: objectId.optional(),
  }),
};

export const listInvitationsSchema = {
  query: z.object({
    status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']).optional(),
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

export const listMembersSchema = {
  query: z.object({
    departmentId: objectId.optional(),
    teamId: objectId.optional(),
    role: z.enum(Object.values(ROLES)).optional(),
    status: z.enum(['INVITED', 'ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'DEACTIVATED', 'EXITED']).optional(),
  }),
};

export const updateMemberSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      designation: z.string().optional(),
      workLocation: z.string().optional(),
      timezone: z.string().optional(),
      shift: z.string().optional(),
      role: invitableRole.optional(),
      departmentId: objectId.nullable().optional(),
      teamId: objectId.nullable().optional(),
      managerId: objectId.nullable().optional(),
      employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']).optional(),
      status: z.enum(['ACTIVE', 'ON_LEAVE', 'SUSPENDED']).optional(),
    })
    .refine((obj) => Object.keys(obj).length > 0, { message: 'At least one field is required' }),
};

export const idParamSchema = {
  params: z.object({ id: objectId }),
};
