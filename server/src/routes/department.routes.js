import { Router } from 'express';
import * as departmentController from '../controllers/department.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  idParamSchema,
} from '../validators/department.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get('/', requirePermission(PERMISSIONS.DEPARTMENT_READ), departmentController.list);
router.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(createDepartmentSchema),
  departmentController.create
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_READ),
  validate(idParamSchema),
  departmentController.getOne
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(updateDepartmentSchema),
  departmentController.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(idParamSchema),
  departmentController.remove
);

export default router;
