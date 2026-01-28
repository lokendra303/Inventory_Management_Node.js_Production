import { useEffect, useCallback, useRef } from 'react';
import { message } from 'antd';

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // 2 minutes before timeout

export const useSessionManager = (user, logout) => {
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();
    sessionStorage.setItem('lastActivity', lastActivityRef.current.toString());

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    // Set warning timer (2 minutes before timeout)
    warningRef.current = setTimeout(() => {
      message.warning('Your session will expire in 2 minutes due to inactivity', 5);
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      message.error('Session expired due to inactivity');
      logout();
    }, SESSION_TIMEOUT);
  }, [user, logout]);

  const checkSessionValidity = useCallback(() => {
    if (!user) return true;

    const lastActivity = sessionStorage.getItem('lastActivity');
    if (!lastActivity) {
      sessionStorage.setItem('lastActivity', Date.now().toString());
      return true;
    }

    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      message.error('Session expired due to inactivity');
      logout();
      return false;
    }

    return true;
  }, [user, logout]);

  useEffect(() => {
    if (!user) return;

    // Check session validity on mount
    if (!checkSessionValidity()) return;

    // Activity events to track
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    // Reset timer on activity
    events.forEach(event => {
      document.addEventListener(event, resetTimer, true);
    });

    // Initial timer setup
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer, true);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [user, resetTimer, checkSessionValidity]);

  // Check session on page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        checkSessionValidity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, checkSessionValidity]);

  return { checkSessionValidity, resetTimer };
};