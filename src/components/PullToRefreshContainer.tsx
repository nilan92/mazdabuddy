import React from 'react';
import { RefreshCw } from 'lucide-react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface PullToRefreshContainerProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
}

export const PullToRefreshContainer: React.FC<PullToRefreshContainerProps> = ({
  children,
  onRefresh,
}) => {
  const { pullDistance, isRefreshing, isReadyToRefresh } = usePullToRefresh({
    onRefresh,
    pullThreshold: 60,
    maxPull: 100,
  });

  // Calculate rotation and opacity based on pull distance
  const progress = Math.min(1, pullDistance / 60);
  const rotation = isRefreshing ? 0 : pullDistance * 4.5;
  const showIndicator = pullDistance > 8 || isRefreshing;

  return (
    <div className="relative w-full">
      {/* Pull Indicator Pill */}
      {showIndicator && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-transform duration-100 ease-out"
          style={{
            transform: `translate(-50%, ${Math.min(pullDistance * 0.7, 48)}px)`,
            opacity: Math.max(0.4, progress),
          }}
        >
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full shadow-2xl backdrop-blur-xl border transition-all duration-200 ${
            isReadyToRefresh || isRefreshing
              ? 'bg-slate-900/95 border-cyan-500/50 text-cyan-400 shadow-cyan-500/20 ring-1 ring-cyan-500/30'
              : 'bg-slate-900/90 border-slate-700/60 text-slate-300 shadow-black/40'
          }`}>
            <RefreshCw
              size={14}
              className={`${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
              style={{
                transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
                transition: isRefreshing ? undefined : 'transform 0.05s linear',
              }}
            />
            <span className="text-[11px] font-medium tracking-wide">
              {isRefreshing
                ? 'Refreshing...'
                : isReadyToRefresh
                ? 'Release to refresh'
                : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}

      {/* Main Content with subtle pull translation */}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.35}px)` : undefined,
          transition: isRefreshing || pullDistance === 0 ? 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};
