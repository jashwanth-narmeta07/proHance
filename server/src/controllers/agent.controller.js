import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as activitySyncService from '../services/activitySync.service.js';
import * as deviceService from '../services/device.service.js';

export const sync = catchAsync(async (req, res) => {
  const results = await activitySyncService.syncActivityEvents(req.device, req.body.events);
  return sendSuccess(res, { data: { results } });
});

export const config = catchAsync(async (req, res) => {
  const config = await activitySyncService.getAgentConfig(req.device);
  return sendSuccess(res, { data: config });
});

export const heartbeat = catchAsync(async (req, res) => {
  const device = await deviceService.recordHeartbeat(req.device, req.body);
  await activitySyncService.heartbeatAck(device);
  return sendSuccess(res, { data: { device } });
});