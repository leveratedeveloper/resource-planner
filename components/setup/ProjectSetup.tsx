"use client";

import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { type DateRange } from "react-day-picker";
import { useInfiniteProjects, useProjectDetail, type Project } from "@/lib/query/hooks/useProjects";
import { dedupeProjectsById } from "@/lib/projects/dedupe-projects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useBusinessUnits } from "@/lib/query/hooks/useBusinessUnits";
import { useProjectCategories } from "@/lib/query/hooks/useProjectCategories";
import { useChannelClassifications } from "@/lib/query/hooks/useChannelClassifications";
import { useDeliverables } from "@/lib/query/hooks/useDeliverables";
import { useAssignments, useAssignmentsByProject, type Assignment } from "@/lib/query/hooks/useAssignments";
import { useAssignmentCommands } from "@/lib/query/hooks/useAssignmentCommands";
import { useEmployees } from "@/lib/query/hooks/useEmployees";
import { criticalMonths } from "@/lib/assignments/allocation";
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
import { getProjectDetailState } from "@/components/setup/project-setup/project-detail-state";
import {
  formatProjectDateForDisplay,
  getAssignmentDateStrings,
  getFallbackAssignmentDateRange,
  getMissingAssignmentPlanningDateReason,
  getProjectAssignmentDateRange,
  parseManHoursInput,
  splitTotalAcrossMonthsMap,
  toWholeHoursInput,
} from "@/lib/assignments/split";
import {
  hasProjectChannelManHoursChanges,
  updateProjectChannelManHours,
  type EditableProjectChannel,
} from "@/lib/setup/project-channel-editor";
import { SetupSectionHeader } from "./SetupSectionHeader";

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

// Pure data transform — hoisted to module scope so it has no closure deps and
// is safe to reference from the empty-dep useCallback appliers below.
function mapRawChannels(project: Project): EditableProjectChannel[] {
  const projectWithChannels = project as ProjectWithRawChannels;
  const channelsData = projectWithChannels.channels || projectWithChannels.projectChannels || [];
  return channelsData.map((pc) => ({
    channelId: pc.channelId || pc.channel_id || "",
    deliverableId: pc.deliverableId || pc.deliverable_id || "",
    quantity: pc.quantity || "",
    channelBudget: pc.channelBudget || pc.channel_budget || "",
    manHours: pc.manHours || pc.man_hours || "",
  }));
}

