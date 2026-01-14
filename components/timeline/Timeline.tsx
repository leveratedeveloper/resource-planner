"use client";

import React, { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { ResourceRow } from "./ResourceRow";
import { addDays, format, startOfWeek, eachDayOfInterval, endOfWeek } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TimelineProps {
  brandId: string | null;
  department: string | null;
}

export const Timeline: React.FC<TimelineProps> = ({ brandId, department }) => {
  const { resources, brands } = useApp();

  // Filter resources based on selected Brand AND Department
  const visibleResources = useMemo(() => {
    let filtered = resources;

    // Filter by Brand
    if (brandId) {
       const brand = brands.find((b) => b.id === brandId);
       if (brand) {
         filtered = filtered.filter((r) => brand.resourceIds.includes(r.id));
       }
    }

    // Filter by Department
    if (department) {
      filtered = filtered.filter((r) => r.department === department);
    }

    return filtered;
  }, [brandId, department, resources, brands]);

  // Date Range (Mock: Current Week + next 3 weeks)
  const startDate = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
  const endDate = addDays(startDate, 29); // 30 days view
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="flex flex-col h-full">
        {/* Timeline Header (Days) */}
      <div className="flex border-b bg-muted/40 sticky top-0 z-10">
        <div className="w-[250px] shrink-0 p-4 font-semibold border-r bg-background">
          Resources
        </div>
        <ScrollArea className="flex-1 whitespace-nowrap">
          <div className="flex">
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "w-[100px] shrink-0 border-r p-2 text-center text-sm",
                  format(day, "E") === "Sat" || format(day, "E") === "Sun"
                    ? "bg-muted/50"
                    : "bg-background"
                )}
              >
                <div className="font-semibold">{format(day, "EEE")}</div>
                <div className="text-muted-foreground">{format(day, "d MMM")}</div>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Timeline Body (Resources) */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {visibleResources.length === 0 ? (
             <div className="p-8 text-center text-muted-foreground">
                 No resources found for this selection. Go to Setup to assign resources to this brand.
             </div>
          ) : (
             visibleResources.map((resource) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  days={days}
                  brandId={brandId}
                />
              ))
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};
