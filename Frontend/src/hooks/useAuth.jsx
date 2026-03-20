import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { message, Modal } from 'antd';
import apiService from '../services/apiService';

const AuthContext = createContext();

const INACTIVITY_TIMEOUT = parseInt(process.env.REACT_APP_INACTIVITY_TIMEOUT);        // 15 minutes
const ACTIVITY_THROTTLE = parseInt(process.env.REACT_APP_ACTIVITY_THROTTLE);           // 30 seconds
const TOKEN_REFRESH_THRESHOLD = parseInt(process.env.REACT_APP_TOKEN_REFRESH_THRESHOLD); // refresh if token expires within 5 min

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(null);
  const sessionCheckRef = useRef(null);
  const tokenRefreshRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const lastActivityWriteRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const tokenExpiresAtRef = useRef(null);

  // Decode JWT expiry from token without verifying signature
  const getTokenExpiresAt = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch { return null; }
  };

  const refreshToken = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const response = await apiService.post('/auth/heartbeat');
      if (response.success && response.data?.token) {
        const newToken = response.data.token;
        sessionStorage.setItem('token', newToken);
        apiService.setAuthToken(newToken);
        tokenExpiresAtRef.current = getTokenExpiresAt(newToken);
        setUser(prev => prev ? { ...prev, token: newToken } : prev);
      }
    } catch (error) {
      // Silently ignore — inactivity check will handle actual expiry
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;

    // Throttle sessionStorage writes
    if (now - lastActivityWriteRef.current > ACTIVITY_THROTTLE) {
      sessionStorage.setItem('lastActivity', now.toString());
      lastActivityWriteRef.current = now;
    }

    // If token is expiring within threshold, refresh it now because user is active
    if (
      tokenExpiresAtRef.current &&
      tokenExpiresAtRef.current - now < TOKEN_REFRESH_THRESHOLD
    ) {
      refreshToken();
    }

    // Reset countdown display immediately on activity
    setSessionSecondsLeft(Math.ceil(INACTIVITY_TIMEOUT / 1000));
  }, [refreshToken]);

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
    clearInterval(sessionCheckRef.current);
    clearInterval(tokenRefreshRef.current);

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    // Tick every second: update countdown and check inactivity
    sessionCheckRef.current = setInterval(() => {
      const secondsLeft = Math.ceil((INACTIVITY_TIMEOUT - (Date.now() - lastActivityRef.current)) / 1000);
      if (secondsLeft <= 0) {
        setSessionSecondsLeft(0);
        showSessionExpiredModal();
      } else {
        setSessionSecondsLeft(secondsLeft);
      }
    }, 1000);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(sessionCheckRef.current);
    };
  }, [updateActivity, showSessionExpiredModal]);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await apiService.get('/auth/profile');
      if (response.success) {
        if (response.data.institutionId) {
          sessionStorage.setItem('institutionId', response.data.institutionId);
        }
        const token = sessionStorage.getItem('token');
        tokenExpiresAtRef.current = getTokenExpiresAt(token);
        setSessionSecondsLeft(Math.ceil(INACTIVITY_TIMEOUT / 1000));
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
        tokenExpiresAtRef.current = getTokenExpiresAt(token);
        setSessionSecondsLeft(Math.ceil(INACTIVITY_TIMEOUT / 1000));
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
    <AuthContext.Provider value={{ user, loading, login, logout, register, fetchProfile, sessionSecondsLeft }}>
      {children}
    </AuthContext.Provider>
  );
};
