"use client";

import { useIsStuck } from "@/hooks/use-is-stuck";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { type DateRange } from "react-day-picker";
import { useInfiniteProjects, type Project } from "@/lib/query/hooks/useProjects";
import { queryKeys } from "@/lib/query/queryKeys";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useBusinessUnits } from "@/lib/query/hooks/useBusinessUnits";
import { useProjectCategories } from "@/lib/query/hooks/useProjectCategories";
import { useChannelClassifications } from "@/lib/query/hooks/useChannelClassifications";
import { useDeliverables } from "@/lib/query/hooks/useDeliverables";
import { useAssignments, useAssignmentsByProject, useDeleteAssignment } from "@/lib/query/hooks/useAssignments";
import { useQueryClient } from "@tanstack/react-query";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { InfiniteScrollTrigger } from "@/components/ui/InfiniteScrollTrigger";
import { AssignEmployeesDialog } from "@/components/projects/AssignEmployeesDialog";
import { ProjectTeamAssignmentsTable } from "@/components/setup/ProjectTeamAssignmentsTable";
import { useAuth } from "@/context/AuthContext";
import { buildEmployeeAssignmentMap } from "@/components/setup/project-setup/team-members";
import { getProjectDetailState } from "@/components/setup/project-setup/project-detail-state";
import { getCriticalMonthlyAllocations } from "@/lib/utils/critical-allocation";
import {
  buildPendingAssignmentPayloads,
  calculateDerivedHoursPerDay,
  formatProjectDateForDisplay,
  getAssignmentDateStrings,
  getFallbackAssignmentDateRange,
  getProjectAssignmentDateRange,
  parseManHoursInput,
} from "@/lib/setup/project-assignment-save";
import {
  hasProjectChannelManHoursChanges,
  updateProjectChannelManHours,
  type EditableProjectChannel,
} from "@/lib/setup/project-channel-editor";

