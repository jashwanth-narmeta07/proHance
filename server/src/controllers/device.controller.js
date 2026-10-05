import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as deviceService from '../services/device.service.js';

export const register = catchAsync(async (req, res) => {
  const { device, deviceToken } = await deviceService.registerDevice(req.user, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    data: { device, deviceToken },
    message: 'Device registered - store this token securely, it will not be shown again',
  });
});

export const registerForEmployee = catchAsync(async (req, res) => {
  const { device, deviceToken } = await deviceService.registerDeviceForEmployee(req.user, req.params.userId, req.body);
  return sendSuccess(res, {
    statusCode: 201,
    data: { device, deviceToken },
    message: 'Device registered for employee - share this token with them, it will not be shown again',
  });
});

export const listMine = catchAsync(async (req, res) => {
  const devices = await deviceService.listMyDevices(req.user);
  return sendSuccess(res, { data: { devices } });
});

export const listOrganization = catchAsync(async (req, res) => {
  const devices = await deviceService.listOrganizationDevices(req.user);
  return sendSuccess(res, { data: { devices } });
});

export const revoke = catchAsync(async (req, res) => {
  const device = await deviceService.revokeDevice(req.user, req.params.id);
  return sendSuccess(res, { data: { device }, message: 'Device revoked' });
});