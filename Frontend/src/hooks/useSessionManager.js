import { useEffect, useCallback, useRef } from 'react';
import { Modal } from 'antd';

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
const WARNING_TIME = 2 * 60 * 1000; // 2 minutes before timeout

const showSessionExpiredModal = () => {
  Modal.warning({
    title: 'Session Expired',
    content: 'Your session has expired. Please login again.',
    okText: 'Login',
    onOk: () => {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('lastActivity');
      window.location.href = '/';
    },
    centered: true,
    maskClosable: false,
  });
};

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
      Modal.warning({
        title: 'Session Warning',
        content: 'Your session will expire in 2 minutes due to inactivity',
        okText: 'Continue',
        onOk: () => resetTimer(),
        centered: true,
      });
    }, SESSION_TIMEOUT - WARNING_TIME);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      showSessionExpiredModal();
    }, SESSION_TIMEOUT);
  }, [user]);

  const checkSessionValidity = useCallback(() => {
    if (!user) return true;

    const lastActivity = sessionStorage.getItem('lastActivity');
    if (!lastActivity) {
      sessionStorage.setItem('lastActivity', Date.now().toString());
      return true;
    }

    const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      showSessionExpiredModal();
      return false;
    }

    return true;
  }, [user]);

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