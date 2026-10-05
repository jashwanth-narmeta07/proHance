import Project from '../models/Project.js';
import Task from '../models/Task.js';
import BaseRepository from './baseRepository.js';

class ProjectRepository extends BaseRepository {
  constructor() {
    super(Project);
  }

  async findForMember(userId, organizationId) {
    return Project.find({
      organizationId,
      $or: [{ members: userId }, { projectManagerId: userId }],
    }).sort({ createdAt: -1 });
  }

  async countTasks(projectId, organizationId) {
    return Task.countDocuments({ projectId, organizationId });
  }
}

export default new ProjectRepository();
