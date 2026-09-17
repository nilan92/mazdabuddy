import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  pullThreshold?: number; // Distance in px needed to trigger refresh (default: 65)
  maxPull?: number; // Maximum pull distance in px (default: 110)
  damping?: number; // Resistance factor (default: 0.42)
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  pullThreshold = 65,
  maxPull = 110,
  damping = 0.42,
  disabled = false,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasVibrated, setHasVibrated] = useState(false);

  const startY = useRef(0);
  const isDragging = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    // Only allow pull-down when at the very top of the scroll container / window
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollY <= 1) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
      setHasVibrated(false);
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    if (diff > 0 && scrollY <= 1) {
      // Calculate damped pull distance
      const distance = Math.min(maxPull, diff * damping);
      setPullDistance(distance);

      // Light haptic feedback once threshold is reached
      if (distance >= pullThreshold && !hasVibrated) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate(15);
          } catch {}
        }
        setHasVibrated(true);
      } else if (distance < pullThreshold && hasVibrated) {
        setHasVibrated(false);
      }
    } else {
      setPullDistance(0);
      isDragging.current = false;
    }
  }, [damping, hasVibrated, isRefreshing, maxPull, pullThreshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(pullThreshold); // Hold at threshold while refreshing
      
      const startTime = Date.now();
      try {
        await onRefresh();
      } catch (err) {
        console.error('Pull-to-refresh error:', err);
      } finally {
        // Keep active for minimum 500ms so user sees confirmation
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 500 - elapsed);
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setHasVibrated(false);
        }, remaining);
      }
    } else {
      setPullDistance(0);
      setHasVibrated(false);
    }
  }, [isRefreshing, onRefresh, pullDistance, pullThreshold]);

  useEffect(() => {
    const options: AddEventListenerOptions = { passive: true };
    window.addEventListener('touchstart', handleTouchStart, options);
    window.addEventListener('touchmove', handleTouchMove, options);
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchEnd, handleTouchMove, handleTouchStart]);

  return {
    pullDistance,
    isRefreshing,
    isReadyToRefresh: pullDistance >= pullThreshold,
  };
}
