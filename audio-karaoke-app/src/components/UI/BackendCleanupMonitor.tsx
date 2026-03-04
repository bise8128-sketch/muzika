'use client';

import { useEffect } from 'react';

/**
 * A headless client component that periodically triggers a cleanup
 * event on the Python audio backend to remove old cached data.
 */
export function BackendCleanupMonitor({ intervalMs = 3600000 }: { intervalMs?: number }) {
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const triggerCleanup = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/cleanup', {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.warn('Backend cleanup returned non-OK status:', response.status);
        } else {
          console.debug('Backend cleanup ping successful.');
        }
      } catch (error) {
        console.warn('Backend cleanup ping failed (server might be down):', error);
      }
      
      // Schedule the next cleanup
      timeoutId = setTimeout(triggerCleanup, intervalMs);
    };

    // Initial timeout before first cleanup (don't run immediately on mount to save start time)
    timeoutId = setTimeout(triggerCleanup, intervalMs);

    return () => clearTimeout(timeoutId);
  }, [intervalMs]);

  return null; // Headless component
}
