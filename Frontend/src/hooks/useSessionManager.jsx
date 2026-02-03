import { useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import apiService from '../services/apiService';

/**
 * Session Manager Hook - DISABLED
 * 
 * Session expiration has been disabled as requested.
 * This hook now does nothing but is kept for future use if needed.
 */
const useSessionManager = () => {
  // Session management is disabled
  // All timers and activity tracking have been removed
  
  return null;
};

export default useSessionManager;