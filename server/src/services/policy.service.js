import policyRepository from '../repositories/policy.repository.js';
import * as auditLogService from './auditLog.service.js';

export async function getPolicy(organizationId) {
  return policyRepository.getOrCreate(organizationId);
}

// Only these nested groups are updatable via this endpoint - keeps the
// update surface explicit and prevents arbitrary top-level field injection.
const UPDATABLE_GROUPS = [
  'idlePolicy',
  'attendancePolicy',
  'breakPolicy',
  'overtimePolicy',
  'activityCollectionPolicy',
  'devicePolicy',
  'notificationPolicy',
];

export async function updatePolicy(requestingUser, updates) {
  const { organizationId } = requestingUser;
  const policy = await policyRepository.getOrCreate(organizationId);

  const previousValue = {};
  const newValue = {};

  for (const group of UPDATABLE_GROUPS) {
    if (updates[group]) {
      previousValue[group] = policy[group]?.toObject ? policy[group].toObject() : policy[group];
      // Merge rather than replace so a partial update (e.g. just
      // idleWarningMinutes) doesn't wipe sibling fields in the same group.
      policy[group] = { ...policy[group]?.toObject?.(), ...updates[group] };
      newValue[group] = policy[group];
    }
  }

  await policy.save();

  if (Object.keys(newValue).length > 0) {
    await auditLogService.recordAudit({
      organizationId,
      actorId: requestingUser.id,
      action: 'POLICY_UPDATED',
      targetEntity: 'OrganizationPolicy',
      targetId: policy._id,
      previousValue,
      newValue,
    });
  }

  return policy;
}
