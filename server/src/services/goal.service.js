import mongoose from 'mongoose';
import Goal from '../models/Goal.js';
import Attendance from '../models/Attendance.js';
import WorkSession from '../models/WorkSession.js';
import goalRepository from '../repositories/goal.repository.js';
import { startOfDay } from '../repositories/attendance.repository.js';
import ApiError from '../utils/ApiError.js';

// --- CRUD (org-scoped, admin/HR only - see routes/goal.routes.js) -------

export async function listGoals(organizationId) {
  return goalRepository.findInOrg({}, organizationId, { sort: { name: 1 } });
}

export async function createGoal(organizationId, data) {
  const exists = await goalRepository.nameExistsInOrg(data.name, organizationId);
  if (exists) throw ApiError.conflict('A goal with this name already exists', 'GOAL_EXISTS');
  return goalRepository.createInOrg(data, organizationId);
}

export async function updateGoal(organizationId, id, updates) {
  if (updates.name) {
    const exists = await goalRepository.nameExistsInOrg(updates.name, organizationId, id);
    if (exists) throw ApiError.conflict('A goal with this name already exists', 'GOAL_EXISTS');
  }
  const goal = await goalRepository.updateByIdInOrg(id, organizationId, updates);
  if (!goal) throw ApiError.notFound('Goal not found');
  return goal;
}

export async function deleteGoal(organizationId, id) {
  const goal = await goalRepository.deleteByIdInOrg(id, organizationId);
  if (!goal) throw ApiError.notFound('Goal not found');
  return goal;
}

// --- Progress evaluation --------------------------------------------------
// Deliberately computed on the fly from Attendance/WorkSession, never
// stored per-day-per-goal - see the comment on the Goal model for why.

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const days = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(new Date(d));
  }
  return days;
}

/**
 * A day only counts toward a goal's WTD/MTD percentage if the person had
 * an Attendance record for it at all (i.e. they worked that day) - a
 * weekend or a day they had off shouldn't silently drag down "days goal
 * met" the way a missed workday should.
 */
async function loadDayData(userId, organizationId, rangeStart, rangeEnd) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);

  const attendanceRecords = await Attendance.find({
    userId: userObjectId,
    organizationId: orgObjectId,
    date: { $gte: rangeStart, $lte: rangeEnd },
  }).select('date totalDurationSeconds');

  const activeRows = await WorkSession.aggregate([
    {
      $match: {
        userId: userObjectId,
        organizationId: orgObjectId,
        status: 'CLOSED',
        checkInAt: { $gte: rangeStart, $lte: new Date(rangeEnd.getTime() + 86400000 - 1) },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkInAt' } },
        activeDurationSeconds: { $sum: '$activeDurationSeconds' },
      },
    },
  ]);
  const activeByDay = new Map(activeRows.map((r) => [r._id, r.activeDurationSeconds]));

  const dayData = new Map();
  for (const rec of attendanceRecords) {
    const key = dayKey(rec.date);
    dayData.set(key, {
      hasAttendance: true,
      loggedSeconds: rec.totalDurationSeconds || 0,
      activeSeconds: activeByDay.get(key) || 0,
    });
  }
  return dayData;
}

function valueFor(dayEntry, metric) {
  if (!dayEntry) return 0;
  return metric === 'ACTIVE_HOURS' ? dayEntry.activeSeconds : dayEntry.loggedSeconds;
}

function evaluateRollup(days, dayData, goal) {
  const thresholdSeconds = goal.thresholdHours * 3600;
  const isMet = (seconds) =>
    goal.comparator === 'LTE' ? seconds <= thresholdSeconds : seconds >= thresholdSeconds;

  let daysElapsed = 0;
  let daysMet = 0;
  for (const d of days) {
    const entry = dayData.get(dayKey(d));
    if (!entry?.hasAttendance) continue; // no attendance that day - excluded from the denominator
    daysElapsed += 1;
    if (isMet(valueFor(entry, goal.metric))) daysMet += 1;
  }
  return {
    daysElapsed,
    daysMet,
    percentMet: daysElapsed > 0 ? Math.round((daysMet / daysElapsed) * 100) : 0,
  };
}

export async function getGoalProgress(requestingUser) {
  const { organizationId } = requestingUser;
  const goals = await Goal.find({ organizationId, status: 'ACTIVE' }).sort({ name: 1 });
  if (goals.length === 0) return { goals: [] };

  const now = new Date();
  const todayStart = startOfDay(now);

  const last7Days = daysBetween(new Date(todayStart.getTime() - 6 * 86400000), todayStart);

  const dayOfWeek = todayStart.getDay(); // 0 = Sunday
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = startOfDay(new Date(todayStart.getTime() - diffToMonday * 86400000));
  const wtdDays = daysBetween(weekStart, todayStart);

  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const mtdDays = daysBetween(monthStart, todayStart);

  const rangeStart = [last7Days[0], weekStart, monthStart].reduce((a, b) => (a < b ? a : b));
  const dayData = await loadDayData(requestingUser.id, organizationId, rangeStart, todayStart);

  const results = goals.map((goal) => {
    const thresholdSeconds = goal.thresholdHours * 3600;
    const isMet = (seconds) =>
      goal.comparator === 'LTE' ? seconds <= thresholdSeconds : seconds >= thresholdSeconds;

    const dailyResults = last7Days.map((d) => {
      const entry = dayData.get(dayKey(d));
      return {
        date: dayKey(d),
        valueSeconds: entry ? valueFor(entry, goal.metric) : 0,
        // null = no attendance that day at all, so there's nothing to judge -
        // the UI should render this distinctly from an actual miss.
        met: entry?.hasAttendance ? isMet(valueFor(entry, goal.metric)) : null,
      };
    });

    return {
      id: goal._id,
      name: goal.name,
      metric: goal.metric,
      comparator: goal.comparator,
      thresholdHours: goal.thresholdHours,
      dailyResults,
      wtd: evaluateRollup(wtdDays, dayData, goal),
      mtd: evaluateRollup(mtdDays, dayData, goal),
    };
  });

  return { goals: results };
}
