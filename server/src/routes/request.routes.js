import { Router } from 'express';
import * as requestController from '../controllers/request.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  createRequestSchema,
  listForReviewSchema,
  decisionSchema,
  idParamSchema,
} from '../validators/request.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

// Self-service - any org member can submit and view their own requests.
router.post('/', requirePermission(PERMISSIONS.REQUEST_CREATE), validate(createRequestSchema), requestController.create);
router.get('/me', requestController.myRequests);

// Reviewer views - scoped to "my team" (manager) or "my organization" (HR/admin) in the service layer.
router.get(
  '/for-review',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(listForReviewSchema),
  requestController.forReview
);

router.get('/:id', validate(idParamSchema), requestController.getOne);
router.post(
  '/:id/move-to-review',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(decisionSchema),
  requestController.moveToReview
);
router.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(decisionSchema),
  requestController.approve
);
router.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.REQUEST_APPROVE),
  validate(decisionSchema),
  requestController.reject
);

export default router;
