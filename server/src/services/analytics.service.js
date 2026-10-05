import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import WorkSession from '../models/WorkSession.js';
import ActivityEvent from '../models/ActivityEvent.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Team from '../models/Team.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';
import { startOfDay } from '../repositories/attendance.repository.js';
import policyRepository from '../repositories/policy.repository.js';

/**
 * A bare `YYYY-MM-DD` parses as midnight, so using it directly as an upper
 * bound silently excludes the whole of the end day - picking from=today,
 * to=today would return nothing at all. Both range helpers below push `to`
 * to the last instant of that day unless the caller passed a full timestamp.
 */
function rangeStart(from) {
  return from ? new Date(from) : null;
}

function rangeEnd(to) {
  if (!to) return null;
  const d = new Date(to);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setHours(23, 59, 59, 999);
  return d;
}

function dateRangeFilter(from, to) {
  const start = rangeStart(from);
  const end = rangeEnd(to);
  const filter = {};
  if (start || end) {
    filter.date = {};
    if (start) filter.date.$gte = start;
    if (end) filter.date.$lte = end;
  }
  return filter;
}

const ORG_LEVEL_ROLES = [ROLES.ORGANIZATION_ADMIN, ROLES.HR];

/**
 * Section 20: never label this "productivity" - these are neutral, factual
 * durations. The UI layer is responsible for the exact wording (Computer
 * Active Time, Classified Work Time, etc); this just returns the numbers.
 */
async function summarizeForUsers(userIds, organizationId, { from, to } = {}) {
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const userObjectIds = userIds.map((id) => new mongoose.Types.ObjectId(id));

  const policy = await policyRepository.getOrCreate(organizationId);
  const fullDayThresholdSeconds = (policy.attendancePolicy?.fullDayMinimumMinutes ?? 420) * 60;

  const attendanceMatch = {
    organizationId: orgObjectId,
    userId: { $in: userObjectIds },
    ...dateRangeFilter(from, to),
  };

  const [attendanceAgg] = await Attendance.aggregate([
    { $match: attendanceMatch },
    {
      $group: {
        _id: null,
        // A day only counts as a full attendance day once its total
        // checked-in duration reaches the org's fullDayMinimumMinutes
        // (default 7h) - a brief check-in/check-out no longer counts as 1.
        totalDays: {
          $sum: { $cond: [{ $gte: ['$totalDurationSeconds', fullDayThresholdSeconds] }, 1, 0] },
        },
        recordedDays: { $sum: 1 },
        totalDurationSeconds: { $sum: '$totalDurationSeconds' },
        breakDurationSeconds: { $sum: '$breakDurationSeconds' },
        lateCount: { $sum: { $cond: [{ $in: ['LATE_ARRIVAL', '$flags'] }, 1, 0] } },
        overtimeCount: { $sum: { $cond: [{ $in: ['OVERTIME', '$flags'] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] } },
      },
    },
  ]);

  const sessionMatch = {
    organizationId: orgObjectId,
    userId: { $in: userObjectIds },
    status: 'CLOSED',
    ...(from || to
      ? {
          checkInAt: {
            ...(from ? { $gte: rangeStart(from) } : {}),
            ...(to ? { $lte: rangeEnd(to) } : {}),
          },
        }
      : {}),
  };

  const [sessionAgg] = await WorkSession.aggregate([
    { $match: sessionMatch },
    {
      $group: {
        _id: null,
        computerActiveTimeSeconds: { $sum: '$activeDurationSeconds' },
        classifiedIdleTimeSeconds: { $sum: '$idleDurationSeconds' },
        meetingTimeSeconds: { $sum: '$meetingDurationSeconds' },
        unclassifiedIdleTimeSeconds: { $sum: '$unclassifiedIdleSeconds' },
        sessionCount: { $sum: 1 },
      },
    },
  ]);

  return {
    attendanceDays: attendanceAgg?.totalDays || 0,
    recordedDays: attendanceAgg?.recordedDays || 0,
    totalDurationSeconds: attendanceAgg?.totalDurationSeconds || 0,
    breakTimeSeconds: attendanceAgg?.breakDurationSeconds || 0,
    lateArrivalCount: attendanceAgg?.lateCount || 0,
    overtimeCount: attendanceAgg?.overtimeCount || 0,
    absentCount: attendanceAgg?.absentCount || 0,
    computerActiveTimeSeconds: sessionAgg?.computerActiveTimeSeconds || 0,
    classifiedIdleTimeSeconds: sessionAgg?.classifiedIdleTimeSeconds || 0,
    meetingTimeSeconds: sessionAgg?.meetingTimeSeconds || 0,
    unclassifiedIdleTimeSeconds: sessionAgg?.unclassifiedIdleTimeSeconds || 0,
    sessionCount: sessionAgg?.sessionCount || 0,
  };
}

/**
 * Top apps by time spent - built entirely from APP_USAGE events, which the
 * agent only ever emits when collectAppMetadata is on for the org (see
 * appTracker.js). App name only, never a window title - matches the same
 * privacy boundary the agent enforces at collection time.
 */
async function getTopAppsForUsers(userIds, organizationId, { from, to } = {}, limit = 10) {
  const match = {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
    eventType: 'APP_USAGE',
    ...(from || to
      ? {
          timestamp: {
            ...(from ? { $gte: new Date(from) } : {}),
            ...(to ? { $lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const rows = await ActivityEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$metadata.appName',
        durationSeconds: { $sum: '$metadata.durationSeconds' },
      },
    },
    { $sort: { durationSeconds: -1 } },
    { $limit: limit },
  ]);

  return rows.map((r) => ({ appName: r._id, durationSeconds: r.durationSeconds }));
}

export async function getMyTopApps(requestingUser, filters) {
  return getTopAppsForUsers([requestingUser.id], requestingUser.organizationId, filters);
}

export async function getTeamTopApps(requestingUser, filters) {
  const { organizationId } = requestingUser;
  const userFilter = { organizationId };
  if (requestingUser.role === ROLES.MANAGER) {
    userFilter.managerId = requestingUser.id;
  } else if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view team analytics');
  }
  const members = await User.find(userFilter).select('_id');
  if (members.length === 0) return [];
  return getTopAppsForUsers(
    members.map((m) => m._id),
    organizationId,
    filters
  );
}

export async function getOrganizationTopApps(requestingUser, filters) {
  if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view organization analytics');
  }
  const { organizationId } = requestingUser;
  const users = await User.find({ organizationId, status: { $ne: 'EXITED' } }).select('_id');
  return getTopAppsForUsers(
    users.map((u) => u._id),
    organizationId,
    filters
  );
}

/**
 * A single named employee's app history - Admin/HR only, same gate as the
 * per-employee time-breakdown table on the org Reports page. Deliberately
 * not exposed to MANAGER here; if per-report app history for managers is
 * wanted later, add a role branch the same way getTeamSummary does.
 */
export async function getEmployeeTopApps(requestingUser, targetUserId, filters) {
  if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view this employee\'s activity');
  }
  const { organizationId } = requestingUser;
  const targetUser = await User.findOne({ _id: targetUserId, organizationId }).select('_id');
  if (!targetUser) throw ApiError.notFound('Employee not found');
  return getTopAppsForUsers([targetUser._id], organizationId, filters);
}

