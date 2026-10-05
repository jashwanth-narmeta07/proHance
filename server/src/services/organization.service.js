import mongoose from 'mongoose';
import organizationRepository from '../repositories/organization.repository.js';
import userRepository from '../repositories/user.repository.js';
import ApiError from '../utils/ApiError.js';

export async function getOrganization(organizationId) {
  const org = await organizationRepository.findByIdUnscoped(organizationId);
  if (!org) throw ApiError.notFound('Organization not found');
  return org;
}

// Fields an ORGANIZATION_ADMIN is allowed to change about their own org.
// Deliberately excludes slug/status, which have their own dedicated flows.
const EDITABLE_FIELDS = [
  'name',
  'industry',
  'companySize',
  'country',
  'timezone',
  'website',
  'logoUrl',
  'contactPhone',
];

export async function updateOrganization(organizationId, updates) {
  const patch = {};
  for (const field of EDITABLE_FIELDS) {
    if (updates[field] !== undefined) patch[field] = updates[field];
  }
  const org = await organizationRepository.model.findByIdAndUpdate(organizationId, patch, {
    new: true,
    runValidators: true,
  });
  if (!org) throw ApiError.notFound('Organization not found');
  return org;
}

export async function getOrganizationOverview(organizationId) {
  const orgObjectId = new mongoose.Types.ObjectId(organizationId);
  const [totalMembers, byRole] = await Promise.all([
    userRepository.countInOrg({}, organizationId),
    userRepository.model.aggregate([
      { $match: { organizationId: orgObjectId } },
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
  ]);

  const roleCounts = byRole.reduce((acc, r) => ({ ...acc, [r._id]: r.count }), {});

  return { totalMembers, roleCounts };
}
