import AuditLog from '../models/AuditLog.js';
import BaseRepository from './baseRepository.js';

class AuditLogRepository extends BaseRepository {
  constructor() {
    super(AuditLog);
  }

  async findForOrg(organizationId, { targetEntity, actorId, limit = 100, before } = {}) {
    const filter = { organizationId };
    if (targetEntity) filter.targetEntity = targetEntity;
    if (actorId) filter.actorId = actorId;
    if (before) filter.createdAt = { $lt: new Date(before) };
    return AuditLog.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 200));
  }
}

export default new AuditLogRepository();
