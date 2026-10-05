import axiosClient from '../api/axiosClient.js';

export async function listDepartments() {
  const { data } = await axiosClient.get('/departments');
  return data.data.departments;
}

export async function getDepartment(id) {
  const { data } = await axiosClient.get(`/departments/${id}`);
  return data.data.department;
}

export async function createDepartment(payload) {
  const { data } = await axiosClient.post('/departments', payload);
  return data.data.department;
}

export async function updateDepartment(id, updates) {
  const { data } = await axiosClient.patch(`/departments/${id}`, updates);
  return data.data.department;
}

export async function deleteDepartment(id) {
  await axiosClient.delete(`/departments/${id}`);
}
