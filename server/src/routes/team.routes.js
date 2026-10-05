import { Router } from 'express';
import * as teamController from '../controllers/team.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { createTeamSchema, updateTeamSchema, idParamSchema } from '../validators/team.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get('/', requirePermission(PERMISSIONS.TEAM_READ), teamController.list);
router.post(
  '/',
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  validate(createTeamSchema),
  teamController.create
);
router.get('/:id', requirePermission(PERMISSIONS.TEAM_READ), validate(idParamSchema), teamController.getOne);
router.get(
  '/:id/members',
  requirePermission(PERMISSIONS.TEAM_READ),
  validate(idParamSchema),
  teamController.listMembers
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  validate(updateTeamSchema),
  teamController.update
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.TEAM_MANAGE),
  validate(idParamSchema),
  teamController.remove
);

export default router;
