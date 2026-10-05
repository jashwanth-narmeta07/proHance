import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import { ROLES } from '../../src/config/permissions.js';

let orgCounter = 0;

/**
 * Registers a fresh organization + admin via the real /auth/register-organization
 * endpoint (not a DB shortcut), so every test that needs "an organization"
 * exercises the actual atomic-registration code path.
 */
export async function registerOrganization(overrides = {}) {
  orgCounter += 1;
  const slug = `test-org-${orgCounter}-${Date.now()}`;
  const payload = {
    organization: {
      name: `Test Org ${orgCounter}`,
      slug,
      companyEmail: `contact+${slug}@example.com`,
      timezone: 'UTC',
      ...overrides.organization,
    },
    admin: {
      firstName: 'Admin',
      lastName: 'User',
      email: `admin@${slug}.example.com`,
      password: 'Password123',
      ...overrides.admin,
    },
  };

  const res = await request(app).post('/api/v1/auth/register-organization').send(payload);
  if (res.status !== 201) {
    throw new Error(`registerOrganization failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { slug, payload, ...res.body.data };
}

/**
 * Creates a user directly in the DB with a given role/relationships and logs
 * them in for a token - bypassing the invitation flow deliberately, since
 * these tests are about RBAC/tenant-isolation *after* a user exists, not
 * about the invitation flow itself (that's covered separately).
 */
export async function createUserAndLogin({ organizationId, slug, role = ROLES.EMPLOYEE, ...fields }) {
  const email = fields.email || `${role.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const password = 'Password123';
  const passwordHash = await User.hashPassword(password);

  const user = await User.create({
    organizationId,
    email,
    passwordHash,
    role,
    firstName: fields.firstName || role,
    lastName: fields.lastName || 'Test',
    status: 'ACTIVE',
    joiningDate: new Date(),
    managerId: fields.managerId,
    departmentId: fields.departmentId,
    teamId: fields.teamId,
  });

  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ organizationSlug: slug, email, password });
  if (loginRes.status !== 200) {
    throw new Error(`login failed for test user: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  return { user, accessToken: loginRes.body.data.accessToken };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

export { app };
