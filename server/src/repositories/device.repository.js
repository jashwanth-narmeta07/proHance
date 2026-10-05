import crypto from 'crypto';
import Device from '../models/Device.js';
import BaseRepository from './baseRepository.js';

class DeviceRepository extends BaseRepository {
  constructor() {
    super(Device);
  }

  async findByUser(userId, organizationId) {
    return Device.find({ userId, organizationId }).sort({ createdAt: -1 });
  }

  async findInOrgWithOwner(organizationId) {
    return Device.find({ organizationId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });
  }

  async findByTokenHash(tokenHash) {
    return Device.findOne({ deviceTokenHash: tokenHash, status: { $ne: 'REVOKED' } }).select('+deviceTokenHash');
  }

  async countActiveForUser(userId, organizationId) {
    return Device.countDocuments({ userId, organizationId, status: { $ne: 'REVOKED' } });
  }
}

export function generateDeviceToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashDeviceToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export default new DeviceRepository();