const PROJECT_COLORS = [
  "#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

const CURRENCIES = [
  { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
];

interface ProjectChannelSource {
  channelId?: string | null;
  channel_id?: string | null;
  deliverableId?: string | null;
  deliverable_id?: string | null;
  quantity?: string | null;
  channelBudget?: string | null;
  channel_budget?: string | null;
  manHours?: string | null;
  man_hours?: string | null;
}

type ProjectWithRawChannels = Project & {
  channels?: ProjectChannelSource[];
  projectChannels?: ProjectChannelSource[];
};
export const ProjectSetup = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    data: projectsData,
    isLoading: projectsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteProjects(debouncedSearch || undefined);
  const { data: brands = [] } = useBrands();
  const { data: businessUnits = [] } = useBusinessUnits();
  const { data: projectCategories = [] } = useProjectCategories();
  const { data: channels = [] } = useChannelClassifications();
  const { data: allDeliverables = [] } = useDeliverables();

  // Flatten all pages into a single array of projects
  const projects = useMemo(() => {
    if (!projectsData?.pages) return [];
    return projectsData.pages.flatMap((page) => page.data);
  }, [projectsData]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [isAssignEmployeesOpen, setIsAssignEmployeesOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [manHoursByEmployee, setManHoursByEmployee] = useState<Record<string, string>>({});
  const [pendingAssignments, setPendingAssignments] = useState<Array<{ employeeId: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialManHoursByEmployee, setInitialManHoursByEmployee] = useState<Record<string, string>>({});

  const { data: projectAssignments = [] } = useAssignmentsByProject(viewingProject?.id ?? "");
  const { data: allAssignments = [] } = useAssignments();
  const { data: employees = [] } = useEmployees();
  const deleteAssignment = useDeleteAssignment();

  const employeeMap = useMemo(() => {
    return buildEmployeeAssignmentMap(employees, allAssignments);
  }, [employees, allAssignments]);


  // Form State - Project Type
  const [projectType, setProjectType] = useState<"pitch" | "campaign">("campaign");

  // Form State - Basic Information
  const [name, setName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [brandId, setBrandId] = useState("");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [projectCategoryId, setProjectCategoryId] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [status, setStatus] = useState<"planning" | "active" | "on_hold" | "completed" | "cancelled">("active");

  // Form State - Budget & Financial
  const [currency, setCurrency] = useState("USD");
  const [budget, setBudget] = useState("");
  const [asf, setAsf] = useState("");
  const [grandTotal, setGrandTotal] = useState("");
  const [quotationReference, setQuotationReference] = useState("");
  const [ioFile, setIoFile] = useState("");

  // Form State - Additional Information
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [flag, setFlag] = useState("");

  // Form State - Pitch-specific fields
  const [region, setRegion] = useState("Indonesia");
  const [submitDate, setSubmitDate] = useState("");
  const [pitchStatus, setPitchStatus] = useState<string>("introduction");
  const [valueTotalEstimate, setValueTotalEstimate] = useState("");
  const [hsDealId, setHsDealId] = useState("");

  // Form State - Project Channels (for pitches)
  const [projectChannels, setProjectChannels] = useState<EditableProjectChannel[]>([]);
  const [initialProjectChannels, setInitialProjectChannels] = useState<EditableProjectChannel[]>([]);

  const teamMembers = useMemo(() => {
    // Find which employees are assigned to this project
    const employeeIdsInProject = new Set<string>();

    // Add existing assignments from database
    for (const a of projectAssignments) {
      if (a.employeeId) employeeIdsInProject.add(a.employeeId);
    }

    // Add pending assignments
    for (const p of pendingAssignments) {
      employeeIdsInProject.add(p.employeeId);
    }

    return Array.from(employeeIdsInProject).map((employeeId) => {
      const emp = employeeMap.get(employeeId);
      const allAssignments = emp?.allAssignments || [];

      const criticalAllocations = getCriticalMonthlyAllocations(allAssignments, dateRange);

      return {
        id: employeeId,
        fullName: emp?.fullName ?? "Unknown",
        position: emp?.position ?? "",
        department: emp?.department ?? null,
        criticalAllocations,
      };
    });
  }, [projectAssignments, pendingAssignments, employeeMap, dateRange]);

  // Resolve brand name for the currently selected project/pitch
  const brandName = useMemo(() => {
    if (!brandId || !brands.length) return "";
    return brands.find((b) => b.id === brandId)?.name || "";
  }, [brandId, brands]);

  const pendingEmployeeIds = useMemo(() => {
    return new Set(pendingAssignments.map((pending) => pending.employeeId));
  }, [pendingAssignments]);

  const unsavedManHoursChanges = useMemo(() => {
    return teamMembers
      .filter((member) => !pendingEmployeeIds.has(member.id))
      .map((member) => ({
        employeeId: member.id,
        manHours: manHoursByEmployee[member.id] ?? "",
        initialManHours: initialManHoursByEmployee[member.id] ?? "",
      }))
      .filter((change) => change.manHours !== change.initialManHours);
  }, [teamMembers, pendingEmployeeIds, manHoursByEmployee, initialManHoursByEmployee]);

  const changedManHoursEmployeeIds = useMemo(() => {
    return new Set(unsavedManHoursChanges.map((change) => change.employeeId));
  }, [unsavedManHoursChanges]);

  const handleUndoManHoursChange = useCallback((employeeId: string) => {
    setManHoursByEmployee(prev => ({
      ...prev,
      [employeeId]: initialManHoursByEmployee[employeeId] ?? "",
    }));
  }, [initialManHoursByEmployee]);

  const handleChangeManHours = useCallback((employeeId: string, value: string) => {
    const numericValue = value.replace(/\D/g, "");
    setManHoursByEmployee(prev => ({
      ...prev,
      [employeeId]: numericValue,
    }));
  }, []);

  const hasAssignmentChanges = pendingAssignments.length > 0 || unsavedManHoursChanges.length > 0;
  const hasManHoursChanges = useMemo(() => {
    return hasProjectChannelManHoursChanges(projectChannels, initialProjectChannels);
  }, [projectChannels, initialProjectChannels]);

  // Date range is assignment-planning state. It does not make pitch details dirty by itself.
  const hasUnsavedChanges = useMemo(() => {
    return hasAssignmentChanges || hasManHoursChanges;
  }, [hasAssignmentChanges, hasManHoursChanges]);

  const hasCompleteAssignmentDateRange = !!dateRange?.from && !!dateRange?.to;

  const allManHoursAreValid = useMemo(() => {
    const employeeIdsToValidate = new Set<string>();

    for (const pending of pendingAssignments) {
      employeeIdsToValidate.add(pending.employeeId);
    }

    for (const change of unsavedManHoursChanges) {
      employeeIdsToValidate.add(change.employeeId);
    }

    for (const employeeId of employeeIdsToValidate) {
      if (parseManHoursInput(manHoursByEmployee[employeeId]) === null) {
        return false;
      }
    }

    return true;
  }, [pendingAssignments, unsavedManHoursChanges, manHoursByEmployee]);

  const canEditProjectDetails = !!session?.access.can_view_all;
  const isSaveDisabled = isSaving
    || !hasUnsavedChanges
    || !allManHoursAreValid
    || (hasAssignmentChanges && !hasCompleteAssignmentDateRange)
    || !canEditProjectDetails;

  // Auto-calculate grand total when budget or asf changes
  useEffect(() => {
    const budgetNum = parseFloat(budget) || 0;
    const asfNum = parseFloat(asf) || 0;
    const total = budgetNum + asfNum;
    setGrandTotal(total > 0 ? total.toFixed(2) : "");
  }, [budget, asf]);

  const getDeliverablesForChannel = (channelId: string) => {
    return allDeliverables.filter(d => d.channelId === channelId);
  };

  const ensureSuccessfulSaveResponse = async (response: Response) => {
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || "Failed to save pitch details");
    }
    return response;
  };

  const handleOpenView = (project: Project) => {
    const detailState = getProjectDetailState(project);
    setViewingProject(project);
    setProjectType(detailState.projectType);
    setName(detailState.name);
    setProjectNumber(detailState.projectNumber);
    setBrandId(detailState.brandId);
    setBusinessUnitId(detailState.businessUnitId);
    setProjectCategoryId(detailState.projectCategoryId);
    setColor(detailState.color);
    setStatus(detailState.status);
    setCurrency(detailState.currency);
    setBudget(detailState.budget);
    setAsf(detailState.asf);
    setGrandTotal(detailState.grandTotal);
    setQuotationReference(detailState.quotationReference);
    setIoFile(detailState.ioFile);
    setDateRange(getProjectAssignmentDateRange(project));
    setDescription(detailState.description);
    setNotes(detailState.notes);
    setFlag(detailState.flag);
    setRegion(detailState.region);
    setSubmitDate(detailState.submitDate);
    setPitchStatus(detailState.pitchStatus);
    setValueTotalEstimate(detailState.valueTotalEstimate);
    setHsDealId(detailState.hsDealId);
    const projectWithChannels = project as ProjectWithRawChannels;
    const channelsData = projectWithChannels.channels || projectWithChannels.projectChannels || [];
    const nextProjectChannels = channelsData.map((pc) => ({
      channelId: pc.channelId || pc.channel_id || "",
      deliverableId: pc.deliverableId || pc.deliverable_id || "",
      quantity: pc.quantity || "",
      channelBudget: pc.channelBudget || pc.channel_budget || "",
      manHours: pc.manHours || pc.man_hours || "",
    }));
    setProjectChannels(nextProjectChannels);
    setInitialProjectChannels(nextProjectChannels);
    setPendingAssignments([]);
    if (viewingProject?.id !== project.id) {
      setManHoursByEmployee({});
      setInitialManHoursByEmployee({});
    }
    setIsDialogOpen(true);
  };

  // Load saved man hours from existing assignments when project assignments are loaded.
  useEffect(() => {
    if (!isDialogOpen || !viewingProject || projectAssignments.length === 0) {
      return;
    }

    if (Object.keys(initialManHoursByEmployee).length > 0) {
      return;
    }

    const nextManHoursByEmployee: Record<string, string> = {};

    for (const assignment of projectAssignments) {
      if (!assignment.employeeId) continue;
      const totalHours = assignment.totalHours;
      nextManHoursByEmployee[assignment.employeeId] =
        totalHours === null || totalHours === undefined ? "" : String(Math.round(Number(totalHours)));
    }

    setManHoursByEmployee(nextManHoursByEmployee);
    setInitialManHoursByEmployee(nextManHoursByEmployee);
  }, [isDialogOpen, viewingProject, projectAssignments, initialManHoursByEmployee]);

  // Initialize assignment planning range from existing assignments when project has no saved dates
  useEffect(() => {
    if (!isDialogOpen || !viewingProject || projectAssignments.length === 0) return;
    if (dateRange !== undefined) return;

    const range = getFallbackAssignmentDateRange(projectAssignments);
    if (range) {
      setDateRange(range);
    }
  }, [isDialogOpen, viewingProject, projectAssignments, dateRange]);

  // Group projects by brand
  // In default state: show all brands even if they have no projects
  // In search state: show brands that match the search OR have matching projects
  const projectsByBrand = brands
    .map((brand) => ({
      brand,
      projects: projects.filter((p) => p.brandId === brand.id),
    }))
    .filter(({ brand, projects: brandProjects }) => {
      // If there's no search, show all brands
      if (!debouncedSearch) return true;

      // If searching, show brands that match the search or have matching projects
      const brandNameMatches = brand.name.toLowerCase().includes(debouncedSearch.toLowerCase());
      const hasMatchingProjects = brandProjects.length > 0;

      return brandNameMatches || hasMatchingProjects;
    });

  // Get currency symbol
  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  // Handler for saving pending team assignments and deliverable changes
  const handleSaveTeamAssignments = async (closeAfterSave = false) => {
    setIsSaving(true);
    try {
      if (hasAssignmentChanges && !hasCompleteAssignmentDateRange) {
        throw new Error("Assignment planning requires a complete date range.");
      }

      const assignmentDates = getAssignmentDateStrings(dateRange);

      // 1. Create new assignments for pending employees
      const createPromises = buildPendingAssignmentPayloads({
        projectId: viewingProject!.id,
        pendingAssignments,
        manHoursByEmployee,
        assignmentDates,
      }).map((payload) =>
        fetch('/api/assignments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }).then(ensureSuccessfulSaveResponse)
      );

      // 2. Update existing assignments with changed man hours
      const updatePromises = unsavedManHoursChanges.map((change) => {
        const assignment = projectAssignments.find(a => a.employeeId === change.employeeId);
        if (!assignment) return Promise.resolve();

        const totalHours = parseManHoursInput(change.manHours);
        if (totalHours === null) return Promise.resolve();

        return fetch(`/api/assignments/${assignment.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            totalHours,
            hoursPerDay: calculateDerivedHoursPerDay(totalHours, assignmentDates),
          }),
        }).then(ensureSuccessfulSaveResponse);
      });

      await Promise.all([...createPromises, ...updatePromises]);

      const nextInitialManHours: Record<string, string> = { ...initialManHoursByEmployee };

      for (const pending of pendingAssignments) {
        nextInitialManHours[pending.employeeId] = manHoursByEmployee[pending.employeeId] ?? "";
      }

      for (const change of unsavedManHoursChanges) {
        nextInitialManHours[change.employeeId] = change.manHours;
      }

      setInitialManHoursByEmployee(nextInitialManHours);
      setInitialProjectChannels(projectChannels);

      // Clear pending assignments after successful save
      setPendingAssignments([]);

      if (hasAssignmentChanges) {
        // Invalidate queries to refetch persisted assignment data
        queryClient.invalidateQueries({ queryKey: queryKeys.projects });
        queryClient.invalidateQueries({ queryKey: queryKeys.projectsInfinite });
        queryClient.invalidateQueries({ queryKey: queryKeys.assignments });
        queryClient.invalidateQueries({ queryKey: queryKeys.assignmentsByProject(viewingProject!.id) });
      }

      if (closeAfterSave) {
        setIsDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to save team assignments:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for removing a pending assignment
  const handleRemovePending = (employeeId: string) => {
    setPendingAssignments(prev => prev.filter(p => p.employeeId !== employeeId));
    setManHoursByEmployee(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  };

  // Handler for deleting a saved assignment
  const handleDeleteSavedAssignment = (employeeId: string) => {
    const assignment = projectAssignments.find(a => a.employeeId === employeeId);
    if (!assignment?.id) return;

    // Clean up local state
    setManHoursByEmployee(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
    setInitialManHoursByEmployee(prev => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });

    deleteAssignment.mutate(assignment.id, {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["assignmentsByProject", viewingProject!.id] });
      },
    });
  };

  const { sentinelRef, isStuck } = useIsStuck(40);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div ref={sentinelRef} className="h-px -mt-px invisible" />
        <div className={cn("sticky top-10 z-10 bg-background py-3 px-2 flex items-center justify-between transition-shadow duration-200", isStuck && "shadow-sm")}>
          <div>
            <h3 className="text-lg font-semibold">Projects</h3>
            <p className="text-sm text-muted-foreground">
              Manage projects within your brands
            </p>
          </div>
          <div className="relative">
            <Icon icon="lucide:search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="project-search-input"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
        </div>

        {/* Projects List grouped by Brand */}
        <div className="space-y-6">
          {projectsByBrand.length === 0 && !projectsLoading && debouncedSearch ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon icon="lucide:search-x" className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No projects or brands found matching &quot;{debouncedSearch}&quot;</p>
            </div>
          ) : projectsByBrand.length === 0 && !projectsLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon icon="lucide:folder-x" className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No brands yet. Create one in the Brands tab first.</p>
            </div>
          ) : (
            projectsByBrand.map(({ brand, projects: brandProjects }) => (
              <div key={brand.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: brand.color }}
                  />
                  <h4 className="font-medium text-sm">{brand.name}</h4>
                  <span className="text-xs text-muted-foreground">
                    ({brandProjects.length} projects)
                  </span>
                </div>

                {brandProjects.length === 0 ? (
                  projectsLoading ? (
                    <div className="grid gap-2 pl-5">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-8 w-8 rounded-lg" />
                            <div className="space-y-1">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-48" />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground pl-5">
                      No projects yet
                    </div>
                  )
                ) : (
                  <div className="grid gap-2 pl-5">
                    {brandProjects.map((project) => (
                      <div
                        key={project.id}
                        onClick={() => handleOpenView(project)}
                        className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: project.color }}
                          >
                            <Icon icon="lucide:folder" className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{project.name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "h-5 px-1.5 text-[10px]",
                                  project.projectType === "campaign"
                                    ? "border-blue-200 bg-blue-50 text-blue-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                                )}
                              >
                                {project.projectType === "campaign" ? "Campaign" : "Pitch"}
                              </Badge>
                              <span>
                                {project.projectNumber || "No project number"} • {project.assignments?.length || 0} assignments
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Infinite scroll trigger */}
          <InfiniteScrollTrigger
            onLoadMore={handleLoadMore}
            hasMore={!!hasNextPage}
            isLoading={isFetchingNextPage}
            skeletonCount={3}
          >
            <div className="grid gap-2 pl-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
          </InfiniteScrollTrigger>
        </div>

        {/* View Project/Pitch Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setPendingAssignments([]);
            setManHoursByEmployee({});
            setInitialManHoursByEmployee({});
          }
          setIsDialogOpen(open);
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b bg-background shrink-0 pr-12">
              <DialogTitle>
                {projectType === 'pitch' ? 'Pitch Details' : 'Project Details'}
                {brandName ? ` - ${brandName}` : ""}
              </DialogTitle>
              <DialogDescription>
                View {projectType} information
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-6 py-4">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        {projectType === 'pitch' ? 'Pitch Name' : 'Project Name'} <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="name"
                        value={name}
                        readOnly
                        disabled
                        placeholder={projectType === 'pitch' ? "e.g., Nike Q1 2026 Pitch" : "e.g., Website Redesign"}
                      />
                    </div>

                    {projectType === 'campaign' && (
                      <div className="space-y-2">
                        <label htmlFor="projectNumber" className="text-sm font-medium">
                          Project Number <span className="text-xs text-muted-foreground">(Auto-generated)</span>
                        </label>
                        <Input
                          id="projectNumber"
                          value={projectNumber}
                          readOnly
                          disabled
                          className="bg-muted cursor-not-allowed"
                          placeholder="Auto-generated from project name"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="brand" className="text-sm font-medium">
                        Brand <span className="text-red-500">*</span>
                      </label>
                      <Select value={brandId} disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a brand" />
                        </SelectTrigger>
                        <SelectContent>
                          {brands.map((brand) => (
                            <SelectItem key={brand.id} value={brand.id}>
                              {brand.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {projectType === 'pitch' ? (
                      <>
                        <div className="space-y-2">
                          <label htmlFor="region" className="text-sm font-medium">
                            Region <span className="text-red-500">*</span>
                          </label>
                          <Select value={region} disabled>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Indonesia">Indonesia</SelectItem>
                              <SelectItem value="Singapore">Singapore</SelectItem>
                              <SelectItem value="Malaysia">Malaysia</SelectItem>
                              <SelectItem value="Thailand">Thailand</SelectItem>
                              <SelectItem value="Vietnam">Vietnam</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="pitchStatus" className="text-sm font-medium">
                            Status <span className="text-red-500">*</span>
                          </label>
                          <Select value={pitchStatus} disabled>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="introduction">Introduction</SelectItem>
                              <SelectItem value="waiting_for_brief">Waiting for brief</SelectItem>
                              <SelectItem value="proposal_development">Proposal development</SelectItem>
                              <SelectItem value="submit_or_presentation">Submit or Presentation</SelectItem>
                              <SelectItem value="waiting_for_feedback">Waiting for feedback</SelectItem>
                              <SelectItem value="negotiation">Negotiation</SelectItem>
                              <SelectItem value="won">Won</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                              <SelectItem value="missing">Missing</SelectItem>
                              <SelectItem value="withdraw">Withdraw</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <label htmlFor="businessUnit" className="text-sm font-medium">
                            Business Unit
                          </label>
                          <Select value={businessUnitId} disabled>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select business unit" />
                            </SelectTrigger>
                            <SelectContent>
                              {businessUnits.map((bu) => (
                                <SelectItem key={bu.id} value={bu.id}>
                                  {bu.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="projectCategory" className="text-sm font-medium">
                            Project Category
                          </label>
                          <Select value={projectCategoryId} disabled>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="status" className="text-sm font-medium">
                            Status
                          </label>
                          <Select value={status} disabled>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planning">Planning</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <label className="text-sm font-medium">Color</label>
                          <div className="flex gap-2 flex-wrap">
                            {PROJECT_COLORS.map((c) => (
                              <div
                                key={c}
                                className={cn(
                                  "w-8 h-8 rounded-full",
                                  color === c && "ring-2 ring-offset-2 ring-primary"
                                )}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Budget & Financial Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-2">Budget & Financial</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="currency" className="text-sm font-medium">
                        Currency <span className="text-red-500">*</span>
                      </label>
                      <Select value={currency} disabled>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CURRENCIES.map((curr) => (
                            <SelectItem key={curr.code} value={curr.code}>
                              {curr.symbol} {curr.code} - {curr.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="budget" className="text-sm font-medium">
                        {projectType === 'pitch' ? 'Est. Budget (excl VAT)' : 'Budget'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {getCurrencySymbol(currency)}
                        </span>
                        <Input
                          id="budget"
                          type="number"
                          step="0.01"
                          value={budget}
                          readOnly
                          disabled
                          placeholder="0.00"
                          className="pl-8"
                        />
                      </div>
                    </div>

                    {projectType === 'campaign' && (
                      <>
                        <div className="space-y-2">
                          <label htmlFor="asf" className="text-sm font-medium">
                            ASF (Administrative Service Fee)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {getCurrencySymbol(currency)}
                            </span>
                            <Input
                              id="asf"
                              type="number"
                              step="0.01"
                              value={asf}
                              readOnly
                              disabled
                              placeholder="0.00"
                              className="pl-8"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="grandTotal" className="text-sm font-medium">
                            Grand Total <span className="text-xs text-muted-foreground">(Auto-calculated)</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {getCurrencySymbol(currency)}
                            </span>
                            <Input
                              id="grandTotal"
                              value={grandTotal}
                              readOnly
                              disabled
                              className="bg-muted cursor-not-allowed pl-8 font-semibold"
                              placeholder="0.00"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="quotationReference" className="text-sm font-medium">
                            Quotation Reference
                          </label>
                          <Input
                            id="quotationReference"
                            value={quotationReference}
                            readOnly
                            disabled
                            placeholder="e.g., QT-2026-0001"
                          />
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="ioFile" className="text-sm font-medium">
                            IO File (URL)
                          </label>
                          <Input
                            id="ioFile"
                            value={ioFile}
                            readOnly
                            disabled
                            placeholder="https://example.com/io-file.pdf"
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <label htmlFor="notes" className="text-sm font-medium">
                        Notes
                      </label>
                      <Textarea
                        id="notes"
                        value={notes}
                        readOnly
                        disabled
                        placeholder="Additional notes"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>



                {/* Channels & Deliverables Section (PITCH ONLY) */}
                {projectType === 'pitch' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-semibold text-foreground">Channels & Deliverables</h3>
                    </div>

                    {projectChannels.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
                        No channels added yet. Click &quot;Add Channel&quot; to get started.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {projectChannels.map((channel, index) => (
                          <div key={index} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">
                                  Channel <span className="text-red-500">*</span>
                                </label>
                                <Select
                                  value={channel.channelId}
                                  disabled
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select channel" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {channels.map((ch) => (
                                      <SelectItem key={ch.id} value={ch.id}>
                                        {ch.channelName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium">
                                  Deliverable <span className="text-red-500">*</span>
                                </label>
                                <Select
                                  value={channel.deliverableId}
                                  disabled
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select deliverable" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getDeliverablesForChannel(channel.channelId).map((del) => (
                                      <SelectItem key={del.id} value={del.id}>
                                        {del.deliverableName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium">Quantity</label>
                                <Input
                                  value={channel.quantity}
                                  readOnly
                                  disabled
                                  placeholder="e.g., 5 posts"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium">Budget</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {getCurrencySymbol(currency)}
                                  </span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={channel.channelBudget}
                                    readOnly
                                    disabled
                                    placeholder="0.00"
                                    className="pl-8"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium">Man Hours</label>
                                <Input
                                  value={channel.manHours}
                                  inputMode="decimal"
                                  onChange={(event) => {
                                    setProjectChannels(prev =>
                                      updateProjectChannelManHours(prev, index, event.target.value)
                                    );
                                  }}
                                  placeholder="e.g., 40 hours"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Manage Team Section */}
                <div className="space-y-4">
                  {projectType === "pitch" ? (
                    <div className="space-y-2">
                      <label htmlFor="submissionDate" className="text-sm font-medium">
                        Submission Date
                      </label>
                      <Input
                        id="submissionDate"
                        value={formatProjectDateForDisplay(submitDate)}
                        readOnly
                        disabled
                        placeholder="No submission date"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="campaignStartDate" className="text-sm font-medium">
                          Start Date
                        </label>
                        <Input
                          id="campaignStartDate"
                          value={formatProjectDateForDisplay(viewingProject?.startDate)}
                          readOnly
                          disabled
                          placeholder="No start date"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="campaignEndDate" className="text-sm font-medium">
                          End Date
                        </label>
                        <Input
                          id="campaignEndDate"
                          value={formatProjectDateForDisplay(viewingProject?.endDate)}
                          readOnly
                          disabled
                          placeholder="No end date"
                        />
                      </div>
                    </div>
                  )}
                  <div className="border-b pb-2">
                    <h3 className="text-sm font-semibold text-foreground">Manage Team</h3>
                  </div>

                  <ProjectTeamAssignmentsTable
                    teamMembers={teamMembers}
                    pendingEmployeeIds={pendingEmployeeIds}
                    changedManHoursEmployeeIds={changedManHoursEmployeeIds}
                    manHoursByEmployee={manHoursByEmployee}
                    canAssignTeam={!!session?.access.can_view_all}
                    isDeletePending={deleteAssignment.isPending}
                    onAssignTeam={() => setIsAssignEmployeesOpen(true)}
                    onUndoManHoursChange={handleUndoManHoursChange}
                    onChangeManHours={handleChangeManHours}
                    onRemovePending={handleRemovePending}
                    onDeleteSavedAssignment={handleDeleteSavedAssignment}
                  />

                  {hasUnsavedChanges && (
                    <div className="flex flex-col items-end gap-2">
                      {!allManHoursAreValid && (
                        <p className="text-xs text-amber-600">
                          Please enter whole-number man hours for all pending or changed employees
                        </p>
                      )}
                      {!hasCompleteAssignmentDateRange && (
                        <p className="text-xs text-amber-600">
                          This project has no assignment date range. Set the campaign dates or pitch submission date before assigning a team.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-background shrink-0 gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => handleSaveTeamAssignments(true)}
                disabled={isSaveDisabled}
              >
                {isSaving ? (
                  <>
                    <Icon icon="lucide:loader-2" className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : "Save & Close"}
              </Button>
              <Button
                onClick={() => handleSaveTeamAssignments(false)}
                disabled={isSaveDisabled}
              >
                {isSaving ? (
                  <>
                    <Icon icon="lucide:loader-2" className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon icon="lucide:save" className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Employees Dialog */}
        {viewingProject && (
          <AssignEmployeesDialog
            open={isAssignEmployeesOpen}
            onOpenChange={setIsAssignEmployeesOpen}
            projectId={viewingProject.id}
            projectName={viewingProject.name}
            projectColor={viewingProject.color}
            onAssignPending={(employeeIds) => {
              // Add to pending list instead of saving immediately
              setPendingAssignments(prev => [
                ...prev,
                ...employeeIds.map(empId => ({ employeeId: empId }))
              ]);
              setManHoursByEmployee(prev => {
                const next = { ...prev };
                for (const employeeId of employeeIds) {
                  if (next[employeeId] === undefined) next[employeeId] = "";
                }
                return next;
              });
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
};
