"use client";

import { useIsStuck } from "@/hooks/use-is-stuck";
import { useDebounce } from "@/hooks/use-debounce";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useProjects, useInfiniteProjects, type Project } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useBusinessUnits } from "@/lib/query/hooks/useBusinessUnits";
import { useProjectCategories } from "@/lib/query/hooks/useProjectCategories";
import { useChannelClassifications } from "@/lib/query/hooks/useChannelClassifications";
import { useDeliverables } from "@/lib/query/hooks/useDeliverables";
import { useAssignmentsByProject } from "@/lib/query/hooks/useAssignments";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { InfiniteScrollTrigger } from "@/components/ui/InfiniteScrollTrigger";
import { AssignEmployeesDialog } from "@/components/projects/AssignEmployeesDialog";
import { useAuth } from "@/context/AuthContext";

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

// Generate project number from project name
const generateProjectNumber = (projectName: string, existingNumbers: string[] = []): string => {
  if (!projectName) return "";

  const year = new Date().getFullYear();

  // Get all project numbers for current year
  const yearPrefix = `PROJ-${year}-`;
  const currentYearNumbers = existingNumbers
    .filter((num) => num.startsWith(yearPrefix))
    .map((num) => parseInt(num.replace(yearPrefix, ""), 10))
    .filter((num) => !isNaN(num));

  // Find next available number
  const nextNumber = currentYearNumbers.length > 0 ? Math.max(...currentYearNumbers) + 1 : 1;

  return `${yearPrefix}${String(nextNumber).padStart(4, "0")}`;
};

export const ProjectSetup = () => {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
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

  const { data: projectAssignments = [] } = useAssignmentsByProject(viewingProject?.id ?? "");
  const { data: employees = [] } = useEmployees();

  const employeeMap = useMemo(() => {
    const map = new Map<string, { fullName: string; position: string; department: { name: string } | null }>();
    for (const emp of employees) {
      map.set(emp.id, {
        fullName: emp.fullName,
        position: emp.position,
        department: emp.department ?? null,
      });
    }
    return map;
  }, [employees]);

  const teamMembers = useMemo(() => {
    const seen = new Set<string>();
    return projectAssignments
      .filter((a) => {
        if (!a.employeeId || seen.has(a.employeeId)) return false;
        seen.add(a.employeeId);
        return true;
      })
      .map((a) => {
        const emp = employeeMap.get(a.employeeId);
        return {
          id: a.employeeId,
          fullName: emp?.fullName ?? "Unknown",
          position: emp?.position ?? "",
          department: emp?.department ?? null,
          allocationPercentage: a.allocationPercentage,
        };
      });
  }, [projectAssignments, employeeMap]);

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

  // Form State - Timeline
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
  const [projectChannels, setProjectChannels] = useState<Array<{
    channelId: string;
    deliverableId: string;
    quantity: string;
    channelBudget: string;
    manHours: string;
  }>>([]);

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

  const handleOpenView = (project: Project) => {
    setViewingProject(project);
    setProjectType(project.projectType);
    setName(project.name);
    setProjectNumber(project.projectNumber || "");
    setBrandId(project.brandId);
    setBusinessUnitId(project.businessUnitId || "");
    setProjectCategoryId(project.projectCategoryId || "");
    setColor(project.color);
    setStatus(project.status);
    setCurrency(project.currency);
    setBudget(project.budget || "");
    setAsf(project.asf || "");
    setGrandTotal(project.grandTotal || "");
    setQuotationReference(project.quotationReference || "");
    setIoFile(project.ioFile || "");
    setStartDate(project.startDate || "");
    setEndDate(project.endDate || "");
    setDescription(project.description || "");
    setNotes(project.notes || "");
    setFlag(project.flag || "");
    setRegion(project.region || "Indonesia");
    setSubmitDate(project.submitDate || "");
    setPitchStatus(project.pitchStatus || "introduction");
    setValueTotalEstimate(project.valueTotalEstimate || "");
    setHsDealId(project.hsDealId || "");
    setProjectChannels(project.projectChannels?.map(pc => ({
      channelId: pc.channelId,
      deliverableId: pc.deliverableId || "",
      quantity: pc.quantity || "",
      channelBudget: pc.channelBudget || "",
      manHours: pc.manHours || "",
    })) || []);
    setIsDialogOpen(true);
  };

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
                          <div className="text-xs text-muted-foreground">
                            {project.projectNumber || "No project number"} • {project.assignments?.length || 0} assignments
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {projectType === 'pitch' ? 'Pitch Details' : 'Project Details'}
            </DialogTitle>
            <DialogDescription>
              View {projectType} information
            </DialogDescription>
          </DialogHeader>

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
                    disabled
                    placeholder="Additional notes"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Timeline Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Timeline</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projectType === 'pitch' ? (
                  <div className="space-y-2">
                    <label htmlFor="submitDate" className="text-sm font-medium">
                      Submit Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="submitDate"
                      type="date"
                      value={submitDate}
                      disabled
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="startDate" className="text-sm font-medium">
                        Start Date
                      </label>
                      <Input
                        id="startDate"
                        type="date"
                        value={startDate}
                        disabled
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="endDate" className="text-sm font-medium">
                        End Date
                      </label>
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        disabled
                      />
                    </div>
                  </>
                )}
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
                    No channels added yet. Click "Add Channel" to get started.
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
                              disabled
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
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Manage Team</h3>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left text-sm font-medium p-3 w-1/3">Name</th>
                      <th className="text-left text-sm font-medium p-3 w-1/3">Deliverables</th>
                      <th className="text-left text-sm font-medium p-3 w-1/3">Total % Allocated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member) => (
                      <tr key={member.id} className="border-b last:border-b-0">
                        <td className="p-3">
                          <div className="font-medium text-sm">{member.fullName}</div>
                          <div className="text-xs text-muted-foreground">
                            {member.position}{member.department ? ` • ${member.department.name}` : ""}
                          </div>
                        </td>
                        <td className="p-3">
                          <Select disabled>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select deliverable" />
                            </SelectTrigger>
                            <SelectContent>
                              {allDeliverables.map((del) => (
                                <SelectItem key={del.id} value={del.id}>
                                  {del.deliverableName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {member.allocationPercentage ?? "-"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b last:border-b-0">
                      <td className="p-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAssignEmployeesOpen(true)}
                          disabled={!session?.access.can_view_all}
                        >
                          <Icon icon="lucide:plus" className="h-4 w-4 mr-1" />
                          Assign Team
                        </Button>
                      </td>
                      <td className="p-3">
                        <Select disabled>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select deliverable" />
                          </SelectTrigger>
                          <SelectContent>
                            {allDeliverables.map((del) => (
                              <SelectItem key={del.id} value={del.id}>
                                {del.deliverableName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Close
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
        />
      )}
      </div>
    </TooltipProvider>
  );
};
