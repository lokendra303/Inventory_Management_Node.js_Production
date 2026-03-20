import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { message, Modal } from 'antd';
import apiService from '../services/apiService';

const AuthContext = createContext();

const TOKEN_REFRESH_INTERVAL = parseInt(process.env.REACT_APP_TOKEN_REFRESH_INTERVAL); // 13 minutes
const INACTIVITY_TIMEOUT = parseInt(process.env.REACT_APP_INACTIVITY_TIMEOUT);         // 30 minutes
const ACTIVITY_THROTTLE = parseInt(process.env.REACT_APP_ACTIVITY_THROTTLE);           // 30 seconds

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionCheckRef = useRef(null);
  const tokenRefreshRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lastActivityWriteRef = useRef(0);
  const isRefreshingRef = useRef(false);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    // Throttle sessionStorage writes
    if (now - lastActivityWriteRef.current > ACTIVITY_THROTTLE) {
      sessionStorage.setItem('lastActivity', now.toString());
      lastActivityWriteRef.current = now;
    }
  }, []);

  const refreshToken = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const response = await apiService.post('/auth/extend-session');
      if (response.success && response.data?.token) {
        const newToken = response.data.token;
        sessionStorage.setItem('token', newToken);
        apiService.setAuthToken(newToken);
        setUser(prev => prev ? { ...prev, token: newToken } : prev);
      }
    } catch (error) {
      // Silently ignore — inactivity check will handle actual expiry
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('lastActivity');
    sessionStorage.removeItem('institutionId');
    apiService.setAuthToken(null);
    setUser(null);
    clearInterval(sessionCheckRef.current);
    clearInterval(tokenRefreshRef.current);
  }, []);

  const showSessionExpiredModal = useCallback(() => {
    logout();
    Modal.warning({
      title: 'Session Expired',
      content: 'Your session has expired due to inactivity. Please login again.',
      okText: 'Login',
      onOk: () => { window.location.href = '/'; },
      centered: true,
      maskClosable: false,
    });
  }, [logout]);

  const setupSessionManagement = useCallback(() => {
    // Clear any existing intervals
    clearInterval(sessionCheckRef.current);
    clearInterval(tokenRefreshRef.current);

    // Activity events — update lastActivity on any user interaction
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    // Check inactivity every minute
    sessionCheckRef.current = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > INACTIVITY_TIMEOUT) {
        showSessionExpiredModal();
      }
    }, 60 * 1000);

    // Proactively refresh JWT every 13 minutes while user is logged in
    tokenRefreshRef.current = setInterval(() => {
      // Only refresh if user was active in the last TOKEN_REFRESH_INTERVAL window
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity < INACTIVITY_TIMEOUT) {
        refreshToken();
      }
    }, TOKEN_REFRESH_INTERVAL);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(sessionCheckRef.current);
      clearInterval(tokenRefreshRef.current);
    };
  }, [updateActivity, refreshToken, showSessionExpiredModal]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await apiService.get('/auth/profile');
      if (response.success) {
        if (response.data.institutionId) {
          sessionStorage.setItem('institutionId', response.data.institutionId);
        }
        const token = sessionStorage.getItem('token');
        setUser({ ...response.data, token });
        setupSessionManagement();
      } else {
        logout();
      }
    } catch (error) {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout, setupSessionManagement]);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      apiService.setAuthToken(token);
      lastActivityRef.current = Date.now();
      fetchProfile();
    } else {
      setLoading(false);
    }
    return () => {
      clearInterval(sessionCheckRef.current);
      clearInterval(tokenRefreshRef.current);
    };
  }, []);

  const login = async (credentials) => {
    try {
      const response = await apiService.post('/auth/login', credentials);
      if (response.success) {
        const { token, user: userData } = response.data;
        sessionStorage.setItem('token', token);
        if (userData.institutionId) {
          sessionStorage.setItem('institutionId', userData.institutionId);
        }
        apiService.setAuthToken(token);
        setUser({ ...userData, token });
        lastActivityRef.current = Date.now();
        sessionStorage.setItem('lastActivity', lastActivityRef.current.toString());
        setupSessionManagement();
        message.success('Login successful');
        return { success: true };
      } else {
        Modal.error({ title: 'Login Failed', content: response.error || 'Login failed', centered: true, okText: 'Try Again' });
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed. Please try again.';
      Modal.error({ title: 'Login Failed', content: errorMessage, centered: true, okText: 'Try Again' });
      return { success: false, error: errorMessage };
    }
  };

  const register = async (institutionData) => {
    try {
      const response = await apiService.post('/auth/register-institution', institutionData);
      if (response.success) {
        message.success('Institution registered successfully. Please login.');
        return { success: true };
      } else {
        message.error(response.error || 'Registration failed');
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Registration failed';
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
