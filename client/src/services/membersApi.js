import axiosClient from '../api/axiosClient.js';

export async function listMembers(params = {}) {
  const { data } = await axiosClient.get('/members', { params });
  return data.data.members;
}

export async function getMember(id) {
  const { data } = await axiosClient.get(`/members/${id}`);
  return data.data.member;
}

export async function updateMember(id, updates) {
  const { data } = await axiosClient.patch(`/members/${id}`, updates);
  return data.data.member;
}

export async function offboardMember(id) {
  await axiosClient.post(`/members/${id}/offboard`);
}

export async function inviteMember(payload) {
  const { data } = await axiosClient.post('/members/invitations', payload);
  return data.data.invitation;
}

export async function listInvitations(status) {
  const { data } = await axiosClient.get('/members/invitations', { params: { status } });
  return data.data.invitations;
}

export async function revokeInvitation(id) {
  await axiosClient.delete(`/members/invitations/${id}`);
}

export async function acceptInvitation(payload) {
  const { data } = await axiosClient.post('/members/accept-invitation', payload);
  return data.data.user;
}

export async function listDepartments() {
  const { data } = await axiosClient.get('/departments');
  return data.data.departments;
}

export async function listTeams() {
  const { data } = await axiosClient.get('/teams');
  return data.data.teams;
}
