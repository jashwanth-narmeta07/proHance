import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { authenticate, requireOrganizationContext, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  dateRangeSchema,
  employeeBreakdownSchema,
  employeeOverviewSchema,
  employeeTopAppsSchema,
} from '../validators/analytics.validators.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get(
  '/me',
  requirePermission(PERMISSIONS.ACTIVITY_READ_SELF),
  validate(dateRangeSchema),
  analyticsController.mySummary
);
router.get('/me/trend', requirePermission(PERMISSIONS.ACTIVITY_READ_SELF), analyticsController.myTrend);
router.get(
  '/me/top-apps',
  requirePermission(PERMISSIONS.ACTIVITY_READ_SELF),
  validate(dateRangeSchema),
  analyticsController.myTopApps
);
router.get(
  '/team',
  requirePermission(PERMISSIONS.ACTIVITY_READ_TEAM),
  validate(dateRangeSchema),
  analyticsController.teamSummary
);
router.get('/team/trend', requirePermission(PERMISSIONS.ACTIVITY_READ_TEAM), analyticsController.teamTrend);
router.get(
  '/team/top-apps',
  requirePermission(PERMISSIONS.ACTIVITY_READ_TEAM),
  validate(dateRangeSchema),
  analyticsController.teamTopApps
);
router.get(
  '/organization',
  requirePermission(PERMISSIONS.ACTIVITY_READ_ORGANIZATION),
  validate(dateRangeSchema),
  analyticsController.organizationSummary
);
router.get(
  '/organization/trend',
  requirePermission(PERMISSIONS.ACTIVITY_READ_ORGANIZATION),
  analyticsController.organizationTrend
);
router.get(
  '/organization/employees',
  requirePermission(PERMISSIONS.ACTIVITY_READ_ORGANIZATION),
  validate(employeeBreakdownSchema),
  analyticsController.organizationEmployeeBreakdown
);
router.get(
  '/organization/top-apps',
  requirePermission(PERMISSIONS.ACTIVITY_READ_ORGANIZATION),
  validate(dateRangeSchema),
  analyticsController.organizationTopApps
);
router.get(
  '/organization/employees/:userId/top-apps',
  requirePermission(PERMISSIONS.ACTIVITY_READ_ORGANIZATION),
  validate(employeeTopAppsSchema),
  analyticsController.employeeTopApps
);

// Gated on ATTENDANCE_READ (HR, ORGANIZATION_ADMIN, MANAGER all have it;
// EMPLOYEE doesn't) rather than ACTIVITY_READ_ORGANIZATION/TEAM, since both
// an org-wide viewer and a manager viewing their own report use this route -
// getEmployeeOverview does the actual org-vs-own-team scoping.
router.get(
  '/employees/:userId',
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(employeeOverviewSchema),
  analyticsController.employeeOverview
);

export default router;