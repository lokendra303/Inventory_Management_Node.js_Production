import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import apiClient from '../api/apiClient';
import { deleteItem, getItem, KEYS, setItem } from '../api/storage';

const AuthContext = createContext(null);
const REFRESH_MS = 4 * 60 * 1000;

function getTokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef(null);
  const refreshing = useRef(false);

  const clearSession = useCallback(async () => {
    await deleteItem(KEYS.token);
    await deleteItem(KEYS.user);
    await deleteItem(KEYS.institutionId);
    apiClient.setAuthToken(null);
    setUser(null);
    if (refreshTimer.current) clearInterval(refreshTimer.current);
  }, []);

  const persistSession = useCallback(async (token, userData) => {
    await setItem(KEYS.token, token);
    await setItem(KEYS.user, JSON.stringify(userData));
    if (userData?.institutionId) await setItem(KEYS.institutionId, String(userData.institutionId));
    apiClient.setAuthToken(token);
    setUser({ ...userData, token });
  }, []);

  const refreshSession = useCallback(async () => {
    if (refreshing.current) return;
    const token = await getItem(KEYS.token);
    if (!token) return;
    refreshing.current = true;
    try {
      apiClient.setAuthToken(token);
      const res = await apiClient.post('/auth/refresh');
      if (res?.success && res?.data?.token) {
        const nextUser = user || JSON.parse((await getItem(KEYS.user)) || 'null');
        await persistSession(res.data.token, nextUser || {});
      }
    } catch (err) {
      if (err.response?.status === 429) return;
      await clearSession();
    } finally {
      refreshing.current = false;
    }
  }, [clearSession, persistSession, user]);

  const loadSession = useCallback(async () => {
    try {
      const token = await getItem(KEYS.token);
      if (!token) return;
      apiClient.setAuthToken(token);
      const res = await apiClient.get('/auth/profile');
      if (res?.success && res?.data) {
        await persistSession(token, res.data);
        const expiresAt = getTokenExpiresAt(token);
        if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000) {
          await refreshSession();
        }
      } else {
        await clearSession();
      }
    } catch {
      await clearSession();
    }
  }, [clearSession, persistSession, refreshSession]);

  useEffect(() => {
    (async () => {
      await loadSession();
      setLoading(false);
    })();
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [loadSession]);

  useEffect(() => {
    if (!user?.token) return undefined;
    refreshTimer.current = setInterval(() => {
      refreshSession();
    }, REFRESH_MS);
    return () => clearInterval(refreshTimer.current);
  }, [user?.token, refreshSession]);

  const login = async ({ email, password, institutionId }) => {
    try {
      const res = await apiClient.post('/auth/login', { email, password, institutionId });
      if (res?.success && res?.data?.requiresOtp) {
        return {
          success: true,
          otpRequired: true,
          email: res.data.email,
          institutionId: res.data.institutionId,
        };
      }
      if (res?.success && res?.data?.token && res?.data?.user) {
        await persistSession(res.data.token, res.data.user);
        return { success: true, otpRequired: false };
      }
      return { success: false, error: res?.error || 'Login failed' };
    } catch (err) {
      if (err.response?.status === 429) {
        return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
      }
      if (!err.response) {
        const msg = err.message || '';
        if (msg === 'Network Error' || msg.includes('Network')) {
          return {
            success: false,
            error:
              'Cannot reach the API server. Ensure Backend is running on port 5000, then refresh this page. (Expo web must be allowed in CORS — use localhost:8081 or restart backend after the latest config update.)',
          };
        }
      }
      return { success: false, error: err.response?.data?.error || err.message || 'Login failed' };
    }
  };

  const verifyLoginOtp = async (email, otp, institutionId) => {
    try {
      const res = await apiClient.post('/auth/verify-otp', { email, otp, institutionId });
      if (res?.success && res?.data?.token && res?.data?.user) {
        await persistSession(res.data.token, res.data.user);
        return { success: true };
      }
      return { success: false, error: res?.error || 'OTP verification failed' };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'OTP verification failed' };
    }
  };

  const logout = async () => {
    await clearSession();
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user?.token),
    login,
    verifyLoginOtp,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
