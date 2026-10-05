import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { checkInSchema, historySchema, teamAttendanceSchema } from '../validators/attendance.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

// Self-service: any authenticated org member can check themself in/out.
router.post('/check-in', validate(checkInSchema), attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.post('/break/start', attendanceController.startBreak);
router.post('/break/end', attendanceController.endBreak);
router.get('/today', attendanceController.today);
router.get('/me', validate(historySchema), attendanceController.myHistory);

// Manager/HR/Admin: attendance visibility for others, scoped in the service layer.
router.get(
  '/team',
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(teamAttendanceSchema),
  attendanceController.teamAttendance
);

export default router;
