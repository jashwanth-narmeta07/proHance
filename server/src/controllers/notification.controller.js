import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as notificationService from '../services/notification.service.js';

export const list = catchAsync(async (req, res) => {
  const notifications = await notificationService.listMyNotifications(req.user, req.query);
  return sendSuccess(res, { data: { notifications } });
});

export const unreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user);
  return sendSuccess(res, { data: { count } });
});

export const markRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markRead(req.user, req.params.id);
  return sendSuccess(res, { data: { notification }, message: 'Marked as read' });
});

export const markAllRead = catchAsync(async (req, res) => {
  await notificationService.markAllRead(req.user);
  return sendSuccess(res, { message: 'All notifications marked as read' });
});
