import teamRepository from '../repositories/team.repository.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../config/permissions.js';

/**
 * The visibility rule from Section 6/37.7: a MANAGER can only ever see teams
 * they manage. HR/ORGANIZATION_ADMIN see the whole organization. This is
 * enforced here in the service layer (not just hidden in the UI) so a
 * manager can never read another manager's team by guessing an id either.
 */
export async function listTeams(requestingUser) {
  if (requestingUser.role === ROLES.MANAGER) {
    return teamRepository.findManagedByUser(requestingUser.id, requestingUser.organizationId);
  }
  return teamRepository.findInOrg({}, requestingUser.organizationId, { sort: { name: 1 } });
}

export async function getTeam(requestingUser, teamId) {
  const team = await teamRepository.findByIdInOrg(teamId, requestingUser.organizationId);
  if (!team) throw ApiError.notFound('Team not found');

  if (requestingUser.role === ROLES.MANAGER && team.managerId?.toString() !== requestingUser.id) {
    throw ApiError.forbidden('You can only view teams you manage', 'NOT_TEAM_MANAGER');
  }
  return team;
}

export async function createTeam(requestingUser, data) {
  const { organizationId } = requestingUser;
  // Managers can be granted TEAM_MANAGE to edit the team they already run,
  // but creating a brand-new team is an org-structure change reserved for
  // HR/ORGANIZATION_ADMIN.
  if (requestingUser.role === ROLES.MANAGER) {
    throw ApiError.forbidden('Only HR or an organization admin can create a new team');
  }

  if (data.managerId) {
    const manager = await User.findOne({
      _id: data.managerId,
      organizationId,
      role: { $in: [ROLES.MANAGER, ROLES.ORGANIZATION_ADMIN] },
    });
    if (!manager) throw ApiError.badRequest('managerId must reference a manager in this organization');
  }

  const exists = await teamRepository.nameExistsInDepartment(data.name, data.departmentId, organizationId);
  if (exists) throw ApiError.conflict('A team with this name already exists in this department', 'TEAM_EXISTS');

  return teamRepository.createInOrg(data, organizationId);
}

/**
 * A MANAGER holds the TEAM_MANAGE permission (so they can edit their own
 * team), but that permission alone doesn't prove ownership of THIS team -
 * without this check a manager could update or delete a colleague's team by
 * guessing its id. HR/ORGANIZATION_ADMIN, who manage the org broadly, skip
 * this ownership check.
 */
function assertCanManageTeam(requestingUser, team) {
  if (
    requestingUser.role === ROLES.MANAGER &&
    team.managerId?.toString() !== requestingUser.id
  ) {
    throw ApiError.forbidden('You can only manage teams you are the manager of', 'NOT_TEAM_MANAGER');
  }
}

export async function updateTeam(requestingUser, teamId, updates) {
  const { organizationId } = requestingUser;
  const existing = await teamRepository.findByIdInOrg(teamId, organizationId);
  if (!existing) throw ApiError.notFound('Team not found');
  assertCanManageTeam(requestingUser, existing);

  if (updates.managerId) {
    if (requestingUser.role === ROLES.MANAGER) {
      throw ApiError.forbidden('Only HR or an organization admin can reassign a team manager');
    }
    const manager = await User.findOne({
      _id: updates.managerId,
      organizationId,
      role: { $in: [ROLES.MANAGER, ROLES.ORGANIZATION_ADMIN] },
    });
    if (!manager) throw ApiError.badRequest('managerId must reference a manager in this organization');
  }

  const team = await teamRepository.updateByIdInOrg(teamId, organizationId, updates);
  return team;
}

export async function deleteTeam(requestingUser, teamId) {
  const { organizationId } = requestingUser;
  const existing = await teamRepository.findByIdInOrg(teamId, organizationId);
  if (!existing) throw ApiError.notFound('Team not found');
  assertCanManageTeam(requestingUser, existing);

  const memberCount = await teamRepository.countMembers(teamId, organizationId);
  if (memberCount > 0) {
    throw ApiError.conflict('Cannot delete a team that still has members assigned', 'TEAM_NOT_EMPTY');
  }
  const team = await teamRepository.deleteByIdInOrg(teamId, organizationId);
  return team;
}

/** Members of a team, subject to the same manager-scoping rule as getTeam(). */
export async function listTeamMembers(requestingUser, teamId) {
  await getTeam(requestingUser, teamId); // throws if not visible to this user
  return User.find({ teamId, organizationId: requestingUser.organizationId }).select(
    'firstName lastName email role designation status'
  );
}
