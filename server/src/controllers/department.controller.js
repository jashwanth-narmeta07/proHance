import catchAsync from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as departmentService from '../services/department.service.js';

export const list = catchAsync(async (req, res) => {
  const departments = await departmentService.listDepartments(req.user.organizationId);
  return sendSuccess(res, { data: { departments } });
});

export const create = catchAsync(async (req, res) => {
  const department = await departmentService.createDepartment(req.user.organizationId, req.body);
  return sendSuccess(res, { statusCode: 201, data: { department }, message: 'Department created' });
});

export const getOne = catchAsync(async (req, res) => {
  const department = await departmentService.getDepartment(req.user.organizationId, req.params.id);
  return sendSuccess(res, { data: { department } });
});

export const update = catchAsync(async (req, res) => {
  const department = await departmentService.updateDepartment(
    req.user.organizationId,
    req.params.id,
    req.body
  );
  return sendSuccess(res, { data: { department }, message: 'Department updated' });
});

export const remove = catchAsync(async (req, res) => {
  await departmentService.deleteDepartment(req.user.organizationId, req.params.id);
  return sendSuccess(res, { message: 'Department deleted' });
});
