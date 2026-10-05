import taskRepository from '../repositories/task.repository.js';
import Project from '../models/Project.js';
import ApiError from '../utils/ApiError.js';
import { getProject } from './project.service.js';
import { roleHasPermission, PERMISSIONS } from '../config/permissions.js';

export async function listTasksForProject(requestingUser, projectId) {
  await getProject(requestingUser, projectId); // throws if project isn't visible to this user
  return taskRepository.findByProject(projectId, requestingUser.organizationId);
}

export async function listMyTasks(requestingUser) {
  return taskRepository.findForAssignee(requestingUser.id, requestingUser.organizationId);
}

export async function createTask(requestingUser, projectId, data) {
  const project = await getProject(requestingUser, projectId);

  if (data.assigneeId) {
    const isMember = project.members.some((m) => m.toString() === data.assigneeId);
    const isPM = project.projectManagerId.toString() === data.assigneeId;
    if (!isMember && !isPM) {
      throw ApiError.badRequest('assigneeId must be a member of this project');
    }
  }

  return taskRepository.createInOrg({ ...data, projectId }, requestingUser.organizationId);
}

export async function updateTask(requestingUser, taskId, updates) {
  const task = await taskRepository.findByIdInOrg(taskId, requestingUser.organizationId);
  if (!task) throw ApiError.notFound('Task not found');

  const project = await Project.findById(task.projectId);
  if (project) {
    // Reuses the same visibility rule as reading the project - being able to
    // see the task at all is a prerequisite for touching it further.
    await getProject(requestingUser, project._id);
  }

  const canManageFully = roleHasPermission(requestingUser.role, PERMISSIONS.TASK_MANAGE);
  const isAssignee = task.assigneeId?.toString() === requestingUser.id;

  if (!canManageFully) {
    // Section 19: an assignee without TASK_MANAGE can still move their own
    // task through TODO -> IN_PROGRESS -> COMPLETED, but nothing else -
    // they can't reassign, retitle, or reprioritize.
    if (!isAssignee) throw ApiError.forbidden('You do not have permission to update this task');
    const allowedFields = new Set(['status']);
    const touchesOther = Object.keys(updates).some((k) => !allowedFields.has(k));
    if (touchesOther) {
      throw ApiError.forbidden('You can only update the status of a task assigned to you');
    }
  }

  Object.assign(task, updates);
  await task.save();
  return task;
}

export async function deleteTask(requestingUser, taskId) {
  const task = await taskRepository.findByIdInOrg(taskId, requestingUser.organizationId);
  if (!task) throw ApiError.notFound('Task not found');
  await getProject(requestingUser, task.projectId);
  await taskRepository.deleteByIdInOrg(taskId, requestingUser.organizationId);
}
