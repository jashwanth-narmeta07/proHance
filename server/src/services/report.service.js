import Attendance from '../models/Attendance.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';

const ORG_LEVEL_ROLES = [ROLES.ORGANIZATION_ADMIN, ROLES.HR];

function toCsvValue(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const body = rows
    .map((row) => columns.map((c) => toCsvValue(c.value(row))).join(','))
    .join('\n');
  return `${header}\n${body}`;
}

/**
 * Section 21: attendance report, scoped exactly like team attendance - a
 * MANAGER only ever gets their own reports in the export, never the whole org.
 */
export async function generateAttendanceReport(requestingUser, filters) {
  const { organizationId } = requestingUser;
  const userFilter = { organizationId };

  if (filters.employeeId) {
    userFilter._id = filters.employeeId;
  }
  if (filters.departmentId) userFilter.departmentId = filters.departmentId;
  if (filters.teamId) userFilter.teamId = filters.teamId;

  if (requestingUser.role === ROLES.MANAGER) {
    userFilter.managerId = requestingUser.id;
  } else if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to export attendance reports');
  }

  const users = await User.find(userFilter).select('_id firstName lastName email');
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const attendanceFilter = { organizationId, userId: { $in: users.map((u) => u._id) } };
  if (filters.from || filters.to) {
    attendanceFilter.date = {};
    if (filters.from) attendanceFilter.date.$gte = new Date(filters.from);
    if (filters.to) attendanceFilter.date.$lte = new Date(filters.to);
  }

  const records = await Attendance.find(attendanceFilter).sort({ date: -1 });

  const rows = records.map((r) => ({ ...r.toObject(), user: userMap.get(r.userId.toString()) }));

  const columns = [
    { label: 'Employee', value: (r) => `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.trim() },
    { label: 'Email', value: (r) => r.user?.email || '' },
    { label: 'Date', value: (r) => new Date(r.date).toISOString().slice(0, 10) },
    { label: 'Check-in', value: (r) => new Date(r.checkInAt).toISOString() },
    { label: 'Check-out', value: (r) => (r.checkOutAt ? new Date(r.checkOutAt).toISOString() : '') },
    { label: 'Total duration (seconds)', value: (r) => r.totalDurationSeconds },
    { label: 'Break duration (seconds)', value: (r) => r.breakDurationSeconds },
    { label: 'Status', value: (r) => r.status },
    { label: 'Flags', value: (r) => (r.flags || []).join(';') },
  ];

  return toCsv(rows, columns);
}
