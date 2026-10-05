import crypto from 'crypto';
import Organization from '../models/Organization.js';
import ActivityEvent from '../models/ActivityEvent.js';
import attendanceRepository, { startOfDay } from '../repositories/attendance.repository.js';
import workSessionRepository from '../repositories/workSession.repository.js';
import policyRepository from '../repositories/policy.repository.js';
import ApiError from '../utils/ApiError.js';
import logger from '../config/logger.js';
import { ROLES } from '../config/permissions.js';
import { emitToOrganization } from '../sockets/index.js';

/**
 * Compares "now" in the organization's configured timezone against the
 * policy's workStartTime + grace period to decide whether a check-in counts
 * as late. Falls back gracefully to UTC if the org's timezone string isn't
 * a valid IANA zone recognized by Intl.
 */
function isLateCheckIn(now, workStartTime, graceMinutes, timezone) {
  const [startHour, startMinute] = workStartTime.split(':').map(Number);
  let localHour;
  let localMinute;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    localHour = Number(parts.find((p) => p.type === 'hour').value);
    localMinute = Number(parts.find((p) => p.type === 'minute').value);
  } catch {
    localHour = now.getUTCHours();
    localMinute = now.getUTCMinutes();
  }
  const nowMinutes = localHour * 60 + localMinute;
  const cutoffMinutes = startHour * 60 + startMinute + graceMinutes;
  return nowMinutes > cutoffMinutes;
}

/**
 * Section 9/10/37.11: PC-on time is never work time. A WorkSession's
 * active/idle/break/meeting totals are always computed by aggregating this
 * session's ActivityEvents at close time, never by subtracting checkout
 * from checkin wall-clock time. With no desktop agent connected yet (Phase 7),
 * this aggregation correctly returns zeros rather than fabricating activity.
 */
async function aggregateSessionDurations(workSessionId, organizationId) {
  const idleWindows = await ActivityEvent.find({    workSessionId,
    organizationId,
    eventType: 'IDLE_JUSTIFIED',
  });

  let meetingDurationSeconds = 0;
  let unclassifiedIdleSeconds = 0;
  let idleDurationSeconds = 0;
  let breakDurationSeconds = 0;

  for (const evt of idleWindows) {
    const durationSeconds =
      evt.idleStartedAt && evt.idleEndedAt
        ? Math.max(0, (evt.idleEndedAt - evt.idleStartedAt) / 1000)
        : 0;
    idleDurationSeconds += durationSeconds;
    if (evt.idleReason === 'BREAK') breakDurationSeconds += durationSeconds;
    if (evt.idleReason === 'MEETING') meetingDurationSeconds += durationSeconds;
    if (!evt.justified) unclassifiedIdleSeconds += durationSeconds;
  }

  // Deliberately NOT also summing BREAK_STARTED/BREAK_ENDED events here -
  // endBreak() (see below) already adds each completed break straight onto
  // attendance.breakDurationSeconds the moment the employee ends it. Redoing
  // that sum here and adding it again at checkOut() would double-count
  // every explicit break. breakDurationSeconds above only covers idle
  // windows the employee retroactively classified as BREAK via the idle
  // justification popup - a genuinely separate source, never recorded
  // anywhere else.

  // Active time is derived from ACTIVITY_DETECTED heartbeats emitted by the
  // desktop agent (Phase 7/8: desktop-agent/src/main/main.js). The agent
  // throttles these to one recorded heartbeat per ACTIVE_HEARTBEAT_RECORD_INTERVAL_MS
  // (currently 60s) while the user is actively providing keyboard/mouse
  // input, so each persisted event represents that same fixed interval of
  // confirmed activity. This is still not wall-clock session time - a
  // session with no heartbeats (agent not running, or the whole session was
  // idle) correctly yields 0, per Section 37.11.
  const ACTIVE_HEARTBEAT_INTERVAL_SECONDS = 60;
  const activeHeartbeatCount = await ActivityEvent.countDocuments({
    workSessionId,
    organizationId,
    eventType: 'ACTIVITY_DETECTED',
  });
  const activeDurationSeconds = activeHeartbeatCount * ACTIVE_HEARTBEAT_INTERVAL_SECONDS;

  return {
    activeDurationSeconds,
    idleDurationSeconds: Math.round(idleDurationSeconds),
    breakDurationSeconds: Math.round(breakDurationSeconds),
    meetingDurationSeconds: Math.round(meetingDurationSeconds),
    unclassifiedIdleSeconds: Math.round(unclassifiedIdleSeconds),
  };
}

