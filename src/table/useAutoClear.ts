import { useEffect } from 'react';

/**
 * Clear a piece of short-lived UI state `ms` after it's set. Setting it
 * again (a new object, a new nonce) restarts the clock.
 */
export function useAutoClear<T>(value: T | null | false, clear: () => void, ms: number): void {
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(clear, ms);
    return () => clearTimeout(timer);
    // Only a new value restarts the clock; `clear` is read from the render
    // that set it.
  }, [value, ms]);
}
