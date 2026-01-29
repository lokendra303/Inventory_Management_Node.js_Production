import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

const SessionActivityTracker = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      sessionStorage.setItem('lastActivity', Date.now().toString());
    };

    // Track various user activities
    const events = [
      'mousedown', 'mousemove', 'keypress', 'scroll', 
      'touchstart', 'click', 'focus', 'blur'
    ];

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, updateActivity, true);
    });

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity, true);
      });
    };
  }, [user]);

  return null; // This component doesn't render anything
};

export default SessionActivityTracker;