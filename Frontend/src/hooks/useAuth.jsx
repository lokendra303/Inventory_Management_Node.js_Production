import React, { createContext, useContext, useState, useEffect } from 'react';
import { message, Modal } from 'antd';
import apiService from '../services/apiService';

const AuthContext = createContext();

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

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('lastActivity');
    sessionStorage.removeItem('institutionId');
    apiService.setAuthToken(null);
    setUser(null);
    message.success('Logged out successfully');
    window.location.href = '/';
  };

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > 15 * 60 * 1000) {
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('lastActivity');
          sessionStorage.removeItem('institutionId');
          Modal.warning({
            title: 'Session Expired',
            content: 'Your session has expired. Please login again.',
            okText: 'Login',
            onOk: () => {
              window.location.href = '/';
            },
            centered: true,
            maskClosable: false,
          });
          setLoading(false);
          return;
        }
      }
      apiService.setAuthToken(token);
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
      } else {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('lastActivity');
        sessionStorage.removeItem('institutionId');
        apiService.setAuthToken(null);
      }
    } catch (error) {
      // Clean up session storage silently - don't show any modal
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('lastActivity');
      sessionStorage.removeItem('institutionId');
      apiService.setAuthToken(null);
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
        sessionStorage.setItem('lastActivity', Date.now().toString());
        
        // Store institution ID for API requests
        if (userData.institutionId) {
          sessionStorage.setItem('institutionId', userData.institutionId);
        }
        
        apiService.setAuthToken(token);
        // Include token in user object for API calls
        setUser({ ...userData, token });
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