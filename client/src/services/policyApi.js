import axiosClient from '../api/axiosClient.js';

export async function getPolicy() {
  const { data } = await axiosClient.get('/policies');
  return data.data.policy;
}

export async function updatePolicy(updates) {
  const { data } = await axiosClient.patch('/policies', updates);
  return data.data.policy;
}
