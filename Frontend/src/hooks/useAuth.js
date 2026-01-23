import React, { createContext, useContext, useState, useEffect } from 'react';
import { message } from 'antd';
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

  useEffect(() => {
    console.log('AuthProvider useEffect triggered');
    const token = sessionStorage.getItem('token');
    console.log('Token from sessionStorage:', token);
    if (token) {
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
        setUser(response.data);
      } else {
        console.log('Profile fetch failed, removing token');
        sessionStorage.removeItem('token');
        apiService.setAuthToken(null);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      sessionStorage.removeItem('token');
      apiService.setAuthToken(null);
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
        apiService.setAuthToken(token);
        setUser(userData);
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

  const logout = () => {
    sessionStorage.removeItem('token');
    apiService.setAuthToken(null);
    setUser(null);
    message.success('Logged out successfully');
    // Clear any cached route information
    window.location.href = '/';
  };

  const register = async (tenantData) => {
    try {
      const response = await apiService.post('/auth/register-tenant', tenantData);
      if (response.success) {
        message.success('Tenant registered successfully. Please login.');
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