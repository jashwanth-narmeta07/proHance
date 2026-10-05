import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as policyService from '../services/policy.service.js';

export const getPolicy = catchAsync(async (req, res) => {
  const policy = await policyService.getPolicy(req.user.organizationId);
  return sendSuccess(res, { data: { policy } });
});

export const updatePolicy = catchAsync(async (req, res) => {
  const policy = await policyService.updatePolicy(req.user, req.body);
  return sendSuccess(res, { data: { policy }, message: 'Policy updated' });
});
