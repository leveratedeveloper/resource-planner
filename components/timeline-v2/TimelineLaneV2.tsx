"use client";

import React from "react";

type TimelineLaneV2Props = {
  width: number;
  height: number;
  columns: Array<{ id: string }>;
  children?: React.ReactNode;
  onMouseMove?: React.MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  cursor?: string;
  testId?: string;
};

export function TimelineLaneV2({
  width,
  height,
  columns,
  children,
  onMouseMove,
  onMouseLeave,
  onClick,
  cursor = "default",
  testId,
}: TimelineLaneV2Props) {
  return (
    <div
      className="relative flex"
      style={{ width, height, cursor }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      data-testid={testId}
    >
      {children}
      {columns.map((column) => (
        <div key={column.id} className="shrink-0 border-r border-white/20" style={{ width: width / Math.max(columns.length, 1), height }} />
      ))}
    </div>
  );
}
