import api from '../config/api';

export const adminApi = {
  login: (data) => api.post('/admin/login', data),
  logout: () => api.post('/admin/logout'),
  getDashboard: () => api.get('/admin/dashboard'),
  // Authors have no approval pipeline — list only (they self-upgrade).
  getApprovedAuthors: () => api.get('/admin/authors/approved'),
  getPendingExperts: () => api.get('/admin/experts/pending'),
  getApprovedExperts: () => api.get('/admin/experts/approved'),
  approveExpert: (expertId) => api.patch(`/admin/experts/${expertId}/approve`),
  rejectExpert: (expertId, reason) => api.patch(`/admin/experts/${expertId}/reject`, { reason }),
  getUsers: () => api.get('/admin/users'),
  setUserStatus: (userId, status) => api.patch(`/admin/users/${userId}/status`, { status }),
  getStories: () => api.get('/admin/stories'),
  setStoryFeatured: (storyId, featured) => api.patch(`/admin/stories/${storyId}/featured`, { featured }),
  unpublishStory: (storyId) => api.patch(`/admin/stories/${storyId}/unpublish`),
  deleteStory: (storyId) => api.delete(`/admin/stories/${storyId}`),
};

export default api;
