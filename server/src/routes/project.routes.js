import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import * as taskController from '../controllers/task.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  createProjectSchema,
  updateProjectSchema,
  idParamSchema,
  projectIdParamSchema,
  createTaskSchema,
  updateTaskSchema,
} from '../validators/project.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get('/', requirePermission(PERMISSIONS.PROJECT_READ), projectController.list);
router.post(
  '/',
  requirePermission(PERMISSIONS.PROJECT_MANAGE),
  validate(createProjectSchema),
  projectController.create
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.PROJECT_READ),
  validate(idParamSchema),
  projectController.getOne
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.PROJECT_MANAGE),
  validate(updateProjectSchema),
  projectController.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.PROJECT_MANAGE),
  validate(idParamSchema),
  projectController.remove
);

router.get(
  '/:projectId/tasks',
  requirePermission(PERMISSIONS.TASK_READ),
  validate(projectIdParamSchema),
  taskController.listForProject
);
router.post(
  '/:projectId/tasks',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate(createTaskSchema),
  taskController.create
);

export default router;
