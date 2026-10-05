import Attendance from '../models/Attendance.js';
import BaseRepository from './baseRepository.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

class AttendanceRepository extends BaseRepository {
  constructor() {
    super(Attendance);
  }

  async findOpenForUser(userId, organizationId) {
    return Attendance.findOne({ userId, organizationId, checkOutAt: null }).sort({ checkInAt: -1 });
  }

  async findByUserAndDate(userId, organizationId, date) {
    return Attendance.findOne({ userId, organizationId, date: startOfDay(date) });
  }

  async findHistory(userId, organizationId, { from, to } = {}) {
    const filter = { userId, organizationId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = startOfDay(from);
      if (to) filter.date.$lte = startOfDay(to);
    }
    return Attendance.find(filter).sort({ date: -1 });
  }

  async findForUsersOnDate(userIds, organizationId, date) {
    return Attendance.find({ userId: { $in: userIds }, organizationId, date: startOfDay(date) });
  }
}

export default new AttendanceRepository();
export { startOfDay };
