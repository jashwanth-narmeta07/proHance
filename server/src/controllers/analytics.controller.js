import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analytics.service.js';

export const mySummary = catchAsync(async (req, res) => {
  const summary = await analyticsService.getMySummary(req.user, req.query);
  return sendSuccess(res, { data: { summary } });
});

export const myTrend = catchAsync(async (req, res) => {
  const trend = await analyticsService.getMyTrend(req.user);
  return sendSuccess(res, { data: trend });
});

export const myTopApps = catchAsync(async (req, res) => {
  const topApps = await analyticsService.getMyTopApps(req.user, req.query);
  return sendSuccess(res, { data: { topApps } });
});

export const teamSummary = catchAsync(async (req, res) => {
  const result = await analyticsService.getTeamSummary(req.user, req.query);
  return sendSuccess(res, { data: result });
});

export const teamTrend = catchAsync(async (req, res) => {
  const trend = await analyticsService.getTeamTrend(req.user);
  return sendSuccess(res, { data: trend });
});

export const teamTopApps = catchAsync(async (req, res) => {
  const topApps = await analyticsService.getTeamTopApps(req.user, req.query);
  return sendSuccess(res, { data: { topApps } });
});

export const organizationSummary = catchAsync(async (req, res) => {
  const result = await analyticsService.getOrganizationSummary(req.user, req.query);
  return sendSuccess(res, { data: result });
});

export const organizationTrend = catchAsync(async (req, res) => {
  const trend = await analyticsService.getOrganizationTrend(req.user);
  return sendSuccess(res, { data: trend });
});

export const organizationEmployeeBreakdown = catchAsync(async (req, res) => {
  const result = await analyticsService.getOrganizationEmployeeBreakdown(req.user, req.query);
  return sendSuccess(res, { data: result });
});

export const organizationTopApps = catchAsync(async (req, res) => {
  const topApps = await analyticsService.getOrganizationTopApps(req.user, req.query);
  return sendSuccess(res, { data: { topApps } });
});

export const employeeTopApps = catchAsync(async (req, res) => {
  const topApps = await analyticsService.getEmployeeTopApps(req.user, req.params.userId, req.query);
  return sendSuccess(res, { data: { topApps } });
});

export const employeeOverview = catchAsync(async (req, res) => {
  const result = await analyticsService.getEmployeeOverview(req.user, req.params.userId, req.query);
  return sendSuccess(res, { data: result });
});