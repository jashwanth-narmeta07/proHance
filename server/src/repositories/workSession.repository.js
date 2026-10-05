import WorkSession from '../models/WorkSession.js';
import BaseRepository from './baseRepository.js';

class WorkSessionRepository extends BaseRepository {
  constructor() {
    super(WorkSession);
  }

  async findOpenForUser(userId, organizationId) {
    return WorkSession.findOne({ userId, organizationId, status: 'ACTIVE' });
  }

  async findHistory(userId, organizationId, { from, to, limit = 30 } = {}) {
    const filter = { userId, organizationId };
    if (from || to) {
      filter.checkInAt = {};
      if (from) filter.checkInAt.$gte = new Date(from);
      if (to) filter.checkInAt.$lte = new Date(to);
    }
    return WorkSession.find(filter).sort({ checkInAt: -1 }).limit(limit);
  }
}

export default new WorkSessionRepository();
