import axiosClient from '../api/axiosClient.js';

export async function listProjects() {
  const { data } = await axiosClient.get('/projects');
  return data.data.projects;
}

export async function getProject(id) {
  const { data } = await axiosClient.get(`/projects/${id}`);
  return data.data.project;
}

export async function createProject(payload) {
  const { data } = await axiosClient.post('/projects', payload);
  return data.data.project;
}

export async function updateProject(id, updates) {
  const { data } = await axiosClient.patch(`/projects/${id}`, updates);
  return data.data.project;
}

export async function deleteProject(id) {
  await axiosClient.delete(`/projects/${id}`);
}

export async function listProjectTasks(projectId) {
  const { data } = await axiosClient.get(`/projects/${projectId}/tasks`);
  return data.data.tasks;
}

export async function createTask(projectId, payload) {
  const { data } = await axiosClient.post(`/projects/${projectId}/tasks`, payload);
  return data.data.task;
}

export async function listMyTasks() {
  const { data } = await axiosClient.get('/tasks/me');
  return data.data.tasks;
}

export async function updateTask(id, updates) {
  const { data } = await axiosClient.patch(`/tasks/${id}`, updates);
  return data.data.task;
}

export async function deleteTask(id) {
  await axiosClient.delete(`/tasks/${id}`);
}
