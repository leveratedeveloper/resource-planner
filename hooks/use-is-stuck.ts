"use client";

import { useEffect, useState, useRef } from "react";

export function useIsStuck(offset: number = 0) {
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cachedRef = sentinelRef.current;
    if (!cachedRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting && entry.boundingClientRect.top < offset);
      },
      {
        root: null,
         // The sentinal detects when it crosses the sticky threshold. 
         // For top-0, we want to know when it goes UP past 0.
         // rootMargin affects the bounding box of the root (viewport).
         // If offset is 40 (40px), we want to know when the sentinel (placed right above the sticky element) passes the 40px line.
         // So we shrink the viewport top by offset + 1.
        rootMargin: `-${offset + 1}px 0px 0px 0px`,
        threshold: [1],
      }
    );

    observer.observe(cachedRef);

    return () => {
      observer.unobserve(cachedRef);
    };
  }, [offset]);

  return { sentinelRef, isStuck };
}
