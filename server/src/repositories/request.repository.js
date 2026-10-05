import Request from '../models/Request.js';
import BaseRepository from './baseRepository.js';

class RequestRepository extends BaseRepository {
  constructor() {
    super(Request);
  }

  async findForRequester(requesterId, organizationId) {
    return Request.find({ requesterId, organizationId }).sort({ createdAt: -1 });
  }

  async findForManager(managerId, organizationId, status) {
    const filter = { managerId, organizationId };
    if (status) filter.status = status;
    return Request.find(filter).sort({ createdAt: -1 });
  }

  async findForOrganization(organizationId, status) {
    const filter = { organizationId };
    if (status) filter.status = status;
    return Request.find(filter).sort({ createdAt: -1 });
  }
}

export default new RequestRepository();
