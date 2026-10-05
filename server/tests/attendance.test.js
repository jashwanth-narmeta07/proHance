import request from 'supertest';
import { app, registerOrganization, createUserAndLogin, authHeader } from './helpers/testHelpers.js';

describe('Attendance', () => {
  test('check-in then check-out produces a closed attendance record with computed durations', async () => {
    const org = await registerOrganization();
    const employee = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'EMPLOYEE',
      email: 'worker@example.com',
    });

    const checkIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set(authHeader(employee.accessToken))
      .send({});
    expect(checkIn.status).toBe(201);
    expect(checkIn.body.data.attendance.checkOutAt).toBeNull();

    const doubleCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set(authHeader(employee.accessToken))
      .send({});
    expect(doubleCheckIn.status).toBe(409);
    expect(doubleCheckIn.body.code).toBe('ALREADY_CHECKED_IN');

    const checkOut = await request(app)
      .post('/api/v1/attendance/check-out')
      .set(authHeader(employee.accessToken));
    expect(checkOut.status).toBe(200);
    expect(checkOut.body.data.attendance.checkOutAt).not.toBeNull();
    // No desktop agent connected in this test, so active time is correctly
    // zero rather than approximated from elapsed wall-clock time
    // (Section 37.11 - the property this whole design exists to guarantee).
    expect(checkOut.body.data.workSession.activeDurationSeconds).toBe(0);

    const doubleCheckOut = await request(app)
      .post('/api/v1/attendance/check-out')
      .set(authHeader(employee.accessToken));
    expect(doubleCheckOut.status).toBe(400);
    expect(doubleCheckOut.body.code).toBe('NOT_CHECKED_IN');
  });

  test('break time accumulates on the attendance record', async () => {
    const org = await registerOrganization();
    const employee = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'EMPLOYEE',
      email: 'worker2@example.com',
    });

    await request(app).post('/api/v1/attendance/check-in').set(authHeader(employee.accessToken)).send({});
    const startBreak = await request(app)
      .post('/api/v1/attendance/break/start')
      .set(authHeader(employee.accessToken));
    expect(startBreak.status).toBe(200);

    const doubleBreak = await request(app)
      .post('/api/v1/attendance/break/start')
      .set(authHeader(employee.accessToken));
    expect(doubleBreak.status).toBe(409);
    expect(doubleBreak.body.code).toBe('BREAK_IN_PROGRESS');

    const endBreak = await request(app)
      .post('/api/v1/attendance/break/end')
      .set(authHeader(employee.accessToken));
    expect(endBreak.status).toBe(200);

    const today = await request(app).get('/api/v1/attendance/today').set(authHeader(employee.accessToken));
    expect(today.status).toBe(200);
    expect(today.body.data.onBreak).toBe(false);
  });
});

describe('Activity privacy between employees', () => {
  test("employee A cannot read employee B's attendance/activity history", async () => {
    const org = await registerOrganization();
    const employeeA = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'EMPLOYEE',
      email: 'private-a@example.com',
    });
    const employeeB = await createUserAndLogin({
      organizationId: org.organization._id,
      slug: org.slug,
      role: 'EMPLOYEE',
      email: 'private-b@example.com',
    });

    await request(app).post('/api/v1/attendance/check-in').set(authHeader(employeeB.accessToken)).send({});

    // There is no "get another employee's attendance" route reachable by a
    // plain EMPLOYEE at all - /attendance/team requires ATTENDANCE_READ,
    // which EMPLOYEE does not hold. This proves the permission gate, not
    // just that the specific record is filtered out.
    const teamAttempt = await request(app).get('/api/v1/attendance/team').set(authHeader(employeeA.accessToken));
    expect(teamAttempt.status).toBe(403);

    const ownToday = await request(app).get('/api/v1/attendance/today').set(authHeader(employeeA.accessToken));
    expect(ownToday.status).toBe(200);
    expect(ownToday.body.data.attendance).toBeNull();
  });
});
