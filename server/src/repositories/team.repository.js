import Team from '../models/Team.js';
import User from '../models/User.js';
import BaseRepository from './baseRepository.js';

class TeamRepository extends BaseRepository {
  constructor() {
    super(Team);
  }

  async nameExistsInDepartment(name, departmentId, organizationId, excludeId) {
    const filter = { name, departmentId, organizationId };
    if (excludeId) filter._id = { $ne: excludeId };
    return Team.exists(filter);
  }

  async countMembers(teamId, organizationId) {
    return User.countDocuments({ teamId, organizationId });
  }

  /**
   * Teams a given manager is authorized to see: teams they manage directly.
   * This is the enforcement point for "managers see only their own team" -
   * called from the service layer, never bypassed by trusting a client filter.
   */
  async findManagedByUser(managerId, organizationId) {
    return Team.find({ managerId, organizationId });
  }
}

export default new TeamRepository();
