import ApiError from '../utils/ApiError.js';
import catchAsync from '../utils/catchAsync.js';
import { verifyAccessToken } from '../utils/tokens.js';
import User from '../models/User.js';
import Device from '../models/Device.js';
import { hashDeviceToken } from '../repositories/device.repository.js';
import { roleHasPermission, ROLES } from '../config/permissions.js';

/**
 * Requires a valid access token. Populates req.user with:
 *   { id, organizationId, role }
 * organizationId here is THE authority for tenant scoping downstream -
 * it is never taken from the request body/query/params.
 */
export const authenticate = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Authentication token missing');
  }
  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token', 'INVALID_TOKEN');
  }

  if (payload.type !== 'access') {
    throw ApiError.unauthorized('Invalid token type');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (['SUSPENDED', 'DEACTIVATED', 'EXITED'].includes(user.status)) {
    throw ApiError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');
  }

  req.user = {
    id: user._id.toString(),
    organizationId: user.organizationId ? user.organizationId.toString() : null,
    role: user.role,
    managerId: user.managerId ? user.managerId.toString() : null,
    teamId: user.teamId ? user.teamId.toString() : null,
    departmentId: user.departmentId ? user.departmentId.toString() : null,
  };
  next();
});

/**
 * Ensures the caller belongs to an organization (i.e. is not a bare SUPER_ADMIN
 * context) for routes that are inherently org-scoped.
 */
export function requireOrganizationContext(req, res, next) {
  if (!req.user?.organizationId) {
    throw ApiError.forbidden('This action requires an organization context');
  }
  next();
}

/**
 * Section 32: the desktop agent never uses the user's JWT - it identifies
 * itself with its own device token (hashed at rest, compared via the raw
 * token sent in the X-Device-Token header). This means a compromised agent
 * binary can only ever act as "this one device", which can be revoked
 * independently of the user's account, without touching their login session.
 */
export const authenticateDevice = catchAsync(async (req, res, next) => {
  const rawToken = req.headers['x-device-token'];
  if (!rawToken) throw ApiError.unauthorized('Device token missing', 'DEVICE_TOKEN_REQUIRED');

  const tokenHash = hashDeviceToken(rawToken);
  const device = await Device.findOne({ deviceTokenHash: tokenHash }).select('+deviceTokenHash');
  if (!device) throw ApiError.unauthorized('Invalid device token', 'DEVICE_TOKEN_INVALID');
  if (device.status === 'REVOKED') {
    throw ApiError.forbidden('This device has been revoked', 'DEVICE_REVOKED');
  }

  req.device = device;
  next();
});

/**
 * Permission-based authorization. Never gate on role name directly in a route -
 * always require a permission, so the role -> permission mapping stays centralized
 * in config/permissions.js and can change without touching route files.
 */
export function requirePermission(permission) {
  return function permissionCheck(req, res, next) {
    if (!req.user) throw ApiError.unauthorized();
    if (!roleHasPermission(req.user.role, permission)) {
      throw ApiError.forbidden(`Missing required permission: ${permission}`, 'PERMISSION_DENIED');
    }
    next();
  };
}

/**
 * Restricts SUPER_ADMIN-only platform routes (billing, cross-org support, etc.)
 */
export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Super admin access required');
  }
  next();
}
