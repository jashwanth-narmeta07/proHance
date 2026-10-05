import request from 'supertest';
import { app, registerOrganization } from './helpers/testHelpers.js';

describe('Auth', () => {
  test('registers an organization and its admin atomically', async () => {
    const { organization, user, accessToken } = await registerOrganization();
    expect(organization.slug).toBeDefined();
    expect(user.role).toBe('ORGANIZATION_ADMIN');
    expect(accessToken).toBeDefined();
    // Password hash must never be present in any API response.
    expect(user.passwordHash).toBeUndefined();
  });

  test('rejects a duplicate organization slug', async () => {
    const { payload } = await registerOrganization();
    const res = await request(app).post('/api/v1/auth/register-organization').send(payload);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SLUG_TAKEN');
  });

  test('logs in with correct credentials and rejects incorrect ones', async () => {
    const { payload } = await registerOrganization();
    const goodLogin = await request(app).post('/api/v1/auth/login').send({
      organizationSlug: payload.organization.slug,
      email: payload.admin.email,
      password: payload.admin.password,
    });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.body.data.accessToken).toBeDefined();

    const badLogin = await request(app).post('/api/v1/auth/login').send({
      organizationSlug: payload.organization.slug,
      email: payload.admin.email,
      password: 'WrongPassword123',
    });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.code).toBe('INVALID_CREDENTIALS');
  });

  test('refresh token issues a new access token, and logout revokes it', async () => {
    const { payload, refreshToken } = await registerOrganization();

    const refreshed = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toBeDefined();

    const login = await request(app).post('/api/v1/auth/login').send({
      organizationSlug: payload.organization.slug,
      email: payload.admin.email,
      password: payload.admin.password,
    });

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
      .expect(200);

    // The refresh token issued before logout must now be rejected -
    // logout bumps refreshTokenVersion, invalidating all outstanding
    // refresh tokens for that user (Section 25: session management).
    const staleRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.data.refreshToken });
    expect(staleRefresh.status).toBe(401);
    expect(staleRefresh.body.code).toBe('REFRESH_TOKEN_REVOKED');
  });

  test('rejects requests with no token, and with a malformed token', async () => {
    const noToken = await request(app).get('/api/v1/auth/me');
    expect(noToken.status).toBe(401);

    const badToken = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(badToken.status).toBe(401);
  });
});
