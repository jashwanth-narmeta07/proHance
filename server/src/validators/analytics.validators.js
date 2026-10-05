import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const isoDate = z.string().optional();

export const dateRangeSchema = {
  query: z.object({
    from: isoDate,
    to: isoDate,
  }),
};

export const attendanceReportSchema = {
  query: z.object({
    from: isoDate,
    to: isoDate,
    employeeId: objectId.optional(),
    departmentId: objectId.optional(),
    teamId: objectId.optional(),
  }),
};

/**
 * The "By employee" table on Reports - same date range as everything else,
 * plus optional department/team narrowing. Both are applied server-side to
 * the User query rather than filtered in the browser, so the expensive
 * per-employee summarize pass only runs for the rows actually being shown.
 */
export const employeeBreakdownSchema = {
  query: z.object({
    from: isoDate,
    to: isoDate,
    departmentId: objectId.optional(),
    teamId: objectId.optional(),
  }),
};

export const employeeOverviewSchema = {
  params: z.object({ userId: objectId }),
  query: z.object({
    from: isoDate,
    to: isoDate,
  }),
};

export const employeeTopAppsSchema = {
  params: z.object({ userId: objectId }),
  query: z.object({
    from: isoDate,
    to: isoDate,
  }),
};