export async function checkIn(requestingUser, { deviceId } = {}) {
  const { organizationId } = requestingUser;

  const existingOpenSession = await workSessionRepository.findOpenForUser(requestingUser.id, organizationId);
  if (existingOpenSession) {
    throw ApiError.conflict('You are already checked in', 'ALREADY_CHECKED_IN');
  }

  const policy = await policyRepository.getOrCreate(organizationId);
  const org = await Organization.findById(organizationId);
  const now = new Date();

  const workSession = await workSessionRepository.model.create({
    organizationId,
    userId: requestingUser.id,
    deviceId: deviceId || null,
    checkInAt: now,
    status: 'ACTIVE',
  });

  // Attendance is one record per user per calendar day (unique index on
  // organizationId+userId+date). If one already exists for today, this is
  // a second (or later) check-in cycle - e.g. stepping out for an
  // appointment and coming back - so reopen the same day's record and
  // attach the new session, rather than trying to insert a second
  // Attendance doc for today (which would just hit that unique index).
  const existingToday = await attendanceRepository.findByUserAndDate(requestingUser.id, organizationId, now);

  let attendance;
  if (existingToday) {
    existingToday.checkOutAt = null;
    existingToday.workSessionId = workSession._id;
    existingToday.workSessionIds = [...(existingToday.workSessionIds || []), workSession._id];
    // Deliberately not re-running isLateCheckIn or touching status/flags here -
    // "late" is a property of the day's first check-in only, not of every
    // time someone steps back in.
    attendance = await existingToday.save();
  } else {
    const late = isLateCheckIn(
      now,
      policy.attendancePolicy.workStartTime,
      policy.attendancePolicy.graceMinutes,
      org?.timezone || 'UTC'
    );

    attendance = await attendanceRepository.model.create({
      organizationId,
      userId: requestingUser.id,
      workSessionId: workSession._id,
      workSessionIds: [workSession._id],
      date: startOfDay(now),
      checkInAt: now,
      status: late ? 'LATE' : 'PRESENT',
      flags: late ? ['LATE_ARRIVAL'] : [],
    });
  }

  await ActivityEvent.create({
    organizationId,
    userId: requestingUser.id,
    deviceId: deviceId || null,
    workSessionId: workSession._id,
    clientEventId: crypto.randomUUID(),
    eventType: 'SESSION_STARTED',
    timestamp: now,
    source: deviceId ? 'DESKTOP_AGENT' : 'WEB',
  });

  emitToOrganization(organizationId, 'member:online', { userId: requestingUser.id });

  return { attendance, workSession };
}

export async function checkOut(requestingUser) {
  const { organizationId } = requestingUser;

  const workSession = await workSessionRepository.findOpenForUser(requestingUser.id, organizationId);
  const attendance = workSession
    ? await attendanceRepository.findByUserAndDate(requestingUser.id, organizationId, workSession.checkInAt)
    : null;
  if (!attendance || !workSession) throw ApiError.badRequest('You are not currently checked in', 'NOT_CHECKED_IN');

  const now = new Date();
  const durations = workSession
    ? await aggregateSessionDurations(workSession._id, organizationId)
    : {
        activeDurationSeconds: 0,
        idleDurationSeconds: 0,
        breakDurationSeconds: 0,
        meetingDurationSeconds: 0,
        unclassifiedIdleSeconds: 0,
      };

  if (workSession) {
    workSession.checkOutAt = now;
    workSession.status = 'CLOSED';
    Object.assign(workSession, durations);
    await workSession.save();
  }

  const policy = await policyRepository.getOrCreate(organizationId);
  // This session's own duration - never (now - attendance.checkInAt), which
  // is the day's *first* check-in and would silently fold in the gap
  // between sessions (e.g. time away for an appointment) as if it were
  // time at work.
  const thisSessionDurationSeconds = workSession ? Math.max(0, (now - workSession.checkInAt) / 1000) : 0;
  const overtimeThresholdSeconds = policy.overtimePolicy.overtimeAfterMinutesPerDay * 60;

  attendance.checkOutAt = now;
  // Accumulate across every session today, not overwrite - a day can now
  // span more than one check-in/check-out cycle.
  attendance.breakDurationSeconds = (attendance.breakDurationSeconds || 0) + durations.breakDurationSeconds;
  attendance.totalDurationSeconds = Math.round((attendance.totalDurationSeconds || 0) + thisSessionDurationSeconds);
  if (attendance.totalDurationSeconds > overtimeThresholdSeconds && !attendance.flags.includes('OVERTIME')) {
    attendance.flags.push('OVERTIME');
  }
  await attendance.save();

  if (workSession) {
    await ActivityEvent.create({
      organizationId,
      userId: requestingUser.id,
      deviceId: workSession.deviceId,
      workSessionId: workSession._id,
      clientEventId: crypto.randomUUID(),
      eventType: 'SESSION_ENDED',
      timestamp: now,
      source: 'WEB',
    });
  }

  emitToOrganization(organizationId, 'member:offline', { userId: requestingUser.id });

  return { attendance, workSession };
}

/**
 * Breaks are explicitly declared by the employee (not inferred from
 * inactivity), so they never require idle justification - see Section 13/14.
 */
