import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as auditLogService from '../services/auditLog.service.js';

export const list = catchAsync(async (req, res) => {
  const logs = await auditLogService.listAuditLogs(req.user.organizationId, req.query);
  return sendSuccess(res, { data: { logs } });
});
