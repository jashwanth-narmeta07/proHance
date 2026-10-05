import request from 'supertest';
import { app, registerOrganization, createUserAndLogin, authHeader } from './helpers/testHelpers.js';

describe('RBAC', () => {
  test('manager A cannot manage a team belonging to manager B', async () => {
    const org = await registerOrganization();

    const deptRes = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(org.accessToken))
      .send({ name: 'Engineering' });
    const departmentId = deptRes.body.data.department._id;

    const managerA = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'MANAGER',
      email: 'manager-a@example.com',
    });
    const managerB = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'MANAGER',
      email: 'manager-b@example.com',
    });

    const teamRes = await request(app)
      .post('/api/v1/teams')
      .set(authHeader(org.accessToken)) // team creation is admin/HR-only
      .send({ name: 'Backend', departmentId, managerId: managerB.user._id.toString() });
    expect(teamRes.status).toBe(201);
    const teamId = teamRes.body.data.team._id;

    // Manager A (not the owner) tries to rename manager B's team.
    const crossManagerUpdate = await request(app)
      .patch(`/api/v1/teams/${teamId}`)
      .set(authHeader(managerA.accessToken))
      .send({ name: 'Hijacked Team Name' });
    expect(crossManagerUpdate.status).toBe(403);
    expect(crossManagerUpdate.body.code).toBe('NOT_TEAM_MANAGER');

    // Manager B, the actual owner, can.
    const ownerUpdate = await request(app)
      .patch(`/api/v1/teams/${teamId}`)
      .set(authHeader(managerB.accessToken))
      .send({ name: 'Backend Team' });
    expect(ownerUpdate.status).toBe(200);
  });

  test('an employee cannot approve their own leave request', async () => {
    const org = await registerOrganization();
    const employee = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'EMPLOYEE',
      email: 'employee@example.com',
    });

    const createRes = await request(app)
      .post('/api/v1/requests')
      .set(authHeader(employee.accessToken))
      .send({ type: 'LEAVE', title: 'Leave on Friday', description: 'Personal' });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.request._id;

    const approveAttempt = await request(app)
      .post(`/api/v1/requests/${requestId}/approve`)
      .set(authHeader(employee.accessToken))
      .send({});
    expect(approveAttempt.status).toBe(403);
  });

  test('HR cannot escalate a member to ORGANIZATION_ADMIN or HR', async () => {
    const org = await registerOrganization();
    const hr = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'HR',
      email: 'hr@example.com',
    });
    const employee = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'EMPLOYEE',
      email: 'employee2@example.com',
    });

    const escalateToAdmin = await request(app)
      .patch(`/api/v1/members/${employee.user._id}`)
      .set(authHeader(hr.accessToken))
      .send({ role: 'ORGANIZATION_ADMIN' });
    expect(escalateToAdmin.status).toBe(403);
    expect(escalateToAdmin.body.code).toBe('ROLE_ESCALATION_BLOCKED');

    // HR can still make a legitimate, non-escalating role change.
    const legitChange = await request(app)
      .patch(`/api/v1/members/${employee.user._id}`)
      .set(authHeader(hr.accessToken))
      .send({ role: 'MANAGER' });
    expect(legitChange.status).toBe(200);
  });

  test('an employee cannot read the organization-wide device list', async () => {
    const org = await registerOrganization();
    const employee = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'EMPLOYEE',
      email: 'employee3@example.com',
    });

    const res = await request(app).get('/api/v1/devices').set(authHeader(employee.accessToken));
    expect(res.status).toBe(403);
  });
});
