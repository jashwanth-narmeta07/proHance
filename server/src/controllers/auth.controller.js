import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as authService from '../services/auth.service.js';

export const registerOrganization = catchAsync(async (req, res) => {
  const result = await authService.registerOrganization(req.body);
  return sendSuccess(res, {
    statusCode: 201,
    data: result,
    message: 'Organization registered successfully',
  });
});

export const login = catchAsync(async (req, res) => {
  const result = await authService.login(req.body);
  return sendSuccess(res, { data: result, message: 'Login successful' });
});

export const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(req.body);
  return sendSuccess(res, { data: result, message: 'Token refreshed' });
});

export const logout = catchAsync(async (req, res) => {
  await authService.logout({ userId: req.user.id });
  return sendSuccess(res, { message: 'Logged out successfully' });
});

export const me = catchAsync(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id, req.user.organizationId);
  return sendSuccess(res, { data: { user }, message: 'Current user' });
});