/**
 * One employee's full overview - the same SummaryCards shape (Active,
 * Meeting, Break, Unclassified Idle, Attendance days, Late arrivals,
 * Overtime days, Absences) used elsewhere on Reports, but for exactly one
 * person. HR/Admin can open this for anyone in the org; a MANAGER only for
 * someone who reports directly to them - mirrors the scoping getTeamSummary
 * already applies, just for a single named user instead of the whole team.
 * Passing from=to=<date> gives the "day overview" a selected date drills
 * into; omitting them gives the same range the caller's table is using.
 */
export async function getEmployeeOverview(requestingUser, targetUserId, filters) {
  const { organizationId } = requestingUser;

  const targetUser = await User.findOne({ _id: targetUserId, organizationId }).select(
    'firstName lastName email role departmentId teamId managerId'
  );
  if (!targetUser) throw ApiError.notFound('Employee not found');

  const isOwnTeamMember =
    requestingUser.role === ROLES.MANAGER &&
    targetUser.managerId &&
    targetUser.managerId.toString() === requestingUser.id;

  if (!ORG_LEVEL_ROLES.includes(requestingUser.role) && !isOwnTeamMember) {
    throw ApiError.forbidden('You do not have permission to view this employee\'s overview');
  }

  const [departments, teams] = await Promise.all([
    Department.find({ organizationId }).select('_id name'),
    Team.find({ organizationId }).select('_id name'),
  ]);
  const departmentMap = new Map(departments.map((d) => [d._id.toString(), d.name]));
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t.name]));

  return {
    user: {
      id: targetUser._id,
      firstName: targetUser.firstName,
      lastName: targetUser.lastName,
      email: targetUser.email,
      role: targetUser.role,
      departmentName: targetUser.departmentId ? departmentMap.get(targetUser.departmentId.toString()) || null : null,
      teamName: targetUser.teamId ? teamMap.get(targetUser.teamId.toString()) || null : null,
    },
    summary: await summarizeForUsers([targetUser._id], organizationId, filters),
  };
}

