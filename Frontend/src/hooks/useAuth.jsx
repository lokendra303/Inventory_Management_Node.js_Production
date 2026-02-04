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

  console.log('AuthProvider render - user:', user, 'loading:', loading);

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
    console.log('AuthProvider useEffect triggered');
    const token = sessionStorage.getItem('token');
    console.log('Token from sessionStorage:', token);
    if (token) {
      const lastActivity = sessionStorage.getItem('lastActivity');
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > 15 * 60 * 1000) {
          console.log('Session expired, removing token');
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
      console.log('No token found, setting loading to false');
      setLoading(false);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      console.log('Fetching profile...');
      const response = await apiService.get('/auth/profile');
      console.log('Profile response:', response);
      if (response.success) {
        console.log('Profile fetch successful, setting user:', response.data);
        
        // Store institution ID if available
        if (response.data.institutionId) {
          sessionStorage.setItem('institutionId', response.data.institutionId);
        }
        
        // Include token in user object for API calls
        const token = sessionStorage.getItem('token');
        setUser({ ...response.data, token });
      } else {
        console.log('Profile fetch failed, removing token');
        sessionStorage.removeItem('token');
        apiService.setAuthToken(null);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      
      // Check if it's a session expired error
      if (error.response?.data?.code === 'SESSION_EXPIRED' || 
          error.response?.data?.error?.includes('expired')) {
        Modal.warning({
          title: 'Session Expired',
          content: 'Your session has expired. Please login again.',
          okText: 'Login',
          onOk: () => {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('lastActivity');
            sessionStorage.removeItem('institutionId');
            apiService.setAuthToken(null);
            window.location.href = '/';
          },
          centered: true,
          maskClosable: false,
        });
      } else {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('institutionId');
        apiService.setAuthToken(null);
      }
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const login = async (credentials) => {
    try {
      console.log('Attempting login with:', credentials);
      const response = await apiService.post('/auth/login', credentials);
      console.log('Login response:', response);
      
      if (response.success) {
        const { token, user: userData } = response.data;
        console.log('Login successful, setting user:', userData);
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
        console.log('Login failed:', response.error);
        message.error(response.error || 'Login failed');
        return { success: false, error: response.error };
      }
    } catch (error) {
      console.log('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Login failed';
      message.error(errorMessage);
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