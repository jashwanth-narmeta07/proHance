import { Router } from 'express';
import * as auditLogController from '../controllers/auditLog.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { listAuditLogsSchema } from '../validators/auditLog.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext, requirePermission(PERMISSIONS.AUDIT_LOG_READ));

router.get('/', validate(listAuditLogsSchema), auditLogController.list);

export default router;
