"use client";

import React from "react";
import { Icon } from "@iconify/react";
import { CapacityRecommendation, ReassignmentSuggestion } from "@/lib/analysis/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RecommendationCardProps {
  recommendation: CapacityRecommendation;
  onApply?: () => void;
  onDismiss?: () => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onApply,
  onDismiss,
}) => {
  const getTypeConfig = () => {
    switch (recommendation.type) {
      case "reassignment":
        return {
          icon: "lucide:arrow-right-left",
          color: "text-blue-500",
          bgColor: "bg-blue-500/10",
        };
      case "reschedule":
        return {
          icon: "lucide:calendar-clock",
          color: "text-purple-500",
          bgColor: "bg-purple-500/10",
        };
      case "reduce_scope":
        return {
          icon: "lucide:scissors",
          color: "text-amber-500",
          bgColor: "bg-amber-500/10",
        };
      case "add_resource":
        return {
          icon: "lucide:user-plus",
          color: "text-green-500",
          bgColor: "bg-green-500/10",
        };
      default:
        return {
          icon: "lucide:lightbulb",
          color: "text-primary",
          bgColor: "bg-primary/10",
        };
    }
  };

  const getPriorityConfig = () => {
    switch (recommendation.priority) {
      case "high":
        return { label: "High Priority", variant: "destructive" as const };
      case "medium":
        return { label: "Medium", variant: "secondary" as const };
      default:
        return { label: "Low", variant: "outline" as const };
    }
  };

  const typeConfig = getTypeConfig();
  const priorityConfig = getPriorityConfig();

  return (
    <div className={`p-4 rounded-lg border ${typeConfig.bgColor} border-border/50`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-2 rounded-lg ${typeConfig.bgColor}`}>
          <Icon icon={typeConfig.icon} className={`w-5 h-5 ${typeConfig.color}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-sm">{recommendation.title}</h4>
            <Badge variant={priorityConfig.variant} className="text-xs">
              {priorityConfig.label}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground mb-2">
            {recommendation.description}
          </p>
          
          {recommendation.aiExplanation && (
            <div className="p-2 rounded bg-background/50 border border-border/50 mb-3">
              <div className="flex items-center gap-1 text-xs font-medium text-primary mb-1">
                <Icon icon="lucide:sparkles" className="w-3 h-3" />
                AI Insight
              </div>
              <p className="text-xs text-muted-foreground">
                {recommendation.aiExplanation}
              </p>
            </div>
          )}
          
          {recommendation.suggestion && (
            <ReassignmentDetails suggestion={recommendation.suggestion} />
          )}
          
          {recommendation.estimatedImpact && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-3">
              <Icon icon="lucide:trending-up" className="w-3 h-3" />
              {recommendation.estimatedImpact}
            </p>
          )}
          
          <div className="flex items-center gap-2">
            {onApply && (
              <Button size="sm" onClick={onApply} className="h-7 text-xs">
                <Icon icon="lucide:check" className="w-3 h-3 mr-1" />
                Apply
              </Button>
            )}
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-7 text-xs"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ReassignmentDetailsProps {
  suggestion: ReassignmentSuggestion;
}

const ReassignmentDetails: React.FC<ReassignmentDetailsProps> = ({
  suggestion,
}) => {
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-background/50 border border-border/50 mb-3 text-xs">
      <div className="text-center">
        <div className="font-medium">{suggestion.fromResourceName}</div>
        <div className="text-muted-foreground">
          {Math.round(suggestion.impact.fromUtilizationBefore)}% →{" "}
          <span className="text-green-500">
            {Math.round(suggestion.impact.fromUtilizationAfter)}%
          </span>
        </div>
      </div>
      
      <Icon icon="lucide:arrow-right" className="w-4 h-4 text-muted-foreground" />
      
      <div className="text-center">
        <div className="font-medium">{suggestion.toResourceName}</div>
        <div className="text-muted-foreground">
          {Math.round(suggestion.impact.toUtilizationBefore)}% →{" "}
          <span className={suggestion.impact.toUtilizationAfter > 100 ? "text-red-500" : ""}>
            {Math.round(suggestion.impact.toUtilizationAfter)}%
          </span>
        </div>
      </div>
      
      <div className="ml-auto text-right">
        <div className="font-medium">{suggestion.projectName}</div>
        <div className="text-muted-foreground">{suggestion.hoursPerDay}h/day</div>
      </div>
    </div>
  );
};

export default RecommendationCard;
