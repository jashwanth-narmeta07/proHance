import Organization from '../models/Organization.js';
import BaseRepository from './baseRepository.js';

class OrganizationRepository extends BaseRepository {
  constructor() {
    super(Organization);
  }

  async findBySlug(slug) {
    return Organization.findOne({ slug: slug.toLowerCase() });
  }

  async slugExists(slug) {
    return Organization.exists({ slug: slug.toLowerCase() });
  }
}

export default new OrganizationRepository();
