import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { attendanceReportSchema } from '../validators/analytics.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext, requirePermission(PERMISSIONS.REPORT_EXPORT));

router.get('/attendance.csv', validate(attendanceReportSchema), reportController.attendanceCsv);

export default router;
