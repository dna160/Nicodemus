'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ScrollFadeProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Scrollable container with a fade gradient indicator at the bottom.
 * The fade appears when content overflows and is not at the bottom.
 * Disappears when scrolled to the bottom or when content fits entirely.
 */
export function ScrollFade({ children, className = '' }: ScrollFadeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const checkScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Only show fade if:
    // 1. Content overflows (scrollHeight > clientHeight)
    // 2. NOT scrolled to bottom (scrollTop + clientHeight < scrollHeight)
    const overflows = el.scrollHeight > el.clientHeight + 4;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    setShowFade(overflows && !atBottom);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check on mount
    checkScroll();

    // Listen for scroll
    el.addEventListener('scroll', checkScroll);

    // Listen for content changes (ResizeObserver)
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={ref} className={`h-full overflow-y-auto ${className}`}>
        {children}
      </div>
      {/* Fade gradient overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#FDFDFD] dark:from-gray-950 to-transparent pointer-events-none transition-opacity duration-300 ${
          showFade ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
