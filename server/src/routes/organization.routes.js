import { Router } from 'express';
import * as organizationController from '../controllers/organization.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateOrganizationSchema } from '../validators/organization.validators.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get('/me', organizationController.getMyOrganization);
router.get('/overview', requirePermission(PERMISSIONS.ORGANIZATION_MANAGE), organizationController.getOverview);
router.patch(
  '/me',
  requirePermission(PERMISSIONS.ORGANIZATION_MANAGE),
  validate(updateOrganizationSchema),
  organizationController.updateMyOrganization
);

export default router;
