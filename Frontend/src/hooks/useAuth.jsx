import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { message, Modal } from 'antd';
import apiService from '../services/apiService';

const AuthContext = createContext();

// Defaults when env is unset — avoids NaN (which disables heartbeat refresh) and matches typical SME usage
const INACTIVITY_TIMEOUT = parseInt(process.env.REACT_APP_INACTIVITY_TIMEOUT, 10) || 15 * 60 * 1000;
const ACTIVITY_THROTTLE = parseInt(process.env.REACT_APP_ACTIVITY_THROTTLE, 10) || 30 * 1000;
const TOKEN_REFRESH_THRESHOLD = parseInt(process.env.REACT_APP_TOKEN_REFRESH_THRESHOLD, 10) || 5 * 60 * 1000;
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // proactively refresh every 4 min

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

  const refreshToken = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      const response = await apiService.post('/auth/heartbeat', {
        lastActivity: lastActivityRef.current
      });
      if (response.success && response.data?.token) {
        const newToken = response.data.token;
        sessionStorage.setItem('token', newToken);
        apiService.setAuthToken(newToken);
        tokenExpiresAtRef.current = getTokenExpiresAt(newToken);
        if (response.data.sessionExpiresAt) {
          const secsLeft = Math.ceil((response.data.sessionExpiresAt - Date.now()) / 1000);
          setSessionSecondsLeft(Math.max(0, secsLeft));
        }
        setUser(prev => prev ? { ...prev, token: newToken } : prev);
      } else if (!response.success && response.code === 'SESSION_EXPIRED') {
        showSessionExpiredModal();
      }
    } catch {
      // Silently ignore — inactivity check will handle actual expiry
    } finally {
      isRefreshingRef.current = false;
    }
  }, [showSessionExpiredModal]);

  const refreshTokenRef = useRef(refreshToken);
  useEffect(() => { refreshTokenRef.current = refreshToken; }, [refreshToken]);

  const showSessionExpiredModalRef = useRef(showSessionExpiredModal);
  useEffect(() => { showSessionExpiredModalRef.current = showSessionExpiredModal; }, [showSessionExpiredModal]);

  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (now - lastActivityWriteRef.current > ACTIVITY_THROTTLE) {
      sessionStorage.setItem('lastActivity', now.toString());
      lastActivityWriteRef.current = now;
    }
    if (
      tokenExpiresAtRef.current &&
      tokenExpiresAtRef.current - now < TOKEN_REFRESH_THRESHOLD &&
      !isRefreshingRef.current
    ) {
      refreshTokenRef.current();
    }
    setSessionSecondsLeft(Math.ceil(INACTIVITY_TIMEOUT / 1000));
  }, []);

  const setupSessionManagement = useCallback(() => {
    clearInterval(sessionCheckRef.current);
    clearInterval(tokenRefreshRef.current);

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    sessionCheckRef.current = setInterval(() => {
      const secondsLeft = Math.ceil((INACTIVITY_TIMEOUT - (Date.now() - lastActivityRef.current)) / 1000);
      if (secondsLeft <= 0) {
        setSessionSecondsLeft(0);
        showSessionExpiredModalRef.current();
      } else {
        setSessionSecondsLeft(secondsLeft);
      }
    }, 1000);

    tokenRefreshRef.current = setInterval(() => {
      if (Date.now() - lastActivityRef.current < INACTIVITY_TIMEOUT) {
        refreshTokenRef.current();
      }
    }, TOKEN_REFRESH_INTERVAL);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(sessionCheckRef.current);
      clearInterval(tokenRefreshRef.current);
    };
  }, [updateActivity]);

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
    } catch {
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
      if (response.success && response.data?.requiresOtp) {
        return { success: true, otpRequired: true, email: response.data.email, institutionId: response.data.institutionId };
      }
      return { success: false, error: response.error || response.message || 'Login failed' };
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || 'Login failed. Please try again.';
      return { success: false, error: errMsg };
    }
  };

  const verifyLoginOtp = async (email, otp, institutionId) => {
    try {
      const response = await apiService.post('/auth/verify-otp', { email, otp, institutionId });
      if (response.success) {
        const { token, user: userData } = response.data;
        sessionStorage.setItem('token', token);
        if (userData.institutionId) sessionStorage.setItem('institutionId', userData.institutionId);
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
        return { success: false, error: response.error };
      }
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'OTP verification failed' };
    }
  };

  const sendOtp = async (mobile, email) => {
    try {
      const response = await apiService.post('/auth/send-otp', { email });
      return response;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to send OTP' };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const response = await apiService.post('/auth/verify-registration-otp', { email, otp });
      return response;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'OTP verification failed' };
    }
  };

  const register = async (institutionData) => {
    try {
      const { adminConfirmPassword, ...payload } = institutionData;
      const response = await apiService.post('/auth/register-institution', payload);
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

  const forgotPassword = async (email) => {
    try {
      const response = await apiService.post('/auth/forgot-password', { email });
      return response;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to send OTP' };
    }
  };

  const verifyResetOtp = async (email, otp) => {
    try {
      const response = await apiService.post('/auth/verify-reset-otp', { email, otp });
      return response;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'OTP verification failed' };
    }
  };

  const resetPassword = async (resetToken, newPassword) => {
    try {
      const response = await apiService.post('/auth/reset-password', { resetToken, newPassword });
      return response;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Password reset failed' };
    }
  };

  const getEmailHint = async (mobile) => {
    try {
      const response = await apiService.post('/auth/get-email-hint', { mobile });
      return response;
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Failed to retrieve email hint' };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      register,
      fetchProfile,
      sessionSecondsLeft,
      sendOtp,
      verifyOtp,
      verifyLoginOtp,
      forgotPassword,
      verifyResetOtp,
      resetPassword,
      getEmailHint,
      /** Call while user is active without pointer on this tab (e.g. mobile barcode scanner modal). */
      bumpSessionActivity: updateActivity,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
