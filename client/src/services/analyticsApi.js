import axiosClient from '../api/axiosClient.js';

export async function getMySummary(params = {}) {
  const { data } = await axiosClient.get('/analytics/me', { params });
  return data.data.summary;
}

export async function getMyTrend() {
  const { data } = await axiosClient.get('/analytics/me/trend');
  return data.data;
}

export async function getMyTopApps(params = {}) {
  const { data } = await axiosClient.get('/analytics/me/top-apps', { params });
  return data.data.topApps;
}

export async function getTeamSummary(params = {}) {
  const { data } = await axiosClient.get('/analytics/team', { params });
  return data.data.members;
}

export async function getTeamTrend() {
  const { data } = await axiosClient.get('/analytics/team/trend');
  return data.data;
}

export async function getTeamTopApps(params = {}) {
  const { data } = await axiosClient.get('/analytics/team/top-apps', { params });
  return data.data.topApps;
}

export async function getOrganizationSummary(params = {}) {
  const { data } = await axiosClient.get('/analytics/organization', { params });
  return data.data;
}

export async function getOrganizationTrend() {
  const { data } = await axiosClient.get('/analytics/organization/trend');
  return data.data;
}

export async function getOrganizationEmployeeBreakdown(params = {}) {
  const { data } = await axiosClient.get('/analytics/organization/employees', { params });
  return data.data.employees;
}

export async function getOrganizationTopApps(params = {}) {
  const { data } = await axiosClient.get('/analytics/organization/top-apps', { params });
  return data.data.topApps;
}

export async function getEmployeeTopApps(userId, params = {}) {
  const { data } = await axiosClient.get(`/analytics/organization/employees/${userId}/top-apps`, { params });
  return data.data.topApps;
}

/**
 * One employee's full stat card set (Active/Meeting/Break/Idle +
 * Attendance days/Late/Overtime/Absences). Works for HR/Admin viewing any
 * employee, or a manager viewing one of their own team members - the
 * server enforces which is allowed. Pass {from, to} to drill into a single
 * selected date instead of the caller's default range.
 */
export async function getEmployeeOverview(userId, params = {}) {
  const { data } = await axiosClient.get(`/analytics/employees/${userId}`, { params });
  return data.data;
}

/**
 * The CSV endpoint requires the same Bearer-token auth as every other API
 * call (see middleware/auth.js), so it's fetched through the normal axios
 * instance - which already attaches the header and handles token refresh -
 * and then turned into a browser download from the response Blob, rather
 * than navigating to a URL that can't carry an Authorization header.
 */
export async function downloadAttendanceReport(params = {}) {
  const response = await axiosClient.get('/reports/attendance.csv', {
    params,
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `attendance-report-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}