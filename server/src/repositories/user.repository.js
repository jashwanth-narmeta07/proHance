import User from '../models/User.js';
import BaseRepository from './baseRepository.js';

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Login has to look up a user by email before we know their organization,
   * so it is one of the few legitimately unscoped queries in the system.
   * It still requires organizationId to disambiguate, since email is only
   * unique per-organization - the client supplies the organization slug/email
   * pair, never a bare cross-tenant email lookup.
   */
  async findByEmailInOrg(email, organizationId, withPassword = false) {
    const query = User.findOne({ email: email.toLowerCase(), organizationId });
    if (withPassword) query.select('+passwordHash');
    return query;
  }

  async findByIdWithPassword(id) {
    return User.findById(id).select('+passwordHash');
  }

  async findTeamMembers(managerId, organizationId) {
    return User.find({ managerId, organizationId });
  }

  async incrementRefreshTokenVersion(id) {
    return User.findByIdAndUpdate(id, { $inc: { refreshTokenVersion: 1 } }, { new: true });
  }
}

export default new UserRepository();
