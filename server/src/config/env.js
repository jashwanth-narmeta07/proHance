import dotenv from 'dotenv';
dotenv.config();

const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

function getEnv(key, fallback) {
  const value = process.env[key] ?? fallback;
  return value;
}

// CLIENT_URL is a comma-separated origin list (localhost, 127.0.0.1, LAN IP,
// etc.) so Socket.IO's CORS whitelist can allow all of them at once. Any
// code building an actual link (invitation emails, password resets, ...)
// needs exactly one of those origins, not the raw comma-joined string - see
// the bug where an invite link came out as
// "http://localhost:5173,http://127.0.0.1:5173,.../accept-invitation?...".
// Parsing it once here means both uses always agree on what CLIENT_URL means.
const rawClientUrl = getEnv('CLIENT_URL', 'http://localhost:5173');
const clientUrls = rawClientUrl
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const env = {
  NODE_ENV: getEnv('NODE_ENV', 'development'),
  PORT: parseInt(getEnv('PORT', '5000'), 10),
  MONGO_URI: getEnv('MONGO_URI', 'mongodb://127.0.0.1:27017/workforce_saas'),
  // All allowed origins, for CORS/Socket.IO whitelisting.
  CLIENT_URLS: clientUrls,
  // The one origin to use when building a link a person will actually
  // click (invite emails, etc.) - always the first entry, and never the
  // raw comma-joined value.
  PRIMARY_CLIENT_URL: clientUrls[0] || 'http://localhost:5173',
  // Kept for any existing call site still reading this directly - same
  // value as PRIMARY_CLIENT_URL, single origin, not the raw env string.
  CLIENT_URL: clientUrls[0] || 'http://localhost:5173',

  JWT_ACCESS_SECRET: getEnv('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: getEnv('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
  JWT_ACCESS_EXPIRES_IN: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

  COOKIE_SECRET: getEnv('COOKIE_SECRET', 'dev-cookie-secret-change-me'),

  EMAIL_PROVIDER: getEnv('EMAIL_PROVIDER', 'console'), // console | smtp | resend | sendgrid
  EMAIL_FROM: getEnv('EMAIL_FROM', 'no-reply@workforce-saas.local'),

  RATE_LIMIT_WINDOW_MS: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10),
  RATE_LIMIT_MAX: parseInt(getEnv('RATE_LIMIT_MAX', '300'), 10),
};

export function assertProductionSecrets() {
  if (env.NODE_ENV === 'production') {
    for (const key of required) {
      const val = process.env[key];
      if (!val || val.startsWith('dev-')) {
        throw new Error(`Missing/insecure required environment variable in production: ${key}`);
      }
    }
  }
}

export default env;