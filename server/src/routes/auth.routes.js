import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  loginSchema,
  refreshSchema,
  registerOrganizationSchema,
} from '../validators/auth.validators.js';

const router = Router();

// Tighter limit specifically on credential-guessing surfaces.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later', code: 'RATE_LIMITED' },
});

router.post(
  '/register-organization',
  authLimiter,
  validate(registerOrganizationSchema),
  authController.registerOrganization
);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;
