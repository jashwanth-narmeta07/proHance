import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as requestService from '../services/request.service.js';

export const create = catchAsync(async (req, res) => {
  const request = await requestService.createRequest(req.user, req.body);
  return sendSuccess(res, { statusCode: 201, data: { request }, message: 'Request submitted' });
});

export const myRequests = catchAsync(async (req, res) => {
  const requests = await requestService.listMyRequests(req.user);
  return sendSuccess(res, { data: { requests } });
});

export const forReview = catchAsync(async (req, res) => {
  const requests = await requestService.listForReview(req.user, req.query.status);
  return sendSuccess(res, { data: { requests } });
});

export const getOne = catchAsync(async (req, res) => {
  const request = await requestService.getRequest(req.user, req.params.id);
  return sendSuccess(res, { data: { request } });
});

export const moveToReview = catchAsync(async (req, res) => {
  const request = await requestService.moveToReview(req.user, req.params.id, req.body.comment);
  return sendSuccess(res, { data: { request }, message: 'Moved to review' });
});

export const approve = catchAsync(async (req, res) => {
  const request = await requestService.approveRequest(req.user, req.params.id, req.body.comment);
  return sendSuccess(res, { data: { request }, message: 'Request approved' });
});

export const reject = catchAsync(async (req, res) => {
  const request = await requestService.rejectRequest(req.user, req.params.id, req.body.comment);
  return sendSuccess(res, { data: { request }, message: 'Request rejected' });
});
