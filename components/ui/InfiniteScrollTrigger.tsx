"use client";

import React, { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface InfiniteScrollTriggerProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  skeletonCount?: number;
  skeletonClassName?: string;
  children?: React.ReactNode;
}

export const InfiniteScrollTrigger: React.FC<InfiniteScrollTriggerProps> = ({
  onLoadMore,
  hasMore,
  isLoading,
  skeletonCount = 3,
  skeletonClassName,
  children,
}) => {
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(trigger);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, onLoadMore]);

  if (!hasMore && !isLoading) {
    return null;
  }

  return (
    <>
      <div ref={triggerRef} className="w-full h-4" />
      {isLoading && (
        children || (
          <div className="flex flex-col gap-3 mt-2">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <Skeleton key={i} className={skeletonClassName || "h-16 w-full rounded-lg"} />
            ))}
          </div>
        )
      )}
    </>
  );
};

export default InfiniteScrollTrigger;
