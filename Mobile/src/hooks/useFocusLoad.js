import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Loads on screen focus, but skips if the same loader ran within minIntervalMs.
 * Call returned `reload()` for pull-to-refresh (always fetches).
 */
export default function useFocusLoad(loadFn, deps = [], minIntervalMs = 8000) {
  const lastRunRef = useRef(0);
  const loadingRef = useRef(false);

  const run = useCallback(
    async (force = false) => {
      const now = Date.now();
      if (!force) {
        if (loadingRef.current) return;
        if (now - lastRunRef.current < minIntervalMs) return;
      }
      loadingRef.current = true;
      lastRunRef.current = now;
      try {
        await loadFn(force);
      } finally {
        loadingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useFocusEffect(
    useCallback(() => {
      run(false);
    }, [run]),
  );

  const reload = useCallback(() => run(true), [run]);

  return reload;
}
