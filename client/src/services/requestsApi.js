import axiosClient from '../api/axiosClient.js';

export const REQUEST_TYPES = [
  'LEAVE',
  'ATTENDANCE_CORRECTION',
  'WORK_FROM_HOME',
  'OVERTIME',
  'SHIFT_CHANGE',
  'IDLE_TIME_JUSTIFICATION',
  'PROFILE_CHANGE',
  'GENERAL',
];

export async function createRequest(payload) {
  const { data } = await axiosClient.post('/requests', payload);
  return data.data.request;
}

export async function listMyRequests() {
  const { data } = await axiosClient.get('/requests/me');
  return data.data.requests;
}

export async function listForReview(status) {
  const { data } = await axiosClient.get('/requests/for-review', { params: status ? { status } : {} });
  return data.data.requests;
}

export async function getRequest(id) {
  const { data } = await axiosClient.get(`/requests/${id}`);
  return data.data.request;
}

export async function approveRequest(id, comment) {
  const { data } = await axiosClient.post(`/requests/${id}/approve`, { comment });
  return data.data.request;
}

export async function rejectRequest(id, comment) {
  const { data } = await axiosClient.post(`/requests/${id}/reject`, { comment });
  return data.data.request;
}
