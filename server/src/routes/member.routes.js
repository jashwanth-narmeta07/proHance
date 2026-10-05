import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as memberController from '../controllers/member.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  inviteMemberSchema,
  listInvitationsSchema,
  acceptInvitationSchema,
  listMembersSchema,
  updateMemberSchema,
  idParamSchema,
} from '../validators/member.validators.js';

const router = Router();

const acceptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Public: accepting an invitation happens before the user has an account ---
router.post(
  '/accept-invitation',
  acceptLimiter,
  validate(acceptInvitationSchema),
  memberController.acceptInvitation
);

// --- Everything below requires an authenticated, org-scoped user ---
router.use(authenticate, requireOrganizationContext);

router.post(
  '/invitations',
  requirePermission(PERMISSIONS.MEMBER_INVITE),
  validate(inviteMemberSchema),
  memberController.invite
);
router.get(
  '/invitations',
  requirePermission(PERMISSIONS.MEMBER_INVITE),
  validate(listInvitationsSchema),
  memberController.listInvitations
);
router.delete(
  '/invitations/:id',
  requirePermission(PERMISSIONS.MEMBER_INVITE),
  validate(idParamSchema),
  memberController.revokeInvitation
);

router.get('/', requirePermission(PERMISSIONS.EMPLOYEE_READ), validate(listMembersSchema), memberController.list);
router.get('/:id', requirePermission(PERMISSIONS.EMPLOYEE_READ), validate(idParamSchema), memberController.getOne);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.EMPLOYEE_UPDATE),
  validate(updateMemberSchema),
  memberController.update
);
router.post(
  '/:id/offboard',
  requirePermission(PERMISSIONS.MEMBER_MANAGE),
  validate(idParamSchema),
  memberController.offboard
);

export default router;
