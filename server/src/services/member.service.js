import User from '../models/User.js';
import Department from '../models/Department.js';
import Team from '../models/Team.js';
import Organization from '../models/Organization.js';
import Invitation from '../models/Invitation.js';
import invitationRepository from '../repositories/invitation.repository.js';
import userRepository from '../repositories/user.repository.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';
import * as emailService from './email.service.js';
import * as auditLogService from './auditLog.service.js';
import env from '../config/env.js';
import logger from '../config/logger.js';

const INVITATION_TTL_DAYS = 7;

async function assertReferencesValid({ organizationId, departmentId, teamId, managerId }) {
  if (departmentId) {
    const dept = await Department.exists({ _id: departmentId, organizationId });
    if (!dept) throw ApiError.badRequest('Invalid departmentId for this organization');
  }
  if (teamId) {
    const team = await Team.exists({ _id: teamId, organizationId });
    if (!team) throw ApiError.badRequest('Invalid teamId for this organization');
  }
  if (managerId) {
    const manager = await User.exists({
      _id: managerId,
      organizationId,
      role: { $in: [ROLES.MANAGER, ROLES.ORGANIZATION_ADMIN] },
    });
    if (!manager) throw ApiError.badRequest('managerId must reference a manager in this organization');
  }
}

/**
 * Section 7: Admin/HR never hand out passwords directly - they create an
 * invitation, the platform emails a one-time link, and the employee sets
 * their own password when accepting. Only the token HASH is stored; the raw
 * token exists only in memory here and in the email that goes out once.
 */
export async function inviteMember(requestingUser, payload) {
  const { organizationId } = requestingUser;
  const email = payload.email.toLowerCase();

  const [existingUser, existingInvite] = await Promise.all([
    userRepository.findByEmailInOrg(email, organizationId),
    invitationRepository.findPendingByEmail(email, organizationId),
  ]);
  if (existingUser) throw ApiError.conflict('This email already belongs to a member', 'EMAIL_TAKEN');
  if (existingInvite) throw ApiError.conflict('An invitation is already pending for this email', 'INVITE_PENDING');

  // Only ORGANIZATION_ADMIN can grant HR or ORGANIZATION_ADMIN roles; HR can
  // invite MANAGER/EMPLOYEE but not create peers or admins.
  if (
    requestingUser.role === ROLES.HR &&
    [ROLES.ORGANIZATION_ADMIN, ROLES.HR, ROLES.SUPER_ADMIN].includes(payload.role)
  ) {
    throw ApiError.forbidden('HR cannot invite a member with this role', 'ROLE_ESCALATION_BLOCKED');
  }

  await assertReferencesValid({ organizationId, ...payload });

  const { raw, hash } = Invitation.generateToken();

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await invitationRepository.createInOrg(
    {
      email,
      role: payload.role,
      departmentId: payload.departmentId || null,
      teamId: payload.teamId || null,
      managerId: payload.managerId || null,
      invitedBy: requestingUser.id,
      tokenHash: hash,
      expiresAt,
      status: 'PENDING',
    },
    organizationId
  );

  const org = await Organization.findById(organizationId);
  const acceptUrl = `${env.CLIENT_URL}/accept-invitation?token=${raw}`;

  try {
    await emailService.sendInvitationEmail({
      to: email,
      organizationName: org.name,
      inviterName: `${requestingUser.firstName || ''} ${requestingUser.lastName || ''}`.trim() || 'A colleague',
      role: payload.role,
      acceptUrl,
    });
  } catch (err) {
    // The invitation record still exists and can be resent - email delivery
    // failure shouldn't roll back the invite itself.
    logger.error('Failed to send invitation email', { error: err.message, invitationId: invitation._id.toString() });
  }

  return invitation;
}

export async function listInvitations(organizationId, status) {
  const filter = status ? { status } : {};
  return invitationRepository.findInOrg(filter, organizationId, { sort: { createdAt: -1 } });
}

export async function revokeInvitation(organizationId, invitationId) {
  const invitation = await invitationRepository.updateByIdInOrg(invitationId, organizationId, {
    status: 'REVOKED',
  });
  if (!invitation) throw ApiError.notFound('Invitation not found');
  return invitation;
}

/**
 * Public endpoint (no auth) - identity comes entirely from possessing the
 * raw token, which only the invited email received. The token is hashed
 * before lookup so a database read never exposes the value that would let
 * someone else redeem it.
 */
export async function acceptInvitation({ token, password, firstName, lastName }) {
  const tokenHash = Invitation.hashToken(token);
  const invitation = await invitationRepository.findByTokenHash(tokenHash);

  if (!invitation) throw ApiError.badRequest('Invitation is invalid or has already been used', 'INVALID_INVITATION');
  if (invitation.expiresAt < new Date()) {
    invitation.status = 'EXPIRED';
    await invitation.save();
    throw ApiError.badRequest('This invitation has expired', 'INVITATION_EXPIRED');
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    organizationId: invitation.organizationId,
    email: invitation.email,
    passwordHash,
    role: invitation.role,
    firstName,
    lastName,
    departmentId: invitation.departmentId,
    teamId: invitation.teamId,
    managerId: invitation.managerId,
    status: 'ACTIVE',
    joiningDate: new Date(),
  });

  invitation.status = 'ACCEPTED';
  invitation.acceptedAt = new Date();
  await invitation.save();

  return user;
}