export async function getMySummary(requestingUser, filters) {
  return summarizeForUsers([requestingUser.id], requestingUser.organizationId, filters);
}

/**
 * Utilization / Efficiency are derived, not stored - defined here in one
 * place so every trend endpoint computes them identically.
 *
 * Utilization % = Computer Active Time / Logged (checked-in) Time
 *   "Of the time you were checked in, how much showed active computer use."
 * Efficiency % = Computer Active Time / (Active + Unclassified Idle Time)
 *   "Of tracked active-or-unexplained-idle time, how much was active."
 *   Meeting and Break time are deliberately excluded from this denominator -
 *   they're already-justified time, not something that should count against
 *   an efficiency figure the way unexplained idle does.
 *
 * These are this product's own definitions, not an industry-standard or
 * audited formula - Section 20's "never call it productivity" rule still
 * applies, so the UI layer must keep these framed as neutral ratios.
 */
function computeDerivedMetrics(summary) {
  const logged = summary.totalDurationSeconds || 0;
  const active = summary.computerActiveTimeSeconds || 0;
  const idle = summary.unclassifiedIdleTimeSeconds || 0;
  return {
    utilizationPercent: logged > 0 ? Math.round((active / logged) * 10000) / 100 : 0,
    efficiencyPercent: active + idle > 0 ? Math.round((active / (active + idle)) * 10000) / 100 : 0,
  };
}

function averagePerDay(summary) {
  const days = summary.attendanceDays || 0;
  const perDay = (seconds) => (days > 0 ? Math.round(seconds / days) : 0);
  return {
    avgLoggedSeconds: perDay(summary.totalDurationSeconds),
    avgActiveSeconds: perDay(summary.computerActiveTimeSeconds),
    avgIdleSeconds: perDay(summary.unclassifiedIdleTimeSeconds),
  };
}

function percentChange(current, baseline) {
  if (!baseline) return null; // no baseline data yet - nothing meaningful to compare against
  return Math.round(((current - baseline) / baseline) * 10000) / 100;
}

async function getTrendForUsers(userIds, organizationId) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayEnd = new Date(todayStart.getTime() - 1);
  const last7Start = startOfDay(new Date(todayStart.getTime() - 7 * 86400000));
  const last15Start = startOfDay(new Date(todayStart.getTime() - 15 * 86400000));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  const [todaySummary, last7Summary, last15Summary, mtdSummary] = await Promise.all([
    summarizeForUsers(userIds, organizationId, { from: todayStart, to: now }),
    summarizeForUsers(userIds, organizationId, { from: last7Start, to: yesterdayEnd }),
    summarizeForUsers(userIds, organizationId, { from: last15Start, to: yesterdayEnd }),
    summarizeForUsers(userIds, organizationId, { from: monthStart, to: yesterdayEnd }),
  ]);

  const today = {
    ...computeDerivedMetrics(todaySummary),
    loggedSeconds: todaySummary.totalDurationSeconds,
    activeSeconds: todaySummary.computerActiveTimeSeconds,
    idleSeconds: todaySummary.unclassifiedIdleTimeSeconds,
  };

  function buildComparison(key, label, summary) {
    const derived = computeDerivedMetrics(summary);
    const avg = averagePerDay(summary);
    return {
      key,
      label,
      ...derived,
      ...avg,
      change: {
        utilizationPercent: percentChange(today.utilizationPercent, derived.utilizationPercent),
        efficiencyPercent: percentChange(today.efficiencyPercent, derived.efficiencyPercent),
        loggedSeconds: percentChange(today.loggedSeconds, avg.avgLoggedSeconds),
        activeSeconds: percentChange(today.activeSeconds, avg.avgActiveSeconds),
        idleSeconds: percentChange(today.idleSeconds, avg.avgIdleSeconds),
      },
    };
  }

  return {
    today,
    comparisons: [
      buildComparison('last7Days', 'Last 7 Days', last7Summary),
      buildComparison('last15Days', 'Last 15 Days', last15Summary),
      buildComparison('monthToDate', 'Month to Date', mtdSummary),
    ],
  };
}

export async function getMyTrend(requestingUser) {
  return getTrendForUsers([requestingUser.id], requestingUser.organizationId);
}

