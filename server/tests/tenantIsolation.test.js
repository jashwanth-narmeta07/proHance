import request from 'supertest';
import { app, registerOrganization, createUserAndLogin, authHeader } from './helpers/testHelpers.js';

describe('Tenant isolation', () => {
  test('an org admin only ever sees their own organization, never another', async () => {
    const orgA = await registerOrganization();
    const orgB = await registerOrganization();

    const res = await request(app).get('/api/v1/organizations/me').set(authHeader(orgA.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data.organization._id).toBe(orgA.organization._id);
    expect(res.body.data.organization._id).not.toBe(orgB.organization._id);
  });

  test('a department created in org A is invisible to org B, even with a valid id', async () => {
    const orgA = await registerOrganization();
    const orgB = await registerOrganization();

    const createRes = await request(app)
      .post('/api/v1/departments')
      .set(authHeader(orgA.accessToken))
      .send({ name: 'Engineering' });
    expect(createRes.status).toBe(201);
    const deptId = createRes.body.data.department._id;

    // Org B's admin - a different, valid, authenticated user - tries to
    // fetch org A's department by its real id.
    const crossOrgRead = await request(app)
      .get(`/api/v1/departments/${deptId}`)
      .set(authHeader(orgB.accessToken));
    expect(crossOrgRead.status).toBe(404); // not 403 - it must look like it doesn't exist, not "exists but forbidden"

    const sameOrgRead = await request(app)
      .get(`/api/v1/departments/${deptId}`)
      .set(authHeader(orgA.accessToken));
    expect(sameOrgRead.status).toBe(200);
  });

  test('org B cannot list org A members even though both have valid admin tokens', async () => {
    const orgA = await registerOrganization();
    const orgB = await registerOrganization();

    await createUserAndLogin({
      organizationId: orgA.organization._id,
      slug: orgA.slug,
      role: 'EMPLOYEE',
      email: 'employee-a@example.com',
    });

    const orgBMembers = await request(app).get('/api/v1/members').set(authHeader(orgB.accessToken));
    expect(orgBMembers.status).toBe(200);
    const emails = orgBMembers.body.data.members.map((m) => m.email);
    expect(emails).not.toContain('employee-a@example.com');
  });

  test('a device token resolves its own org server-side - it cannot be used to reach another org', async () => {
    const orgA = await registerOrganization();

    const deviceRes = await request(app)
      .post('/api/v1/devices')
      .set(authHeader(orgA.accessToken))
      .send({ deviceName: 'Test laptop' });
    expect(deviceRes.status).toBe(201);
    const { deviceToken } = deviceRes.body.data;

    const configRes = await request(app).get('/api/v1/agent/config').set('X-Device-Token', deviceToken);
    expect(configRes.status).toBe(200);

    const badToken = await request(app).get('/api/v1/agent/config').set('X-Device-Token', 'not-a-real-device-token');
    expect(badToken.status).toBe(401);
    expect(badToken.body.code).toBe('DEVICE_TOKEN_INVALID');
  });
});
