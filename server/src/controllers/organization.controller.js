import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as organizationService from '../services/organization.service.js';

export const getMyOrganization = catchAsync(async (req, res) => {
  const org = await organizationService.getOrganization(req.user.organizationId);
  return sendSuccess(res, { data: { organization: org } });
});

export const updateMyOrganization = catchAsync(async (req, res) => {
  const org = await organizationService.updateOrganization(req.user.organizationId, req.body);
  return sendSuccess(res, { data: { organization: org }, message: 'Organization updated' });
});

export const getOverview = catchAsync(async (req, res) => {
  const overview = await organizationService.getOrganizationOverview(req.user.organizationId);
  return sendSuccess(res, { data: overview });
});
