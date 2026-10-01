import { Capacitor } from '@capacitor/core';

/**
 * Checks if the application is currently running inside a native Capacitor environment (Android / iOS).
 */
export const isCapacitorNative = () => {
  if (typeof window === 'undefined') return false;
  try {
    if (Capacitor?.isNativePlatform && Capacitor.isNativePlatform()) return true;
    if (window.Capacitor?.isNativePlatform?.()) return true;
  } catch (e) {
    // Ignore error in non-native contexts
  }
  if (window.location.protocol === 'capacitor:' || window.location.protocol === 'ionic:') return true;
  // Capacitor Android with androidScheme "https" or "http" runs on localhost with no port
  if (window.location.hostname === 'localhost' && !window.location.port) return true;
  return false;
};

/**
 * Checks if the application is running in local development mode (e.g. Vite dev server on port 5173).
 */
export const isLocalDev = () => {
  if (typeof window === 'undefined') return false;
  if (isCapacitorNative()) return false;
  if (import.meta.env.DEV) return true;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return Boolean(window.location.port && window.location.port !== '80' && window.location.port !== '443');
  }
  return false;
};

/**
 * Returns the backend origin (without /api suffix and without trailing slash).
 * Production default: https://nexa-backend.onrender.com
 */
export const getBackendOrigin = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() && !envUrl.startsWith('/')) {
    return envUrl.trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  if (isLocalDev()) {
    return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  }
  // Production default for Capacitor Android APK & Vercel production web deployment
  return 'https://nexa-backend.onrender.com';
};

/**
 * Returns the REST API Base URL (always ending with /api).
 * Production Android / Vercel: https://nexa-backend.onrender.com/api
 * Local Vite Dev: /api
 */
export const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const trimmed = envUrl.trim().replace(/\/$/, '');
    return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
  }
  if (isLocalDev()) {
    return '/api';
  }
  // Production default for Capacitor Android APK & Vercel production web deployment
  return 'https://nexa-backend.onrender.com/api';
};

/**
 * Returns the Socket.IO server connection URL (origin only, never ending in /api).
 * Production Android / Vercel: https://nexa-backend.onrender.com
 * Local Vite Dev: window.location.origin (e.g. http://localhost:5173)
 */
export const getSocketServerUrl = () => {
  return getBackendOrigin();
};

/**
 * Resolves static media URLs (like /uploads/...) to absolute URLs in production.
 */
export const resolveMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('/')) {
    if (isLocalDev()) {
      return url;
    }
    return `${getBackendOrigin()}${url}`;
  }
  return url;
};
