import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi } from '../api/endpoints';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('nexa_token') || null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('nexa_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const fetchMe = async () => {
      if (token) {
        try {
          const res = await authApi.getMe();
          if (res.data.success) {
            setUser(res.data.user);
          }
        } catch (err) {
          console.warn('[Auth] Session expired or invalid:', err);
          logout();
        }
      }
      setLoading(false);
    };

    fetchMe();
  }, [token, logout]);

  const login = useCallback(async (identifier, password) => {
    const res = await authApi.login({ identifier, password });
    if (res.data.success) {
      if (res.data.twoFactorRequired) {
        // Return 2FA challenge response without setting persistent session yet
        return res.data;
      }
      // Direct login succeeded
      localStorage.setItem('nexa_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data.message || 'Login failed');
  }, []);

  const verify2FA = useCallback(async ({ tempToken, code, isRecoveryCode = false }) => {
    const res = await authApi.verify2FA({ tempToken, code, isRecoveryCode });
    if (res.data.success && res.data.token) {
      localStorage.setItem('nexa_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data.message || 'Two-factor verification failed');
  }, []);

  const register = useCallback(async (formData) => {
    const res = await authApi.register(formData);
    if (res.data.success) {
      localStorage.setItem('nexa_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data;
    }
    throw new Error(res.data.message || 'Registration failed');
  }, []);

  const logoutAllDevices = useCallback(async () => {
    try {
      await authApi.logoutAllDevices();
    } catch (err) {
      console.error('[Auth] Logout all devices error:', err);
    } finally {
      localStorage.removeItem('nexa_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  const resendVerification = useCallback(async (email) => {
    const res = await authApi.resendVerification({ email });
    return res.data;
  }, []);

  const updateUser = useCallback((updatedUserData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedUserData } : updatedUserData));
  }, []);

  const contextValue = useMemo(() => ({
    user,
    token,
    loading,
    login,
    verify2FA,
    register,
    logout,
    logoutAllDevices,
    resendVerification,
    updateUser,
    isAuthenticated: !!user
  }), [
    user,
    token,
    loading,
    login,
    verify2FA,
    register,
    logout,
    logoutAllDevices,
    resendVerification,
    updateUser
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
