import Invitation from '../models/Invitation.js';
import BaseRepository from './baseRepository.js';

class InvitationRepository extends BaseRepository {
  constructor() {
    super(Invitation);
  }

  async findPendingByEmail(email, organizationId) {
    return Invitation.findOne({ email: email.toLowerCase(), organizationId, status: 'PENDING' });
  }

  async findByTokenHash(tokenHash) {
    return Invitation.findOne({ tokenHash, status: 'PENDING' }).select('+tokenHash');
  }
}

export default new InvitationRepository();
