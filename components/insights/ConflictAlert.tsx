"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { Conflict } from "@/lib/analysis/types";
import { Badge } from "@/components/ui/badge";

interface ConflictAlertProps {
  conflict: Conflict;
  onDismiss?: () => void;
  onRemoveAssignment?: (assignmentId: string) => void;
}

export const ConflictAlert: React.FC<ConflictAlertProps> = ({
  conflict,
  onDismiss,
  onRemoveAssignment,
}) => {
  const getSeverityConfig = () => {
    switch (conflict.severity) {
      case "critical":
        return {
          icon: "lucide:alert-octagon",
          color: "text-red-500",
          bgColor: "bg-red-500/10",
          borderColor: "border-red-500/40",
          badgeVariant: "destructive" as const,
        };
      case "warning":
        return {
          icon: "lucide:alert-triangle",
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
          borderColor: "border-amber-500/40",
          badgeVariant: "secondary" as const,
        };
      default:
        return {
          icon: "lucide:info",
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
          borderColor: "border-blue-500/40",
          badgeVariant: "outline" as const,
        };
    }
  };

  const getTypeLabel = () => {
    switch (conflict.type) {
      case "overallocation":
        return "Overallocation";
      case "billable_target":
        return "Billable Target";
      default:
        return "Conflict";
    }
  };

  const config = getSeverityConfig();

  return (
    <div
      className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor} transition-all`}
      data-testid="conflict-alert"
      data-conflict-type={conflict.type}
      data-conflict-severity={conflict.severity}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${config.color}`}>
          <Icon icon={config.icon} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={config.badgeVariant} className="text-xs">
              {getTypeLabel()}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(conflict.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <p className="text-sm font-medium mb-1">{conflict.resourceName}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {conflict.description}
          </p>
          {conflict.suggestedResolution && (
            <div className="mt-3 p-2 rounded bg-background/50 border border-border/50">
              <div className="flex items-center gap-1 text-xs font-medium text-primary mb-1">
                <Icon icon="lucide:lightbulb" className="w-3 h-3" />
                Suggestion
              </div>
              <p className="text-xs text-muted-foreground">
                {conflict.suggestedResolution}
              </p>
            </div>
          )}
          {/* Action Buttons */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Dismiss button - always shown */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Icon icon="lucide:eye-off" className="w-3 h-3" />
                Dismiss
              </button>
            )}

            {/* Remove Assignment button - only for actionable conflicts */}
            {onRemoveAssignment &&
             conflict.affectedAssignments.length > 0 &&
             conflict.type === "overallocation" && (
              <button
                onClick={() => {
                  // Remove the last affected assignment (the one that caused/contributed to the conflict)
                  const targetId = conflict.affectedAssignments[conflict.affectedAssignments.length - 1];
                  onRemoveAssignment(targetId);
                }}
                className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                data-testid="conflict-remove-assignment"
              >
                <Icon icon="lucide:trash-2" className="w-3 h-3" />
                Remove Assignment
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictAlert;
