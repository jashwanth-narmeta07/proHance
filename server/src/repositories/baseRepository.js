/**
 * Thin data-access wrapper around a Mongoose model.
 *
 * The organizationId-scoped methods exist so that "forgetting to filter by
 * organizationId" becomes structurally hard rather than a habit every service
 * has to remember. Cross-tenant queries (SUPER_ADMIN tooling) must go through
 * the unscoped methods explicitly and are expected to be rare and audited.
 */
export default class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findByIdInOrg(id, organizationId, options = {}) {
    return this.model.findOne({ _id: id, organizationId }, options.projection, options);
  }

  async findInOrg(filter = {}, organizationId, options = {}) {
    return this.model.find({ ...filter, organizationId }, options.projection, options);
  }

  async findOneInOrg(filter = {}, organizationId, options = {}) {
    return this.model.findOne({ ...filter, organizationId }, options.projection, options);
  }

  async countInOrg(filter = {}, organizationId) {
    return this.model.countDocuments({ ...filter, organizationId });
  }

  async createInOrg(data, organizationId) {
    return this.model.create({ ...data, organizationId });
  }

  async updateByIdInOrg(id, organizationId, update, options = { new: true }) {
    return this.model.findOneAndUpdate({ _id: id, organizationId }, update, options);
  }

  async deleteByIdInOrg(id, organizationId) {
    return this.model.findOneAndDelete({ _id: id, organizationId });
  }

  // Unscoped escape hatches - only for SUPER_ADMIN / platform-level flows.
  // Every call site using these should be easy to grep for during a security review.
  async findByIdUnscoped(id) {
    return this.model.findById(id);
  }

  async createUnscoped(data) {
    return this.model.create(data);
  }
}
