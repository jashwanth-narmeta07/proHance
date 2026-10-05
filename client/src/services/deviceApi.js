import axiosClient from '../api/axiosClient.js';

export async function registerDevice(payload) {
  const { data } = await axiosClient.post('/devices', payload);
  return data.data; // { device, deviceToken } - token shown once
}

export async function registerDeviceForEmployee(userId, payload) {
  const { data } = await axiosClient.post(`/devices/for-employee/${userId}`, payload);
  return data.data; // { device, deviceToken } - token shown once
}

export async function listMyDevices() {
  const { data } = await axiosClient.get('/devices/me');
  return data.data.devices;
}

export async function listOrganizationDevices() {
  const { data } = await axiosClient.get('/devices');
  return data.data.devices;
}

export async function revokeDevice(id, { selfRevoke = false } = {}) {
  await axiosClient.delete(`/devices/${id}${selfRevoke ? '/self-revoke' : ''}`);
}