import auditLogRepository from '../repositories/auditLog.repository.js';
import logger from '../config/logger.js';

/**
 * Fire-and-log audit write. Deliberately never throws into the caller's
 * request flow - an audit-log failure should never block the actual
 * business action (e.g. a role change should still succeed even if writing
 * its audit trail fails), but it must be logged loudly so the gap is caught.
 *
 * previousValue/newValue should be plain, already-redacted objects - callers
 * are responsible for never passing password hashes, tokens, or other
 * secrets in here (Section 24: never store secrets in audit logs).
 */
export async function recordAudit({
  organizationId,
  actorId,
  action,
  targetEntity,
  targetId,
  previousValue,
  newValue,
  req,
}) {
  try {
    await auditLogRepository.createInOrg(
      {
        actorId,
        action,
        targetEntity,
        targetId,
        previousValue,
        newValue,
        ipAddress: req?.ip,
        userAgent: req?.headers?.['user-agent'],
      },
      organizationId
    );
  } catch (err) {
    logger.error('Failed to write audit log entry', { action, targetEntity, targetId, error: err.message });
  }
}

export async function listAuditLogs(organizationId, filters) {
  return auditLogRepository.findForOrg(organizationId, filters);
}
