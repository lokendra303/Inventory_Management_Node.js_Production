import { useCallback, useState } from 'react';

const VALID_MODES = new Set(['list', 'grid']);

/**
 * @param {string} storageKey localStorage key
 * @param {'list'|'grid'} [defaultMode='list']
 */
export function usePersistedViewMode(storageKey, defaultMode = 'list') {
  const [viewMode, setViewModeState] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (VALID_MODES.has(saved)) return saved;
    } catch {
      /* ignore */
    }
    return VALID_MODES.has(defaultMode) ? defaultMode : 'list';
  });

  const setViewMode = useCallback((next) => {
    setViewModeState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      if (!VALID_MODES.has(value)) return prev;
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        /* ignore */
      }
      return value;
    });
  }, [storageKey]);

  return [viewMode, setViewMode];
}

export default usePersistedViewMode;