export const ProjectSetup = () => {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [showEmptyBrands, setShowEmptyBrands] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const {
    data: projectsData,
    isLoading: projectsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteProjects(debouncedSearch || undefined);
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: businessUnits = [] } = useBusinessUnits();
  const { data: projectCategories = [] } = useProjectCategories();
  const { data: channels = [] } = useChannelClassifications();
  const { data: allDeliverables = [] } = useDeliverables();

  // Flatten all pages into a single array of projects. Dedup by id so a
  // boundary-duplicated row can never produce a duplicate React key.
  const projects = useMemo(() => {
    if (!projectsData?.pages) return [];
    return dedupeProjectsById(projectsData.pages.flatMap((page) => page.data));
  }, [projectsData]);
  const isProjectListLoading = projectsLoading || brandsLoading;

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

  const isProjectDetailOpen = isDialogOpen && !!viewingProject;
  // useAssignmentsByProject now accepts projectKey (string)
  const projectKey = viewingProject ? `${viewingProject.projectType}:${viewingProject.id}` : "";
  const { data: projectAssignments = [] } = useAssignmentsByProject(projectKey, {
    enabled: isProjectDetailOpen && !!projectKey,
  });
  const { data: allAssignments = [] } = useAssignments({ enabled: isProjectDetailOpen });
  const { data: employees = [] } = useEmployees({ enabled: isProjectDetailOpen });
  const { upsert, remove } = useAssignmentCommands();

  // Simple lookup: employee info by id (name/position/dept only — no legacy hoursPerDay shape)
  const employeeInfoMap = useMemo(() => {
    const map = new Map<string, { fullName: string; position: string; department: { id: string; name: string; color: string } | null }>();
    for (const emp of employees) {
      map.set(emp.id, { fullName: emp.fullName, position: emp.position, department: emp.department ?? null });
    }
    return map;
  }, [employees]);

  // All assignments grouped by employeeId, for cross-project critical-month calculation
  const assignmentsByEmployee = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    for (const a of allAssignments) {
      const list = map.get(a.employeeId) ?? [];
      list.push(a);
      map.set(a.employeeId, list);
    }
    return map;
  }, [allAssignments]);


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

    for (const a of projectAssignments) {
      if (a.employeeId) employeeIdsInProject.add(a.employeeId);
    }
    for (const p of pendingAssignments) {
      employeeIdsInProject.add(p.employeeId);
    }

    return Array.from(employeeIdsInProject).map((employeeId) => {
      const info = employeeInfoMap.get(employeeId);
      // Flatten all of this employee's allocations across all projects into {month, hours} entries
      const entries = (assignmentsByEmployee.get(employeeId) ?? []).flatMap((a) =>
        a.allocations.map((alloc) => ({ month: alloc.month, hours: alloc.plannedHours }))
      );
      const critical = criticalMonths(entries);

      return {
        id: employeeId,
        fullName: info?.fullName ?? "Unknown",
        position: info?.position ?? "",
        department: info?.department ?? null,
        criticalAllocations: critical.map((c) => ({
          monthKey: c.month,
          monthLabel: c.monthLabel,
          percentage: c.percentage,
        })),
      };
    });
  }, [projectAssignments, pendingAssignments, employeeInfoMap, assignmentsByEmployee]);

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
    const numericValue = toWholeHoursInput(value);
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

  const missingAssignmentPlanningDateReason = getMissingAssignmentPlanningDateReason(projectType, dateRange);
  const hasCompleteAssignmentDateRange = missingAssignmentPlanningDateReason === null;

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

  const applyProjectToForm = useCallback((project: Project) => {
    const detailState = getProjectDetailState(project);
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
    setDescription(detailState.description);
    setNotes(detailState.notes);
    setFlag(detailState.flag);
    setRegion(detailState.region);
    setSubmitDate(detailState.submitDate);
    setPitchStatus(detailState.pitchStatus);
    setValueTotalEstimate(detailState.valueTotalEstimate);
    setHsDealId(detailState.hsDealId);
    // Channels are set by handleOpenView (alongside initialProjectChannels) so
    // the projection's channel list is mapped exactly once per open.
  }, []);

  const applyDetailOverlay = useCallback((detail: Project) => {
    const detailState = getProjectDetailState(detail);
    // Detail-only fields the projection does not carry. Deliberately omits
    // name / brandId / color / status / startDate / endDate — those remain from
    // the projection (single source of truth for timeline-rendered fields).
    setProjectNumber(detailState.projectNumber);
    setBusinessUnitId(detailState.businessUnitId);
    setProjectCategoryId(detailState.projectCategoryId);
    setCurrency(detailState.currency);
    setBudget(detailState.budget);
    setAsf(detailState.asf);
    setGrandTotal(detailState.grandTotal);
    setQuotationReference(detailState.quotationReference);
    setIoFile(detailState.ioFile);
    setDescription(detailState.description);
    setNotes(detailState.notes);
    setRegion(detailState.region);
    setSubmitDate(detailState.submitDate);
    setPitchStatus(detailState.pitchStatus);
    setValueTotalEstimate(detailState.valueTotalEstimate);
    setHsDealId(detailState.hsDealId);
    // Channels are intentionally NOT overlaid: the live single-fetch does not
    // reliably return channel rows, and channel.manHours is user-editable —
    // re-applying here would wipe projection channels or stomp an edit. Channel
    // population is out of scope for this change.
  }, []);

  const detailProjectType =
    viewingProject?.projectType === "campaign" || viewingProject?.projectType === "pitch"
      ? viewingProject.projectType
      : undefined;

  const {
    data: liveProjectDetail,
    isFetching: isDetailFetching,
    isError: isDetailError,
  } = useProjectDetail(detailProjectType, viewingProject?.id, isDialogOpen);

  useEffect(() => {
    if (liveProjectDetail) {
      applyDetailOverlay(liveProjectDetail);
    }
  }, [liveProjectDetail, applyDetailOverlay]);

  const handleOpenView = (project: Project) => {
    setViewingProject(project);
    applyProjectToForm(project);
    setDateRange(getProjectAssignmentDateRange(project));
    const nextProjectChannels = mapRawChannels(project);
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
  // Man hours per engagement = sum of allocations[].plannedHours.
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
      const totalHours = assignment.allocations.reduce((sum, a) => sum + a.plannedHours, 0);
      nextManHoursByEmployee[assignment.employeeId] = String(Math.round(totalHours));
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
  const projectsByBrand = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    const projectsByBrandId = new Map<string, Project[]>();

    for (const project of projects) {
      const bucket = projectsByBrandId.get(project.brandId) ?? [];
      bucket.push(project);
      projectsByBrandId.set(project.brandId, bucket);
    }

    return brands
      .map((brand) => ({
        brand,
        projects: projectsByBrandId.get(brand.id) ?? [],
      }))
      .filter(({ brand, projects: brandProjects }) => {
        if (!normalizedSearch) return showEmptyBrands || brandProjects.length > 0;

        const brandNameMatches = brand.name.toLowerCase().includes(normalizedSearch);
        return brandNameMatches || brandProjects.length > 0;
      });
  }, [brands, projects, debouncedSearch, showEmptyBrands]);

  // Get currency symbol
  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  // Handler for saving pending team assignments and man-hours changes
  const handleSaveTeamAssignments = async (closeAfterSave = false) => {
    if (!viewingProject || !projectKey) return;
    setIsSaving(true);
    try {
      if (hasAssignmentChanges && missingAssignmentPlanningDateReason) {
        throw new Error(
          missingAssignmentPlanningDateReason === "pitch_submit_date"
            ? "Pitch assignment planning requires a submission date."
            : "Campaign assignment planning requires a complete date range."
        );
      }

      const assignmentDates = getAssignmentDateStrings(dateRange);
      const { startDate: spanStart, endDate: spanEnd } = assignmentDates;
      const currentProjectKey = projectKey;

      // 1. Create new assignments for pending employees
      const createOps = pendingAssignments.map((pending) => {
        const totalHours = parseManHoursInput(manHoursByEmployee[pending.employeeId]) ?? 0;
        const monthlyHours = splitTotalAcrossMonthsMap(totalHours, spanStart, spanEnd);
        return upsert.mutateAsync({
          employeeUuid: pending.employeeId,
          projectKey: currentProjectKey,
          span: { startDate: spanStart, endDate: spanEnd },
          monthlyHours,
          status: "draft",
          mode: "replace",
        });
      });

      // 2. Update existing assignments with changed man hours
      const updateOps = unsavedManHoursChanges.map((change) => {
        const totalHours = parseManHoursInput(change.manHours);
        if (totalHours === null) return Promise.resolve();
        const monthlyHours = splitTotalAcrossMonthsMap(totalHours, spanStart, spanEnd);
        return upsert.mutateAsync({
          employeeUuid: change.employeeId,
          projectKey: currentProjectKey,
          span: { startDate: spanStart, endDate: spanEnd },
          monthlyHours,
          status: "draft",
          mode: "replace",
        });
      });

      await Promise.all([...createOps, ...updateOps]);

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

    // Clean up local state immediately
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

    remove.mutate(assignment.id);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <SetupSectionHeader
          title="Projects"
          description="Manage projects within your brands"
          searchValue={searchQuery}
          searchPlaceholder="Search projects..."
          searchTestId="project-search-input"
          onSearchChange={setSearchQuery}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowEmptyBrands((value) => !value)}
              aria-pressed={showEmptyBrands}
              data-testid="toggle-empty-brands"
            >
              {showEmptyBrands ? "Hide empty" : "Show empty"}
            </Button>
          }
        />

        {/* Projects List grouped by Brand */}
        <div className="space-y-6">
          {projectsByBrand.length === 0 && !isProjectListLoading && debouncedSearch ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon icon="lucide:search-x" className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No projects or brands found matching &quot;{debouncedSearch}&quot;</p>
            </div>
          ) : projectsByBrand.length === 0 && !isProjectListLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon icon="lucide:folder-x" className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {debouncedSearch
                  ? `No projects or brands found matching "${debouncedSearch}"`
                  : "No brands yet. Create one in the Brands tab first."}
              </p>
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
                  isProjectListLoading ? (
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
                                {project.projectNumber || "No project number"} • {project.assignmentCount ?? 0} assignments
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
                  <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center">
                    Budget &amp; Financial
                    {isDetailFetching ? (
                      <span className="ml-2 inline-flex items-center text-xs text-muted-foreground font-normal">
                        <Icon icon="lucide:loader-2" className="h-3 w-3 mr-1 animate-spin" />
                        Loading details…
                      </span>
                    ) : isDetailError ? (
                      <span className="ml-2 text-xs text-amber-600 font-normal">
                        Couldn&apos;t load full details from Timetrack
                      </span>
                    ) : null}
                  </h3>

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
                    isDeletePending={remove.isPending}
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
                      {hasAssignmentChanges && missingAssignmentPlanningDateReason && (
                        <p className="text-xs text-amber-600">
                          {missingAssignmentPlanningDateReason === "pitch_submit_date"
                            ? "This pitch has no submission date. Set the pitch submission date before assigning a team."
                            : "This campaign has no assignment date range. Set the campaign dates before assigning a team."}
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
            projectId={projectKey}
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
