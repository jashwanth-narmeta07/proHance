import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';

import env from './config/env.js';
import logger from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import apiV1Router from './routes/index.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
/**
 * Origins change constantly in local/LAN testing - a laptop's IP shifts on
 * every DHCP lease renewal (reconnecting to wifi, a router restart), so a
 * hardcoded origin list breaks the moment that happens, with a CORS error
 * that looks identical to "the server is unreachable" from the browser's
 * side. Instead of hardcoding specific IPs (which we've now had to update
 * twice in one session), allow localhost plus any private-network address -
 * this is safe here because these ranges are never publicly routable, so
 * this only ever matches devices on the same LAN, never the open internet.
 */
function isAllowedOrigin(origin) {
  if (!origin) return true; // non-browser clients (the desktop agent, curl, etc.) send no Origin header at all
  let hostname;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . operators from user input to prevent NoSQL injection

app.use(
  morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  })
);

// Global rate limit; auth routes apply a stricter limiter of their own.
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() },
    message: 'Service healthy',
  });
});

app.use('/api/v1', apiV1Router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;