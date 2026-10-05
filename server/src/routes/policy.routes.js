import { Router } from 'express';
import * as policyController from '../controllers/policy.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { updatePolicySchema } from '../validators/policy.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get('/', requirePermission(PERMISSIONS.POLICY_READ), policyController.getPolicy);
router.patch(
  '/',
  requirePermission(PERMISSIONS.POLICY_MANAGE),
  validate(updatePolicySchema),
  policyController.updatePolicy
);

export default router;