export async function startBreak(requestingUser) {
  const { organizationId } = requestingUser;
  const attendance = await attendanceRepository.findOpenForUser(requestingUser.id, organizationId);
  if (!attendance) throw ApiError.badRequest('You must be checked in to start a break', 'NOT_CHECKED_IN');

  const openBreak = await ActivityEvent.findOne({
    organizationId,
    userId: requestingUser.id,
    workSessionId: attendance.workSessionId,
    eventType: 'BREAK_STARTED',
  }).sort({ timestamp: -1 });
  const closedAfter = openBreak
    ? await ActivityEvent.findOne({
        organizationId,
        userId: requestingUser.id,
        workSessionId: attendance.workSessionId,
        eventType: 'BREAK_ENDED',
        timestamp: { $gt: openBreak.timestamp },
      })
    : true;
  if (openBreak && !closedAfter) {
    throw ApiError.conflict('A break is already in progress', 'BREAK_IN_PROGRESS');
  }

  return ActivityEvent.create({
    organizationId,
    userId: requestingUser.id,
    workSessionId: attendance.workSessionId,
    clientEventId: crypto.randomUUID(),
    eventType: 'BREAK_STARTED',
    timestamp: new Date(),
    source: 'WEB',
  });
}

export async function endBreak(requestingUser) {
  const { organizationId } = requestingUser;
  const attendance = await attendanceRepository.findOpenForUser(requestingUser.id, organizationId);
  if (!attendance) throw ApiError.badRequest('You must be checked in to end a break', 'NOT_CHECKED_IN');

  const openBreak = await ActivityEvent.findOne({
    organizationId,
    userId: requestingUser.id,
    workSessionId: attendance.workSessionId,
    eventType: 'BREAK_STARTED',
  }).sort({ timestamp: -1 });
  if (!openBreak) throw ApiError.badRequest('No break is currently in progress', 'NO_BREAK_IN_PROGRESS');

  const event = await ActivityEvent.create({
    organizationId,
    userId: requestingUser.id,
    workSessionId: attendance.workSessionId,
    clientEventId: crypto.randomUUID(),
    eventType: 'BREAK_ENDED',
    timestamp: new Date(),
    source: 'WEB',
  });

  const breakSeconds = Math.max(0, (event.timestamp - openBreak.timestamp) / 1000);
  attendance.breakDurationSeconds += Math.round(breakSeconds);
  await attendance.save();

  return event;
}

export async function getToday(requestingUser) {
  const { organizationId } = requestingUser;
  let attendance = await attendanceRepository.findByUserAndDate(requestingUser.id, organizationId, new Date());
  let workSession = await workSessionRepository.findOpenForUser(requestingUser.id, organizationId);

  if (workSession) {
    attendance =
      (await attendanceRepository.findByUserAndDate(requestingUser.id, organizationId, workSession.checkInAt)) ||
      attendance;
  }

  let onBreak = false;
  if (attendance) {
    if (!workSession && attendance.workSessionId) {
      workSession = await workSessionRepository.model.findById(attendance.workSessionId);
      if (!workSession || workSession.status !== 'ACTIVE') workSession = null;
    }

    const started = await ActivityEvent.findOne({
      organizationId,
      userId: requestingUser.id,
      workSessionId: attendance.workSessionId,
      eventType: 'BREAK_STARTED',
    }).sort({ timestamp: -1 });
    if (started) {
      const ended = await ActivityEvent.findOne({
        organizationId,
        userId: requestingUser.id,
        workSessionId: attendance.workSessionId,
        eventType: 'BREAK_ENDED',
        timestamp: { $gt: started.timestamp },
      });
      onBreak = !ended;
    }
  }

  return { attendance, workSession, onBreak };
}

export async function getMyHistory(requestingUser, filters) {
  return attendanceRepository.findHistory(requestingUser.id, requestingUser.organizationId, filters);
}

const ORG_LEVEL_ROLES = [ROLES.ORGANIZATION_ADMIN, ROLES.HR];

/**
 * Attendance visibility follows the same organization-structure rule used
 * everywhere else: a MANAGER sees only their direct reports.
 */
export async function getTeamAttendance(requestingUser, date) {
  const { organizationId } = requestingUser;
  const { default: User } = await import('../models/User.js');

  const userFilter = { organizationId };
  if (requestingUser.role === ROLES.MANAGER) {
    userFilter.managerId = requestingUser.id;
  } else if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view team attendance');
  }

  const teamMembers = await User.find(userFilter).select('_id firstName lastName email');
  const userIds = teamMembers.map((m) => m._id);
  const records = await attendanceRepository.findForUsersOnDate(userIds, organizationId, date || new Date());

  const recordsByUser = new Map(records.map((r) => [r.userId.toString(), r]));

  return teamMembers.map((m) => ({
    user: { id: m._id, firstName: m.firstName, lastName: m.lastName, email: m.email },
    attendance: recordsByUser.get(m._id.toString()) || null,
  }));
}