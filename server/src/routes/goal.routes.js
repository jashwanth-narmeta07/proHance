import { Router } from 'express';
import * as goalController from '../controllers/goal.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { createGoalSchema, updateGoalSchema, idParamSchema } from '../validators/goal.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get('/', requirePermission(PERMISSIONS.GOAL_READ), goalController.list);
router.post('/', requirePermission(PERMISSIONS.GOAL_MANAGE), validate(createGoalSchema), goalController.create);
router.get('/progress', requirePermission(PERMISSIONS.GOAL_READ), goalController.progress);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.GOAL_MANAGE),
  validate(updateGoalSchema),
  goalController.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.GOAL_MANAGE),
  validate(idParamSchema),
  goalController.remove
);

export default router;
