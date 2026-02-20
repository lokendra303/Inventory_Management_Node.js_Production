import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { message, Modal } from 'antd';
import apiService from '../services/apiService';

const AuthContext = createContext();
const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_CHECK_INTERVAL = 60 * 1000; // Check every 1 minute
const EXTEND_SESSION_THRESHOLD = 5 * 60 * 1000; // Extend if less than 5 minutes remaining

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const activityTimerRef = useRef(null);
  const sessionCheckRef = useRef(null);

  const updateActivity = () => {
    sessionStorage.setItem('lastActivity', Date.now().toString());
  };

  const extendSession = async () => {
    try {
      const response = await apiService.post('/auth/extend-session');
      if (response.success && response.data.token) {
        sessionStorage.setItem('token', response.data.token);
        apiService.setAuthToken(response.data.token);
        updateActivity();
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  };

  const checkSessionExpiry = async () => {
    const lastActivity = sessionStorage.getItem('lastActivity');
    if (!lastActivity) return;

    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      logout();
      Modal.warning({
        title: 'Session Expired',
        content: 'Your session has expired due to inactivity. Please login again.',
        okText: 'Login',
        onOk: () => {
          window.location.href = '/';
        },
        centered: true,
        maskClosable: false,
      });
    } else if (timeSinceLastActivity > SESSION_TIMEOUT - EXTEND_SESSION_THRESHOLD) {
      // Auto-extend session if user is still active and session is about to expire
      await extendSession();
    }
  };

  const setupActivityTracking = () => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check session expiry periodically
    sessionCheckRef.current = setInterval(checkSessionExpiry, ACTIVITY_CHECK_INTERVAL);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
      }
    };
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('lastActivity');
    sessionStorage.removeItem('institutionId');
    apiService.setAuthToken(null);
    setUser(null);
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      apiService.setAuthToken(token);
      updateActivity();
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await apiService.get('/auth/profile');
      if (response.success) {
        
        // Store institution ID if available
        if (response.data.institutionId) {
          sessionStorage.setItem('institutionId', response.data.institutionId);
        }
        
        // Include token in user object for API calls
        const token = sessionStorage.getItem('token');
        setUser({ ...response.data, token });
        
        // Setup activity tracking after profile fetch
        setupActivityTracking();
      } else {
        logout();
      }
    } catch (error) {
      // Clean up session storage silently - don't show any modal
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      const response = await apiService.post('/auth/login', credentials);
      
      if (response.success) {
        const { token, user: userData } = response.data;
        sessionStorage.setItem('token', token);
        updateActivity();
        
        // Store institution ID for API requests
        if (userData.institutionId) {
          sessionStorage.setItem('institutionId', userData.institutionId);
        }
        
        apiService.setAuthToken(token);
        // Include token in user object for API calls
        setUser({ ...userData, token });
        
        // Setup activity tracking after successful login
        setupActivityTracking();
        
        message.success('Login successful');
        return { success: true };
      } else {
        Modal.error({
          title: 'Login Failed',
          content: response.error || 'Login failed',
          centered: true,
          okText: 'Try Again'
        });
        return { success: false, error: response.error };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Login failed. Please try again.';
      Modal.error({
        title: 'Login Failed',
        content: errorMessage,
        centered: true,
        okText: 'Try Again'
      });
      return { success: false, error: errorMessage };
    }
  };



  const register = async (institutionData) => {
    try {
      const response = await apiService.post('/auth/register-institution', institutionData);
      if (response.success) {
        message.success('institution registered successfully. Please login.');
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

  useEffect(() => {
    return () => {
      if (sessionCheckRef.current) {
        clearInterval(sessionCheckRef.current);
      }
    };
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    fetchProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};