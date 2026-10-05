import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as attendanceService from '../services/attendance.service.js';

export const checkIn = catchAsync(async (req, res) => {
  const result = await attendanceService.checkIn(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, data: result, message: 'Checked in' });
});

export const checkOut = catchAsync(async (req, res) => {
  const result = await attendanceService.checkOut(req.user);
  return sendSuccess(res, { data: result, message: 'Checked out' });
});

export const startBreak = catchAsync(async (req, res) => {
  const event = await attendanceService.startBreak(req.user);
  return sendSuccess(res, { data: { event }, message: 'Break started' });
});

export const endBreak = catchAsync(async (req, res) => {
  const event = await attendanceService.endBreak(req.user);
  return sendSuccess(res, { data: { event }, message: 'Break ended' });
});

export const today = catchAsync(async (req, res) => {
  const result = await attendanceService.getToday(req.user);
  return sendSuccess(res, { data: result });
});

export const myHistory = catchAsync(async (req, res) => {
  const records = await attendanceService.getMyHistory(req.user, req.query);
  return sendSuccess(res, { data: { records } });
});

export const teamAttendance = catchAsync(async (req, res) => {
  const records = await attendanceService.getTeamAttendance(req.user, req.query.date);
  return sendSuccess(res, { data: { records } });
});
