import axios from 'axios';

// Dynamically determine the base URL:
// In production (Vercel, Render), VITE_API_URL specifies the deployed backend origin.
// In local development, defaults to '/api' which Vite proxies to http://localhost:5000.
const getBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl.replace(/\/$/, '')}/api`;
  }
  // Native Capacitor WebView fallback to production backend
  if (typeof window !== 'undefined' && (window.location.protocol === 'capacitor:' || (window.location.hostname === 'localhost' && !window.location.port))) {
    return 'https://nexa-backend.onrender.com/api';
  }
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
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
