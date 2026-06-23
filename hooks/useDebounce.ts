import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms have
 * elapsed without `value` changing.
 *
 * Useful for search inputs: the input can stay fully responsive (bound to raw
 * state) while expensive work — filtering large lists or hitting the network —
 * runs against the debounced value instead of on every keystroke.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
