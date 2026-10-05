import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as teamService from '../services/team.service.js';

export const list = catchAsync(async (req, res) => {
  const teams = await teamService.listTeams(req.user);
  return sendSuccess(res, { data: { teams } });
});

export const create = catchAsync(async (req, res) => {
  const team = await teamService.createTeam(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, data: { team }, message: 'Team created' });
});

export const getOne = catchAsync(async (req, res) => {
  const team = await teamService.getTeam(req.user, req.params.id);
  return sendSuccess(res, { data: { team } });
});

export const update = catchAsync(async (req, res) => {
  const team = await teamService.updateTeam(req.user, req.params.id, req.body);
  return sendSuccess(res, { data: { team }, message: 'Team updated' });
});

export const remove = catchAsync(async (req, res) => {
  await teamService.deleteTeam(req.user, req.params.id);
  return sendSuccess(res, { message: 'Team deleted' });
});

export const listMembers = catchAsync(async (req, res) => {
  const members = await teamService.listTeamMembers(req.user, req.params.id);
  return sendSuccess(res, { data: { members } });
});
