import departmentRepository from '../repositories/department.repository.js';
import ApiError from '../utils/ApiError.js';

export async function listDepartments(organizationId) {
  return departmentRepository.findInOrg({}, organizationId, { sort: { name: 1 } });
}

export async function createDepartment(organizationId, data) {
  const exists = await departmentRepository.nameExistsInOrg(data.name, organizationId);
  if (exists) throw ApiError.conflict('A department with this name already exists', 'DEPARTMENT_EXISTS');
  return departmentRepository.createInOrg(data, organizationId);
}

export async function getDepartment(organizationId, id) {
  const dept = await departmentRepository.findByIdInOrg(id, organizationId);
  if (!dept) throw ApiError.notFound('Department not found');
  return dept;
}

export async function updateDepartment(organizationId, id, updates) {
  if (updates.name) {
    const exists = await departmentRepository.nameExistsInOrg(updates.name, organizationId, id);
    if (exists) throw ApiError.conflict('A department with this name already exists', 'DEPARTMENT_EXISTS');
  }
  const dept = await departmentRepository.updateByIdInOrg(id, organizationId, updates);
  if (!dept) throw ApiError.notFound('Department not found');
  return dept;
}

export async function deleteDepartment(organizationId, id) {
  const [memberCount, teamCount] = await Promise.all([
    departmentRepository.countMembers(id, organizationId),
    departmentRepository.countTeams(id, organizationId),
  ]);
  if (memberCount > 0 || teamCount > 0) {
    throw ApiError.conflict(
      'Cannot delete a department that still has teams or members assigned',
      'DEPARTMENT_NOT_EMPTY'
    );
  }
  const dept = await departmentRepository.deleteByIdInOrg(id, organizationId);
  if (!dept) throw ApiError.notFound('Department not found');
  return dept;
}
