import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as taskService from '../services/task.service.js';

export const listForProject = catchAsync(async (req, res) => {
  const tasks = await taskService.listTasksForProject(req.user, req.params.projectId);
  return sendSuccess(res, { data: { tasks } });
});

export const listMine = catchAsync(async (req, res) => {
  const tasks = await taskService.listMyTasks(req.user);
  return sendSuccess(res, { data: { tasks } });
});

export const create = catchAsync(async (req, res) => {
  const task = await taskService.createTask(req.user, req.params.projectId, req.body);
  return sendSuccess(res, { statusCode: 201, data: { task }, message: 'Task created' });
});

export const update = catchAsync(async (req, res) => {
  const task = await taskService.updateTask(req.user, req.params.id, req.body);
  return sendSuccess(res, { data: { task }, message: 'Task updated' });
});

export const remove = catchAsync(async (req, res) => {
  await taskService.deleteTask(req.user, req.params.id);
  return sendSuccess(res, { message: 'Task deleted' });
});
