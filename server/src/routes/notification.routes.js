import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate, requireOrganizationContext } from '../middleware/auth.js';

const router = Router();

router.use(authenticate, requireOrganizationContext);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
router.patch('/:id/read', notificationController.markRead);
router.post('/mark-all-read', notificationController.markAllRead);

export default router;
