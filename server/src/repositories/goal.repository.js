import Goal from '../models/Goal.js';
import BaseRepository from './baseRepository.js';

class GoalRepository extends BaseRepository {
  constructor() {
    super(Goal);
  }

  async nameExistsInOrg(name, organizationId, excludeId) {
    const filter = { name, organizationId };
    if (excludeId) filter._id = { $ne: excludeId };
    return Goal.exists(filter);
  }
}

export default new GoalRepository();
