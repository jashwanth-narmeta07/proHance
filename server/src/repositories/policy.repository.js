import OrganizationPolicy from '../models/OrganizationPolicy.js';
import BaseRepository from './baseRepository.js';

class PolicyRepository extends BaseRepository {
  constructor() {
    super(OrganizationPolicy);
  }

  /**
   * Atomic upsert - a plain findOne-then-create here is a TOCTOU race:
   * if two requests for the same org (e.g. a check-in and the desktop
   * agent's config poll) both find nothing and both try to create, the
   * second hits the unique index on organizationId and throws a raw
   * duplicate-key error. findOneAndUpdate with upsert lets Mongo resolve
   * the race atomically instead.
   */
  async getOrCreate(organizationId) {
    try {
      return await OrganizationPolicy.findOneAndUpdate(
        { organizationId },
        { $setOnInsert: { organizationId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // Even an atomic upsert can lose a very tight race under Mongo's
      // default write concern - if that happens, the other request's
      // document already exists, so just fetch it instead of failing.
      if (err.code === 11000) {
        return OrganizationPolicy.findOne({ organizationId });
      }
      throw err;
    }
  }
}

export default new PolicyRepository();
