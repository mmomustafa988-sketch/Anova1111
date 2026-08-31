// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { topLoadingManager, startTopLoading, finishTopLoading, TopLoadingState } from '../lib/topLoadingManager';

export function TopProgress({ active }: { active?: boolean }) {
  const [state, setState] = useState<TopLoadingState>(() => topLoadingManager.getState());
  const location = useLocation();

  // Subscribe to real-time loading manager events
  useEffect(() => {
    const unsubscribe = topLoadingManager.subscribe((nextState) => {
      setState({ ...nextState });
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Sync external active prop
  useEffect(() => {
    if (active) {
      startTopLoading();
    } else if (active === false) {
      finishTopLoading();
    }
  }, [active]);

  // Handle route change: start loading line on navigation
  useEffect(() => {
    const isAnimePage = location.pathname.startsWith('/anime/') || location.pathname.startsWith('/watch/');
    if (!isAnimePage) {
      // For general non-anime routes, give a quick crisp transition
      startTopLoading();
      const t = setTimeout(() => {
        finishTopLoading();
      }, 350);
      return () => clearTimeout(t);
    }
  }, [location.pathname]);

  const { progress, visible } = state;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-[2.5px] md:h-[3px] overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 240ms ease-out'
      }}
    >
      {/* Background track glow */}
      <div className="absolute inset-0 bg-transparent" />

      {/* Main glowing progress bar with gradient and laser tip */}
      <div
        className="h-full relative bg-gradient-to-r from-[#00d2ff] via-[#00f0ff] to-[#ffffff] transition-all duration-150 ease-out"
        style={{
          width: `${progress}%`,
          boxShadow: '0 0 16px #00e5ff, 0 0 8px #00d2ff, 0 0 3px #ffffff'
        }}
      >
        {/* Leading edge light pulse spark */}
        <div
          className="absolute top-0 right-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-white/80 to-white shadow-[0_0_12px_#ffffff] opacity-95"
          style={{ transform: 'translateX(30%)' }}
        />

        {/* Shimmer laser beam overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse"
          style={{ animationDuration: '0.8s' }}
        />
      </div>
    </div>
  );
}

