import axiosClient from '../api/axiosClient.js';

export async function listAuditLogs(params = {}) {
  const { data } = await axiosClient.get('/audit-logs', { params });
  return data.data.logs;
}