export async function getTeamTrend(requestingUser) {
  const { organizationId } = requestingUser;
  const userFilter = { organizationId };
  if (requestingUser.role === ROLES.MANAGER) {
    userFilter.managerId = requestingUser.id;
  } else if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view team analytics');
  }
  const members = await User.find(userFilter).select('_id');
  if (members.length === 0) {
    return {
      today: { utilizationPercent: 0, efficiencyPercent: 0, loggedSeconds: 0, activeSeconds: 0, idleSeconds: 0 },
      comparisons: [],
    };
  }
  return getTrendForUsers(
    members.map((m) => m._id),
    organizationId
  );
}

export async function getOrganizationTrend(requestingUser) {
  if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view organization analytics');
  }
  const { organizationId } = requestingUser;
  const users = await User.find({ organizationId, status: { $ne: 'EXITED' } }).select('_id');
  return getTrendForUsers(
    users.map((u) => u._id),
    organizationId
  );
}

export async function getTeamSummary(requestingUser, filters) {
  const { organizationId } = requestingUser;
  const userFilter = { organizationId };
  if (requestingUser.role === ROLES.MANAGER) {
    userFilter.managerId = requestingUser.id;
  } else if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view team analytics');
  }

  const members = await User.find(userFilter).select('_id firstName lastName email');
  if (members.length === 0) return { members: [] };

  const results = await Promise.all(
    members.map(async (m) => ({
      user: { id: m._id, firstName: m.firstName, lastName: m.lastName, email: m.email },
      summary: await summarizeForUsers([m._id], organizationId, filters),
    }))
  );

  return { members: results };
}

export async function getOrganizationEmployeeBreakdown(requestingUser, filters) {
  if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view organization analytics');
  }
  const { organizationId } = requestingUser;

  // departmentId/teamId narrow the row set *before* the per-employee
  // summarize pass below, which is one aggregation pair per employee - the
  // whole reason this table is loaded on demand. Filtering in the browser
  // instead would mean paying that cost for the entire org to then throw
  // most of it away.
  const userFilter = { organizationId, status: { $ne: 'EXITED' } };
  if (filters?.departmentId) userFilter.departmentId = filters.departmentId;
  if (filters?.teamId) userFilter.teamId = filters.teamId;

  const users = await User.find(userFilter).select('firstName lastName email role departmentId teamId');
  if (users.length === 0) return { employees: [] };

  const [departments, teams] = await Promise.all([
    Department.find({ organizationId }).select('_id name'),
    Team.find({ organizationId }).select('_id name'),
  ]);
  const departmentMap = new Map(departments.map((d) => [d._id.toString(), d.name]));
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t.name]));

  const employees = await Promise.all(
    users.map(async (u) => ({
      user: {
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        departmentId: u.departmentId || null,
        departmentName: u.departmentId ? departmentMap.get(u.departmentId.toString()) || null : null,
        teamId: u.teamId || null,
        teamName: u.teamId ? teamMap.get(u.teamId.toString()) || null : null,
      },
      summary: await summarizeForUsers([u._id], organizationId, filters),
    }))
  );

  return { employees };
}

export async function getOrganizationSummary(requestingUser, filters) {
  if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view organization analytics');
  }
  const { organizationId } = requestingUser;
  const users = await User.find({ organizationId, status: { $ne: 'EXITED' } }).select('_id teamId');
  const summary = await summarizeForUsers(
    users.map((u) => u._id),
    organizationId,
    filters
  );

  // Section 20/graph request: a single org-wide total tells HR/Admin nothing
  // about where the time actually goes, and charting every individual
  // employee doesn't scale past a handful of people - team is the natural
  // rollup grain for an organization-wide chart (finer-grained than
  // department, and it's the unit a MANAGER actually owns).
  const teams = await Team.find({ organizationId }).select('_id name');
  const teamMap = new Map(teams.map((t) => [t._id.toString(), t.name]));

  const usersByTeam = new Map();
  for (const u of users) {
    const key = u.teamId ? u.teamId.toString() : 'unassigned';
    if (!usersByTeam.has(key)) usersByTeam.set(key, []);
    usersByTeam.get(key).push(u._id);
  }

  const teamBreakdown = await Promise.all(
    Array.from(usersByTeam.entries()).map(async ([key, userIds]) => ({
      teamId: key === 'unassigned' ? null : key,
      teamName: key === 'unassigned' ? 'No team' : teamMap.get(key) || 'Unknown team',
      headcount: userIds.length,
      summary: await summarizeForUsers(userIds, organizationId, filters),
    }))
  );

  return { headcount: users.length, summary, teamBreakdown };
}