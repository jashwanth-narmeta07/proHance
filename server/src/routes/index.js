import { Router } from 'express';
import authRoutes from './auth.routes.js';
import organizationRoutes from './organization.routes.js';
import departmentRoutes from './department.routes.js';
import teamRoutes from './team.routes.js';
import memberRoutes from './member.routes.js';
import attendanceRoutes from './attendance.routes.js';
import requestRoutes from './request.routes.js';
import notificationRoutes from './notification.routes.js';
import auditLogRoutes from './auditLog.routes.js';
import policyRoutes from './policy.routes.js';
import deviceRoutes from './device.routes.js';
import analyticsRoutes from './analytics.routes.js';
import reportRoutes from './report.routes.js';
import projectRoutes from './project.routes.js';
import taskRoutes from './task.routes.js';
import agentRoutes from './agent.routes.js';
import goalRoutes from './goal.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organizations', organizationRoutes);
router.use('/departments', departmentRoutes);
router.use('/teams', teamRoutes);
router.use('/members', memberRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/requests', requestRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/policies', policyRoutes);
router.use('/devices', deviceRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/reports', reportRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/goals', goalRoutes);
// Device-token authenticated (not user JWT) - used only by the desktop agent.
router.use('/agent', agentRoutes);

export default router;
