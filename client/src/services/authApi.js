import axiosClient from '../api/axiosClient.js';

export async function registerOrganization(payload) {
  const { data } = await axiosClient.post('/auth/register-organization', payload);
  return data.data;
}

export async function login(payload) {
  const { data } = await axiosClient.post('/auth/login', payload);
  return data.data;
}

export async function logout() {
  await axiosClient.post('/auth/logout');
}

export async function fetchCurrentUser() {
  const { data } = await axiosClient.get('/auth/me');
  return data.data.user;
}
