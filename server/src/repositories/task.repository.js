import Task from '../models/Task.js';
import BaseRepository from './baseRepository.js';

class TaskRepository extends BaseRepository {
  constructor() {
    super(Task);
  }

  async findByProject(projectId, organizationId) {
    return Task.find({ projectId, organizationId }).sort({ createdAt: -1 });
  }

  async findForAssignee(assigneeId, organizationId) {
    return Task.find({ assigneeId, organizationId }).sort({ dueDate: 1, createdAt: -1 });
  }
}

export default new TaskRepository();
