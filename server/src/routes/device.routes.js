import { Router } from 'express';
import * as deviceController from '../controllers/device.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { registerDeviceSchema, registerForEmployeeSchema, idParamSchema } from '../validators/device.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

// Self-service: any org member can register/list their own devices.
router.post('/', validate(registerDeviceSchema), deviceController.register);
router.get('/me', deviceController.listMine);

// Admin/HR provisioning a device on an employee's behalf - the device still
// belongs to that employee, not whoever calls this. See device.service.js's
// registerDeviceForEmployee for why ownership can't be the admin's.
router.post(
  '/for-employee/:userId',
  requirePermission(PERMISSIONS.DEVICE_MANAGE),
  validate(registerForEmployeeSchema),
  deviceController.registerForEmployee
);

// Org-level visibility and revocation.
router.get('/', requirePermission(PERMISSIONS.DEVICE_MANAGE), deviceController.listOrganization);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.DEVICE_MANAGE),
  validate(idParamSchema),
  deviceController.revoke
);

// An owner can also revoke their own device without the org-level permission.
router.delete('/:id/self-revoke', validate(idParamSchema), deviceController.revoke);

export default router;