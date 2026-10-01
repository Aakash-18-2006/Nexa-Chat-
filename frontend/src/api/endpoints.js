import api from './axiosClient';

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verify2FA: (data) => api.post('/auth/verify-2fa', data),
  setup2FA: (data) => api.post('/auth/2fa/setup', data),
  confirm2FA: (data) => api.post('/auth/2fa/confirm', data),
  disable2FA: (data) => api.post('/auth/2fa/disable', data),
  regenerateRecoveryCodes: (data) => api.post('/auth/2fa/regenerate-recovery-codes', data),
  getSessions: () => api.get('/auth/sessions'),
  revokeSession: (data) => api.post('/auth/sessions/revoke', data),
  logoutAllDevices: () => api.post('/auth/sessions/logout-all'),
  verifyEmail: (token) => api.get(`/auth/verify-email/${encodeURIComponent(token)}`),
  resendVerification: (data) => api.post('/auth/resend-verification', data),
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  validateResetToken: (token) => api.get(`/auth/reset-password/${encodeURIComponent(token)}`),
  resetPassword: (data) => api.post('/auth/reset-password', data)
};

export const accountApi = {
  getAccountInfo: () => api.get('/account/info'),
  requestEmailChange: (data) => api.post('/account/change-email', data),
  validateEmailChangeToken: (token) => api.get(`/account/confirm-email-change/${encodeURIComponent(token)}`),
  confirmEmailChange: (data) => api.post('/account/confirm-email-change', data),
  checkUsername: (username) => api.get(`/users/check-username?username=${encodeURIComponent(username)}`),
  changeUsername: (data) => api.post('/account/change-username', data)
};

export const userApi = {
  searchUsers: (q, config = {}) => api.get(`/users/search?q=${encodeURIComponent(q)}`, config),
  getProfile: (id) => api.get(`/users/${id}`),
  checkUsername: (username) => api.get(`/users/check-username?username=${encodeURIComponent(username)}`)
};

export const chatApi = {
  getConversations: () => api.get('/conversations'),
  getDirectConversation: (participantId) => api.post('/conversations/direct', { participantId }),
  getConversationById: (id) => api.get(`/conversations/${id}`),
  pinConversation: (id) => api.post(`/conversations/${id}/pin`),
  deleteConversation: (id) => api.delete(`/conversations/${id}`),
  deleteMultipleConversations: (conversationIds) => api.post('/conversations/delete-multiple', { conversationIds }),
  pinMessage: (conversationId, messageId) => api.post(`/conversations/${conversationId}/pin/${messageId}`),
  unpinMessage: (conversationId, messageId) => api.delete(`/conversations/${conversationId}/pin/${messageId}`),

  getMessages: (conversationId, page = 1, limit = 40) =>
    api.get(`/messages/${conversationId}?page=${page}&limit=${limit}`),
  sendMessage: (data) => api.post('/messages', data),
  editMessage: (id, content) => api.put(`/messages/${id}`, { content }),
  deleteMessage: (id) => api.delete(`/messages/${id}`),
  reactToMessage: (id, emoji) => api.post(`/messages/${id}/react`, { emoji }),
  markAsRead: (conversationId) => api.post(`/messages/${conversationId}/read`),
  getConversationMedia: (conversationId) => api.get(`/messages/${conversationId}/media`)
};

export const groupApi = {
  createGroup: (data) => api.post('/groups', data),
  updateGroup: (id, data) => api.put(`/groups/${id}`, data),
  addMembers: (id, memberIds) => api.post(`/groups/${id}/members`, { memberIds }),
  removeMember: (id, memberId) => api.delete(`/groups/${id}/members/${memberId}`),
  leaveGroup: (id) => api.post(`/groups/${id}/leave`),
  toggleAdmin: (id, memberId, action) => api.put(`/groups/${id}/admins`, { memberId, action })
};

export const tempRoomApi = {
  createRoom: (data) => api.post('/temp-rooms', data),
  joinRoom: (code) => api.post('/temp-rooms/join', { code }),
  getRoom: (code) => api.get(`/temp-rooms/${code}`),
  sendRoomMessage: (code, data) => api.post(`/temp-rooms/${code}/messages`, data),
  closeRoom: (code) => api.delete(`/temp-rooms/${code}`)
};

export const aiApi = {
  chat: (data) => api.post('/ai/chat', data),
  getSuggestions: (conversationId) => api.post('/ai/suggest-replies', { conversationId }),
  summarizeChat: (conversationId) => api.post('/ai/summarize', { conversationId }),
  translateText: (data) => api.post('/ai/translate', data)
};

export const searchApi = {
  globalSearch: (q, config = {}) => api.get(`/search?q=${encodeURIComponent(q)}`, config)
};

export const notificationApi = {
  getNotifications: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  clearAll: () => api.delete('/notifications/clear-all')
};

export const followApi = {
  sendRequest: (targetUserId) => api.post('/follow/request', { targetUserId }),
  getIncomingRequests: () => api.get('/follow/requests/incoming'),
  acceptRequest: (requestId) => api.post(`/follow/request/${requestId}/accept`),
  declineRequest: (requestId) => api.post(`/follow/request/${requestId}/decline`),
  followBack: (targetUserId) => api.post('/follow/back', { targetUserId }),
  getStatus: (targetUserId) => api.get(`/follow/status/${targetUserId}`),
  unfollow: (targetUserId) => api.post('/follow/unfollow', { targetUserId }),
  block: (targetUserId) => api.post('/follow/block', { targetUserId }),
  unblock: (targetUserId) => api.post('/follow/unblock', { targetUserId }),
  getBlocked: () => api.get('/follow/blocked'),
  getFollowers: (userId) => api.get(`/follow/users/${userId}/followers`),
  getFollowing: (userId) => api.get(`/follow/users/${userId}/following`)
};

export const mediaApi = {
  uploadFile: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
  }
};

export const callApi = {
  getHistory: (conversationId) => api.get(`/calls/history/${conversationId}`),
  getDetails: (callId) => api.get(`/calls/${callId}`)
};

