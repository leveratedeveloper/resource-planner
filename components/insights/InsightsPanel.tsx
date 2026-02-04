"use client";

import React, { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnalysisResult } from "@/lib/analysis/types";
import { Resource } from "@/types";
import { AnalysisAssignment } from "@/lib/analysis/types";
import { InsightsSummary } from "./InsightsSummary";
import { CapacityTab } from "./CapacityTab";
import { ConflictsTab } from "./ConflictsTab";
import { ForecastTab } from "./ForecastTab";

interface InsightsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  result: AnalysisResult | null;
  isAnalyzing: boolean;
  onRefresh: () => void;
  resources: Resource[];
  assignments: AnalysisAssignment[];
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({
  isOpen,
  onClose,
  result,
  isAnalyzing,
  onRefresh,
  resources,
  assignments,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      
      // Check if click is inside the panel
      if (panelRef.current?.contains(target)) {
        return;
      }
      
      // Check if click is inside a Radix portal (Select, Popover, Dialog, etc.)
      // These are rendered outside the panel DOM tree
      const radixPortal = (target as Element).closest?.('[data-radix-popper-content-wrapper], [data-radix-portal]');
      if (radixPortal) {
        return;
      }
      
      if (isOpen) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const criticalCount = result?.summary.criticalConflicts || 0;
  const lastUpdated = result?.timestamp
    ? new Date(result.timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-card border-l shadow-xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon icon="lucide:brain" className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">AI Insights</h2>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground">
                  Updated {lastUpdated}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isAnalyzing}
              className="h-8 w-8"
            >
              <Icon
                icon="lucide:refresh-cw"
                className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <Icon icon="lucide:x" className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Summary */}
        <InsightsSummary result={result} isLoading={isAnalyzing && !result} />

        {/* Tabs */}
        <Tabs defaultValue="capacity" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 grid grid-cols-3">
            <TabsTrigger value="capacity" className="text-xs">
              <Icon icon="lucide:users" className="w-3.5 h-3.5 mr-1" />
              Capacity
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="text-xs relative">
              <Icon icon="lucide:alert-triangle" className="w-3.5 h-3.5 mr-1" />
              Conflicts
              {criticalCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                  {criticalCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="forecast" className="text-xs">
              <Icon icon="lucide:calendar-range" className="w-3.5 h-3.5 mr-1" />
              Forecast
            </TabsTrigger>
          </TabsList>

          <TabsContent value="capacity" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <CapacityTab
                capacityAnalysis={result?.capacityAnalysis || []}
                isLoading={isAnalyzing && !result}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="conflicts" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <ConflictsTab
                conflicts={result?.conflicts || []}
                isLoading={isAnalyzing && !result}
              />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="forecast" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <ForecastTab
                resources={resources}
                assignments={assignments}
                isLoading={isAnalyzing && !result}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
};

export default InsightsPanel;
