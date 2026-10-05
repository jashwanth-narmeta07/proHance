import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as goalService from '../services/goal.service.js';

export const list = catchAsync(async (req, res) => {
  const goals = await goalService.listGoals(req.user.organizationId);
  return sendSuccess(res, { data: { goals } });
});

export const create = catchAsync(async (req, res) => {
  const goal = await goalService.createGoal(req.user.organizationId, req.body);
  return sendSuccess(res, { statusCode: 201, data: { goal }, message: 'Goal created' });
});

export const update = catchAsync(async (req, res) => {
  const goal = await goalService.updateGoal(req.user.organizationId, req.params.id, req.body);
  return sendSuccess(res, { data: { goal }, message: 'Goal updated' });
});

export const remove = catchAsync(async (req, res) => {
  await goalService.deleteGoal(req.user.organizationId, req.params.id);
  return sendSuccess(res, { message: 'Goal deleted' });
});

export const progress = catchAsync(async (req, res) => {
  const result = await goalService.getGoalProgress(req.user);
  return sendSuccess(res, { data: result });
});
