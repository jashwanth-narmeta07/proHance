import projectRepository from '../repositories/project.repository.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';

const ORG_LEVEL_ROLES = [ROLES.ORGANIZATION_ADMIN, ROLES.HR];

export async function listProjects(requestingUser) {
  if (ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    return projectRepository.findInOrg({}, requestingUser.organizationId, { sort: { createdAt: -1 } });
  }
  return projectRepository.findForMember(requestingUser.id, requestingUser.organizationId);
}

function assertProjectVisible(requestingUser, project) {
  if (ORG_LEVEL_ROLES.includes(requestingUser.role)) return;
  const isMember = project.members.some((m) => m.toString() === requestingUser.id);
  const isManager = project.projectManagerId.toString() === requestingUser.id;
  if (!isMember && !isManager) {
    throw ApiError.forbidden('You do not have access to this project');
  }
}

export async function getProject(requestingUser, projectId) {
  const project = await projectRepository.findByIdInOrg(projectId, requestingUser.organizationId);
  if (!project) throw ApiError.notFound('Project not found');
  assertProjectVisible(requestingUser, project);
  return project;
}

export async function createProject(requestingUser, data) {
  const { organizationId } = requestingUser;
  const pmId = data.projectManagerId || requestingUser.id;

  const pm = await User.findOne({ _id: pmId, organizationId });
  if (!pm) throw ApiError.badRequest('projectManagerId must reference a member of this organization');

  return projectRepository.createInOrg({ ...data, projectManagerId: pmId }, organizationId);
}

export async function updateProject(requestingUser, projectId, updates) {
  const project = await projectRepository.findByIdInOrg(projectId, requestingUser.organizationId);
  if (!project) throw ApiError.notFound('Project not found');

  if (
    !ORG_LEVEL_ROLES.includes(requestingUser.role) &&
    project.projectManagerId.toString() !== requestingUser.id
  ) {
    throw ApiError.forbidden('Only the project manager, HR, or an organization admin can edit this project');
  }

  Object.assign(project, updates);
  await project.save();
  return project;
}

export async function deleteProject(requestingUser, projectId) {
  const project = await projectRepository.findByIdInOrg(projectId, requestingUser.organizationId);
  if (!project) throw ApiError.notFound('Project not found');

  if (
    !ORG_LEVEL_ROLES.includes(requestingUser.role) &&
    project.projectManagerId.toString() !== requestingUser.id
  ) {
    throw ApiError.forbidden('Only the project manager, HR, or an organization admin can delete this project');
  }

  const taskCount = await projectRepository.countTasks(projectId, requestingUser.organizationId);
  if (taskCount > 0) {
    throw ApiError.conflict('Cannot delete a project that still has tasks', 'PROJECT_NOT_EMPTY');
  }

  await projectRepository.deleteByIdInOrg(projectId, requestingUser.organizationId);
}

export { assertProjectVisible };
