import Department from '../models/Department.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import BaseRepository from './baseRepository.js';

class DepartmentRepository extends BaseRepository {
  constructor() {
    super(Department);
  }

  async nameExistsInOrg(name, organizationId, excludeId) {
    const filter = { name, organizationId };
    if (excludeId) filter._id = { $ne: excludeId };
    return Department.exists(filter);
  }

  async countMembers(departmentId, organizationId) {
    return User.countDocuments({ departmentId, organizationId });
  }

  async countTeams(departmentId, organizationId) {
    return Team.countDocuments({ departmentId, organizationId });
  }
}

export default new DepartmentRepository();
