import axiosClient from '../api/axiosClient.js';

export async function checkIn(deviceId) {
  const { data } = await axiosClient.post('/attendance/check-in', deviceId ? { deviceId } : {});
  return data.data;
}

export async function checkOut() {
  const { data } = await axiosClient.post('/attendance/check-out');
  return data.data;
}

export async function startBreak() {
  const { data } = await axiosClient.post('/attendance/break/start');
  return data.data.event;
}

export async function endBreak() {
  const { data } = await axiosClient.post('/attendance/break/end');
  return data.data.event;
}

export async function getToday() {
  const { data } = await axiosClient.get('/attendance/today');
  return data.data;
}

export async function getMyHistory(params = {}) {
  const { data } = await axiosClient.get('/attendance/me', { params });
  return data.data.records;
}

export async function getTeamAttendance(date) {
  const { data } = await axiosClient.get('/attendance/team', { params: date ? { date } : {} });
  return data.data.records;
}
