import axios from 'axios';

import { getApiBaseUrl } from '../utils/urlConfig';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercept requests to inject JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexa_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token.trim()}`;
  }
  return config;
});

// Intercept responses for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Never clear authentication session on AI or feature errors
      if (url.includes('/auth/') && !url.includes('/auth/me')) {
        localStorage.removeItem('nexa_token');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