/**
 * Member visibility follows the same rule as teams: a MANAGER only sees
 * their direct reports, HR/ADMIN see the whole organization.
 */
export async function listMembers(requestingUser, filters = {}) {
  const { organizationId } = requestingUser;
  const query = {};
  if (filters.departmentId) query.departmentId = filters.departmentId;
  if (filters.teamId) query.teamId = filters.teamId;
  if (filters.role) query.role = filters.role;
  if (filters.status) query.status = filters.status;

  if (requestingUser.role === ROLES.MANAGER) {
    query.managerId = requestingUser.id;
  }

  return User.find({ ...query, organizationId }).select('-passwordHash -refreshTokenVersion');
}

export async function getMember(requestingUser, memberId) {
  const member = await User.findOne({ _id: memberId, organizationId: requestingUser.organizationId }).select(
    '-passwordHash -refreshTokenVersion'
  );
  if (!member) throw ApiError.notFound('Member not found');

  const isSelf = member._id.toString() === requestingUser.id;
  const isManagerOfMember = member.managerId?.toString() === requestingUser.id;
  const isOrgLevel = [ROLES.ORGANIZATION_ADMIN, ROLES.HR].includes(requestingUser.role);

  if (!isSelf && !isOrgLevel && !(requestingUser.role === ROLES.MANAGER && isManagerOfMember)) {
    throw ApiError.forbidden('You do not have permission to view this member');
  }
  return member;
}

// Fields a MANAGER may never touch, even for their own reports.
const RESTRICTED_TO_ORG_LEVEL = ['role', 'managerId', 'departmentId', 'teamId', 'status', 'employmentType'];

export async function updateMember(requestingUser, memberId, updates) {
  const { organizationId } = requestingUser;
  const member = await User.findOne({ _id: memberId, organizationId });
  if (!member) throw ApiError.notFound('Member not found');

  const isOrgLevel = [ROLES.ORGANIZATION_ADMIN, ROLES.HR].includes(requestingUser.role);
  if (!isOrgLevel) {
    const touchesRestricted = Object.keys(updates).some((k) => RESTRICTED_TO_ORG_LEVEL.includes(k));
    if (touchesRestricted) {
      throw ApiError.forbidden('Only HR or an organization admin can change role, manager, team, department, or status');
    }
  }

  if (updates.role && requestingUser.role === ROLES.HR && [ROLES.ORGANIZATION_ADMIN, ROLES.HR].includes(updates.role)) {
    throw ApiError.forbidden('HR cannot promote a member to HR or admin', 'ROLE_ESCALATION_BLOCKED');
  }

  if (updates.departmentId || updates.teamId || updates.managerId) {
    await assertReferencesValid({ organizationId, ...updates });
  }

  // Snapshot only the fields actually being changed, and only for the
  // sensitive ones - Section 24 requires previous/new value on audit
  // entries, but never anything beyond what changed (no full-document dumps).
  const sensitiveFields = ['role', 'managerId', 'departmentId', 'teamId', 'status'];
  const changedSensitive = sensitiveFields.filter((f) => updates[f] !== undefined && String(updates[f]) !== String(member[f]));
  const previousValue = Object.fromEntries(changedSensitive.map((f) => [f, member[f]]));

  Object.assign(member, updates);
  await member.save();

  if (changedSensitive.length > 0) {
    const newValue = Object.fromEntries(changedSensitive.map((f) => [f, member[f]]));
    await auditLogService.recordAudit({
      organizationId,
      actorId: requestingUser.id,
      action: changedSensitive.includes('role') ? 'MEMBER_ROLE_CHANGED' : 'MEMBER_ASSIGNMENT_CHANGED',
      targetEntity: 'User',
      targetId: member._id,
      previousValue,
      newValue,
    });
  }

  return member;
}

/**
 * Section 7/16: offboarding preserves history - we never delete the user
 * document, only move it to EXITED. Their WorkSessions, Attendance, and
 * ActivityEvents keep referencing this same _id so historical reports stay
 * intact.
 */
export async function offboardMember(requestingUser, memberId) {
  const previousStatus = await User.findOne({ _id: memberId, organizationId: requestingUser.organizationId }).select(
    'status'
  );
  const member = await User.findOneAndUpdate(
    { _id: memberId, organizationId: requestingUser.organizationId },
    { status: 'EXITED', $inc: { refreshTokenVersion: 1 } }, // also invalidates their sessions
    { new: true }
  );
  if (!member) throw ApiError.notFound('Member not found');

  await auditLogService.recordAudit({
    organizationId: requestingUser.organizationId,
    actorId: requestingUser.id,
    action: 'MEMBER_OFFBOARDED',
    targetEntity: 'User',
    targetId: member._id,
    previousValue: { status: previousStatus?.status },
    newValue: { status: 'EXITED' },
  });

  return member;
}
