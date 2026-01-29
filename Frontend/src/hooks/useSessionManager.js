import { useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import apiService from '../services/apiService';

/**
 * Session Manager Hook
 * 
 * Automatically manages user session based on activity:
 * - Tracks user interactions (mouse, keyboard, touch, scroll)
 * - Extends session when user is active (every 5+ minutes)
 * - Shows warning 5 minutes before session expiry
 * - Auto-logout after 25 minutes of inactivity
 * 
 * Usage: Call this hook in the main App component for authenticated users
 */
const useSessionManager = () => {
  const activityTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  
  // Session configuration
  const ACTIVITY_TIMEOUT = 25 * 60 * 1000; // 25 minutes total session timeout
  const WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before expiry
  const EXTEND_THRESHOLD = 5 * 60 * 1000; // Extend session if activity within 5 minutes

  // Extend session by calling backend API
  const extendSession = useCallback(async () => {
    try {
      await apiService.post('/auth/extend-session');
      console.log('Session extended successfully');
    } catch (error) {
      console.error('Failed to extend session:', error);
    }
  }, []);

  // Show session expiry warning to user
  const showWarning = useCallback(() => {
    message.warning({
      content: 'Your session will expire in 5 minutes due to inactivity',
      duration: 10,
      key: 'session-warning'
    });
  }, []);

  // Reset activity timers and extend session if needed
  const resetActivityTimer = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // Clear existing timers
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Extend session if there was significant activity gap
    if (timeSinceLastActivity > EXTEND_THRESHOLD) {
      extendSession();
    }

    lastActivityRef.current = now;

    // Set warning timer (20 minutes from now)
    warningTimeoutRef.current = setTimeout(showWarning, ACTIVITY_TIMEOUT - WARNING_TIME);

    // Set final logout timer (25 minutes from now)
    activityTimeoutRef.current = setTimeout(() => {
      message.error('Session expired due to inactivity');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }, ACTIVITY_TIMEOUT);
  }, [extendSession, showWarning]);

  const handleActivity = useCallback(() => {
    resetActivityTimer();
  }, [resetActivityTimer]);

  useEffect(() => {
    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Add event listeners for activity tracking
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize session timer
    resetActivityTimer();

    // Cleanup on unmount
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [handleActivity, resetActivityTimer]);

  return null;
};

export default useSessionManager;