import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as projectService from '../services/project.service.js';

export const list = catchAsync(async (req, res) => {
  const projects = await projectService.listProjects(req.user);
  return sendSuccess(res, { data: { projects } });
});

export const create = catchAsync(async (req, res) => {
  const project = await projectService.createProject(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, data: { project }, message: 'Project created' });
});

export const getOne = catchAsync(async (req, res) => {
  const project = await projectService.getProject(req.user, req.params.id);
  return sendSuccess(res, { data: { project } });
});

export const update = catchAsync(async (req, res) => {
  const project = await projectService.updateProject(req.user, req.params.id, req.body);
  return sendSuccess(res, { data: { project }, message: 'Project updated' });
});

export const remove = catchAsync(async (req, res) => {
  await projectService.deleteProject(req.user, req.params.id);
  return sendSuccess(res, { message: 'Project deleted' });
});
