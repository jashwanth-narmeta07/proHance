import { Router } from 'express';
import * as taskController from '../controllers/task.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { updateTaskSchema, idParamSchema } from '../validators/project.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext, requirePermission(PERMISSIONS.TASK_READ));

router.get('/me', taskController.listMine);
// Full permission enforcement (assignee-only status changes vs full edit)
// happens in task.service.updateTask - the route only guarantees the caller
// has at least read access to tasks in this organization.
router.patch('/:id', validate(updateTaskSchema), taskController.update);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.TASK_MANAGE),
  validate(idParamSchema),
  taskController.remove
);

export default router;
