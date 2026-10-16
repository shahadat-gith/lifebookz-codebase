import api from '../config/api';

// Story API methods — one flat document per story.
// All payloads are JSON — files upload straight to R2 via presigned URLs
// (POST /uploads/presign) and only their { url, key } travel in the body.
export async function create(data) {
  const res = await api.post('/stories', data);
  return res.data.data;
}

export async function update(storyId, data) {
  const res = await api.patch(`/stories/${storyId}`, data);
  return res.data.data;
}

export async function publish(storyId, data = {}) {
  const res = await api.post(`/stories/${storyId}/publish`, data);
  return res.data.data;
}

export async function unpublish(storyId) {
  const res = await api.post(`/stories/${storyId}/unpublish`);
  return res.data.data;
}

export async function remove(storyId) {
  const res = await api.delete(`/stories/${storyId}`);
  return res.data;
}

// Author-specific API
export async function getMyStories() {
  const res = await api.get('/authors/me/stories');
  return res.data.data;
}

export async function getMyStorySummaries() {
  const res = await api.get('/authors/me/stories/summaries');
  return res.data.data;
}

export async function getMyStats() {
  const res = await api.get('/authors/me/stats');
  return res.data.data;
}

export async function getMyStory(storyId) {
  const res = await api.get(`/authors/me/stories/${storyId}`);
  return res.data.data;
}

// Media upload moved to presigned direct-to-R2 uploads — see
// components/story/AddMediaStep.jsx (photos & videos only, no server pass-through).

export default api;
