"use client";

import React from "react";
import { Assignment } from "@/types";
import { format, differenceInDays, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { cn } from "@/lib/utils";

interface AssignmentBlockProps {
  assignment: Assignment;
  days: Date[];
  resourceRowHeight: number;
}

export const AssignmentBlock: React.FC<AssignmentBlockProps> = ({
  assignment,
  days,
  resourceRowHeight,
}) => {
  const { brands } = useApp();
  const brand = brands.find((b) => b.id === assignment.brandId);

  // Calculate Position and Width
  const startDate = startOfDay(new Date(assignment.startDate));
  const endDate = startOfDay(new Date(assignment.endDate));
  const timelineStart = startOfDay(days[0]);

  const offsetDays = differenceInDays(startDate, timelineStart);
  const durationDays = differenceInDays(endDate, startDate) + 1; // +1 to include end date

  const CELL_WIDTH = 100;
  const LEFT_OFFSET = offsetDays * CELL_WIDTH;
  const WIDTH = durationDays * CELL_WIDTH;

  // If outside of view, hide (basic optimization)
  if (offsetDays < 0 && offsetDays + durationDays < 0) return null;

  return (
    <motion.div
      className={cn(
        "absolute top-2 bottom-2 rounded-md shadow-sm border p-2 text-xs text-white overflow-hidden cursor-move flex flex-col justify-center",
      )}
      style={{
        left: LEFT_OFFSET,
        width: WIDTH,
        backgroundColor: brand?.color || "#ccc",
        height: resourceRowHeight - 16, // Top 2 bottom 2 margin essentially
      }}
      drag="x"
      dragMomentum={false}
      // On Drag End would update the state (needs logic to calculate new date based on drops)
      // onDragEnd={(e, info) => handleDragEnd(info)}
      whileHover={{ scale: 1.02, zIndex: 10 }}
    >
      <div className="font-bold truncate">{brand?.name || "Unknown"}</div>
      <div className="truncate opacity-90">{assignment.hoursPerDay}h/day</div>
    </motion.div>
  );
};
