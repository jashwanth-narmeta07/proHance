import User from '../models/User.js';
import userRepository from '../repositories/user.repository.js';
import organizationRepository from '../repositories/organization.repository.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import logger from '../config/logger.js';

function buildAuthPayload(user) {
  return {
    user: user.toSafeJSON(),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

/**
 * Creates the Organization and its first ORGANIZATION_ADMIN user together.
 *
 * Mongo transactions require a replica set, which many local/dev Mongo
 * instances are not. To stay correct in both environments we use a
 * compensating action instead of assuming a session is available: if user
 * creation fails after the organization was created, the organization is
 * deleted so we never leave an orphaned org with no admin. This keeps
 * "create organization + admin" atomic from the caller's point of view
 * without hard-requiring a replica set for the MVP.
 */
export async function registerOrganization({ organization, admin }) {
  const slugTaken = await organizationRepository.slugExists(organization.slug);
  if (slugTaken) {
    throw ApiError.conflict('Organization slug is already taken', 'SLUG_TAKEN');
  }

  const org = await organizationRepository.createUnscoped({
    name: organization.name,
    slug: organization.slug.toLowerCase(),
    companyEmail: organization.companyEmail,
    industry: organization.industry,
    companySize: organization.companySize,
    country: organization.country,
    timezone: organization.timezone || 'UTC',
    website: organization.website || undefined,
  });

  try {
    const existingAdminEmail = await userRepository.findByEmailInOrg(admin.email, org._id);
    if (existingAdminEmail) {
      throw ApiError.conflict('Email already in use for this organization', 'EMAIL_TAKEN');
    }

    const passwordHash = await User.hashPassword(admin.password);
    const adminUser = await User.create({
      organizationId: org._id,
      email: admin.email,
      passwordHash,
      role: ROLES.ORGANIZATION_ADMIN,
      firstName: admin.firstName,
      lastName: admin.lastName,
      status: 'ACTIVE',
      joiningDate: new Date(),
    });

    logger.info('Organization registered', { organizationId: org._id.toString(), slug: org.slug });

    return { organization: org, ...buildAuthPayload(adminUser) };
  } catch (err) {
    await organizationRepository.model.findByIdAndDelete(org._id).catch((cleanupErr) => {
      logger.error('Failed to roll back organization after admin creation failure', {
        organizationId: org._id.toString(),
        error: cleanupErr.message,
      });
    });
    throw err;
  }
}

export async function login({ organizationSlug, email, password }) {
  const org = await organizationRepository.findBySlug(organizationSlug);
  if (!org) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  if (org.status !== 'ACTIVE') {
    throw ApiError.forbidden('Organization is not active', 'ORGANIZATION_INACTIVE');
  }

  const user = await userRepository.findByEmailInOrg(email, org._id, true);
  if (!user) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');

  const validPassword = await user.comparePassword(password);
  if (!validPassword) throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');

  if (['SUSPENDED', 'DEACTIVATED', 'EXITED'].includes(user.status)) {
    throw ApiError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return buildAuthPayload(user);
}

export async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }
  if (payload.type !== 'refresh') throw ApiError.unauthorized('Invalid token type');

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (user.refreshTokenVersion !== payload.tokenVersion) {
    // Token was issued before a logout-all / password change invalidated it.
    throw ApiError.unauthorized('Refresh token has been revoked', 'REFRESH_TOKEN_REVOKED');
  }
  if (['SUSPENDED', 'DEACTIVATED', 'EXITED'].includes(user.status)) {
    throw ApiError.forbidden('Account is not active', 'ACCOUNT_INACTIVE');
  }

  return buildAuthPayload(user);
}

export async function logout({ userId }) {
  // Bumping the refresh token version invalidates every outstanding refresh
  // token for this user, including ones on other devices.
  await userRepository.incrementRefreshTokenVersion(userId);
}

export async function getCurrentUser(userId, organizationId) {
  const user = organizationId
    ? await userRepository.findByIdInOrg(userId, organizationId)
    : await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');
  return user.toSafeJSON();
}
