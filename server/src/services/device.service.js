import deviceRepository, { generateDeviceToken } from '../repositories/device.repository.js';
import policyRepository from '../repositories/policy.repository.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';
import * as auditLogService from './auditLog.service.js';
import { emitToOrganization } from '../sockets/index.js';

/**
 * Section 11/32: the desktop agent identifies itself with a device token, not
 * the user's own JWT - so a compromised agent binary can only ever act as
 * "this one device", and that device can be revoked independently of the
 * user's account. The raw token is returned exactly once, here, and only
 * its hash is ever persisted.
 */
export async function registerDevice(requestingUser, payload) {
  return registerDeviceForUser(requestingUser.organizationId, requestingUser.id, payload);
}

/**
 * Admin/HR provisioning a device on an employee's behalf - the resulting
 * device still belongs to that employee (userId), not the admin doing the
 * provisioning, since ownership is what ties tracking to that person's
 * attendance (see activitySync.service.js's isCheckedIn resolution). The
 * token is still shown to whoever calls this endpoint exactly once, same
 * as self-registration - it's then on them to relay it to the employee
 * (verbally, a shared doc, however) rather than the employee ever needing
 * to log in themselves to get it.
 */
export async function registerDeviceForEmployee(requestingUser, targetUserId, payload) {
  if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to register a device for another employee');
  }
  const targetUser = await User.findOne({ _id: targetUserId, organizationId: requestingUser.organizationId }).select(
    '_id status'
  );
  if (!targetUser) throw ApiError.notFound('Employee not found');
  if (targetUser.status === 'EXITED') {
    throw ApiError.conflict('Cannot register a device for an offboarded employee', 'EMPLOYEE_EXITED');
  }

  const result = await registerDeviceForUser(requestingUser.organizationId, targetUserId, payload);

  await auditLogService.recordAudit({
    organizationId: requestingUser.organizationId,
    actorId: requestingUser.id,
    action: 'DEVICE_REGISTERED_FOR_EMPLOYEE',
    targetEntity: 'Device',
    targetId: result.device._id,
    newValue: { deviceName: payload.deviceName, forUserId: targetUserId },
  });

  return result;
}

async function registerDeviceForUser(organizationId, ownerUserId, payload) {
  const policy = await policyRepository.getOrCreate(organizationId);

  const activeCount = await deviceRepository.countActiveForUser(ownerUserId, organizationId);
  if (activeCount >= policy.devicePolicy.maxDevicesPerUser) {
    throw ApiError.conflict(
      `This employee has reached the maximum of ${policy.devicePolicy.maxDevicesPerUser} registered devices`,
      'DEVICE_LIMIT_REACHED'
    );
  }

  const { raw, hash } = generateDeviceToken();

  const device = await deviceRepository.createInOrg(
    {
      userId: ownerUserId,
      deviceName: payload.deviceName,
      os: payload.os,
      osVersion: payload.osVersion,
      agentVersion: payload.agentVersion,
      deviceTokenHash: hash,
      status: 'REGISTERED',
      onlineStatus: 'OFFLINE',
    },
    organizationId
  );

  return { device, deviceToken: raw };
}

export async function listMyDevices(requestingUser) {
  return deviceRepository.findByUser(requestingUser.id, requestingUser.organizationId);
}

const ORG_LEVEL_ROLES = [ROLES.ORGANIZATION_ADMIN, ROLES.HR];

export async function listOrganizationDevices(requestingUser) {
  if (!ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to view organization devices');
  }
  return deviceRepository.findInOrgWithOwner(requestingUser.organizationId);
}

export async function revokeDevice(requestingUser, deviceId) {
  const { organizationId } = requestingUser;
  const device = await deviceRepository.findByIdInOrg(deviceId, organizationId);
  if (!device) throw ApiError.notFound('Device not found');

  const isOwner = device.userId.toString() === requestingUser.id;
  if (!isOwner && !ORG_LEVEL_ROLES.includes(requestingUser.role)) {
    throw ApiError.forbidden('You do not have permission to revoke this device');
  }

  const previousStatus = device.status;
  device.status = 'REVOKED';
  device.onlineStatus = 'OFFLINE';
  await device.save();

  await auditLogService.recordAudit({
    organizationId,
    actorId: requestingUser.id,
    action: 'DEVICE_REVOKED',
    targetEntity: 'Device',
    targetId: device._id,
    previousValue: { status: previousStatus },
    newValue: { status: 'REVOKED' },
  });

  emitToOrganization(organizationId, 'device:revoked', { deviceId: device._id, userId: device.userId });

  return device;
}

/**
 * Called by the desktop agent (via device-token auth, Phase 7) to stay
 * marked online. Also the only place OS info gets updated after the
 * device is created - registration (especially registerDeviceForEmployee,
 * where the person registering isn't at that laptop) often can't supply
 * it, so the agent reporting its own OS here is what actually fills the
 * Devices page in for machines provisioned remotely.
 */
export async function recordHeartbeat(device, info = {}) {
  device.lastHeartbeatAt = new Date();
  device.onlineStatus = 'ONLINE';
  if (device.status === 'REGISTERED') device.status = 'ACTIVE';
  if (info.os) device.os = info.os;
  if (info.osVersion) device.osVersion = info.osVersion;
  if (info.agentVersion) device.agentVersion = info.agentVersion;
  if (typeof info.isIdle === 'boolean') device.lastKnownIdle = info.isIdle;
  if (typeof info.isCheckedIn === 'boolean') device.lastKnownCheckedIn = info.isCheckedIn;
  await device.save();
  emitToOrganization(device.organizationId.toString(), 'device:online', {
    deviceId: device._id,
    userId: device.userId,
    activityStatus: device.activityStatus,
  });
  return device;
}