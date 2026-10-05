import axiosClient from '../api/axiosClient.js';

export async function listTeams() {
  const { data } = await axiosClient.get('/teams');
  return data.data.teams;
}

export async function getTeam(id) {
  const { data } = await axiosClient.get(`/teams/${id}`);
  return data.data.team;
}

export async function listTeamMembers(id) {
  const { data } = await axiosClient.get(`/teams/${id}/members`);
  return data.data.members;
}

export async function createTeam(payload) {
  const { data } = await axiosClient.post('/teams', payload);
  return data.data.team;
}

export async function updateTeam(id, updates) {
  const { data } = await axiosClient.patch(`/teams/${id}`, updates);
  return data.data.team;
}

export async function deleteTeam(id) {
  await axiosClient.delete(`/teams/${id}`);
}
