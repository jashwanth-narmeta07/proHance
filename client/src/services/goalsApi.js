import axiosClient from '../api/axiosClient.js';

export async function listGoals() {
  const { data } = await axiosClient.get('/goals');
  return data.data.goals;
}

export async function createGoal(payload) {
  const { data } = await axiosClient.post('/goals', payload);
  return data.data.goal;
}

export async function updateGoal(id, updates) {
  const { data } = await axiosClient.patch(`/goals/${id}`, updates);
  return data.data.goal;
}

export async function deleteGoal(id) {
  await axiosClient.delete(`/goals/${id}`);
}

export async function getGoalProgress() {
  const { data } = await axiosClient.get('/goals/progress');
  return data.data.goals;
}
