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
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses for auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Don't auto-redirect if checking auth status
      if (!error.config?.url?.includes('/auth/me')) {
        localStorage.removeItem('nexa_token');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
