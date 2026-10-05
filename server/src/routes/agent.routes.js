import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as agentController from '../controllers/agent.controller.js';
import { authenticateDevice } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { syncEventsSchema, heartbeatSchema } from '../validators/agent.validators.js';

const router = Router();

// The agent syncs frequently (heartbeats, batched events) so its limiter is
// separate from and more generous than the human-facing API's default limit.
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(agentLimiter, authenticateDevice);

router.get('/config', agentController.config);
router.post('/heartbeat', validate(heartbeatSchema), agentController.heartbeat);
router.post('/sync', validate(syncEventsSchema), agentController.sync);

export default router;