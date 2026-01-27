"use client";

import { useIsStuck } from "@/hooks/use-is-stuck";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useState, useEffect } from "react";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject, type Project } from "@/lib/query/hooks/useProjects";
import { useBrands } from "@/lib/query/hooks/useBrands";
import { useBusinessUnits } from "@/lib/query/hooks/useBusinessUnits";
import { useProjectCategories } from "@/lib/query/hooks/useProjectCategories";
import { useChannelClassifications } from "@/lib/query/hooks/useChannelClassifications";
import { useDeliverables } from "@/lib/query/hooks/useDeliverables";
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
import { cn } from "@/lib/utils";
import { CampaignWizard } from "./CampaignWizard";

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
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: brands = [], isLoading: brandsLoading } = useBrands();
  const { data: businessUnits = [] } = useBusinessUnits();
  const { data: projectCategories = [] } = useProjectCategories();
  const { data: channels = [] } = useChannelClassifications();
  const { data: allDeliverables = [] } = useDeliverables();
  const createProject = useCreateProject();
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCampaignWizardOpen, setIsCampaignWizardOpen] = useState(false);
  const [isProjectTypeDialogOpen, setIsProjectTypeDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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

  // Auto-generate project number when creating new project
  useEffect(() => {
    if (!editingProject && name) {
      const existingNumbers = projects.map((p) => p.projectNumber).filter(Boolean) as string[];
      const newNumber = generateProjectNumber(name, existingNumbers);
      setProjectNumber(newNumber);
    }
  }, [name, editingProject, projects]);

  const resetForm = () => {
    setProjectType("campaign");
    setName("");
    setProjectNumber("");
    setBrandId("");
    setBusinessUnitId("");
    setProjectCategoryId("");
    setColor(PROJECT_COLORS[0]);
    setStatus("active");
    setCurrency("USD");
    setBudget("");
    setAsf("");
    setGrandTotal("");
    setQuotationReference("");
    setIoFile("");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setNotes("");
    setFlag("");
    setRegion("Indonesia");
    setSubmitDate("");
    setPitchStatus("introduction");
    setValueTotalEstimate("");
    setHsDealId("");
    setProjectChannels([]);
    setEditingProject(null);
  };

  // Project Channels Management
  const addChannel = () => {
    setProjectChannels([...projectChannels, {
      channelId: "",
      deliverableId: "",
      quantity: "",
      channelBudget: "",
      manHours: "",
    }]);
  };

  const removeChannel = (index: number) => {
    setProjectChannels(projectChannels.filter((_, i) => i !== index));
  };

  const updateChannel = (index: number, field: string, value: string) => {
    const updated = [...projectChannels];
    updated[index] = { ...updated[index], [field]: value };
    // Reset deliverable when channel changes
    if (field === 'channelId') {
      updated[index].deliverableId = "";
    }
    setProjectChannels(updated);
  };

  const getDeliverablesForChannel = (channelId: string) => {
    return allDeliverables.filter(d => d.channelId === channelId);
  };

  const handleOpenAdd = () => {
    // Show project type selection dialog first
    setIsProjectTypeDialogOpen(true);
  };

  const handleSelectCampaign = () => {
    setIsProjectTypeDialogOpen(false);
    setIsCampaignWizardOpen(true);
  };

  const handleSelectPitch = () => {
    setIsProjectTypeDialogOpen(false);
    resetForm();
    setProjectType("pitch");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (project: Project) => {
    // Use existing dialog for editing both campaigns and pitches
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
    setEditingProject(project);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim() || !brandId) return;

    // Validate pitch-specific required fields
    if (projectType === 'pitch') {
      if (!region || !submitDate || !pitchStatus) {
        alert("Pitch requires region, submit date, and pitch status");
        return;
      }
    }

    const baseProjectData = {
      name: name.trim(),
      brandId,
      projectType,
      projectNumber: projectNumber || null,
      businessUnitId: businessUnitId || null,
      projectCategoryId: projectCategoryId || null,
      color,
      status,
      currency,
      budget: budget || null,
      asf: asf || null,
      grandTotal: grandTotal || null,
      quotationReference: quotationReference || null,
      ioFile: ioFile || null,
      startDate: startDate || null,
      endDate: endDate || null,
      description: description || null,
      notes: notes || null,
      flag: flag || null,
    };

    // Add pitch-specific fields
    const projectData = projectType === 'pitch' ? {
      ...baseProjectData,
      region: region || null,
      submitDate: submitDate || null,
      pitchStatus: pitchStatus as any || null,
      valueTotalEstimate: valueTotalEstimate || null,
      hsDealId: hsDealId || null,
      projectChannels: projectChannels.filter(pc => pc.channelId).map(pc => ({
        channelId: pc.channelId,
        deliverableId: pc.deliverableId || null,
        quantity: pc.quantity || null,
        channelBudget: pc.channelBudget || null,
        manHours: pc.manHours || null,
      })),
    } : baseProjectData;

    if (editingProject) {
      updateProjectMutation.mutate({
        id: editingProject.id,
        ...projectData,
      } as any, {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        }
      });
    } else {
      createProject.mutate(projectData as any, {
        onSuccess: () => {
          setIsDialogOpen(false);
          resetForm();
        }
      });
    }
  };

  const handleDelete = (projectId: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  // Group projects by brand
  const projectsByBrand = brands.map((brand) => ({
    brand,
    projects: projects.filter((p) => p.brandId === brand.id),
  }));

  // Get currency symbol
  const getCurrencySymbol = (code: string) => {
    return CURRENCIES.find((c) => c.code === code)?.symbol || code;
  };

  const { sentinelRef, isStuck } = useIsStuck(40);

  return (
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
        <Button onClick={handleOpenAdd}>
          <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {/* Projects List grouped by Brand */}
      <div className="space-y-6">
        {projectsByBrand.map(({ brand, projects: brandProjects }) => (
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
                    className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-accent/50 transition-colors"
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
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(project)}
                      >
                        <Icon icon="lucide:pencil" className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(project.id)}
                      >
                        <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Project Type Selection Dialog */}
      <Dialog open={isProjectTypeDialogOpen} onOpenChange={setIsProjectTypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              What type of project would you like to create?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button
              onClick={handleSelectCampaign}
              className="h-20 text-lg flex flex-col items-center justify-center gap-2"
              variant="outline"
            >
              <Icon icon="lucide:folder-plus" className="h-8 w-8" />
              <span>Campaign</span>
            </Button>
            <Button
              onClick={handleSelectPitch}
              className="h-20 text-lg flex flex-col items-center justify-center gap-2"
              variant="outline"
            >
              <Icon icon="lucide:presentation" className="h-8 w-8" />
              <span>Pitch</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Wizard for new campaigns */}
      <CampaignWizard
        isOpen={isCampaignWizardOpen}
        onClose={() => setIsCampaignWizardOpen(false)}
      />

      {/* Original Dialog for pitches and editing campaigns */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProject
                ? `Edit ${editingProject.projectType === 'pitch' ? 'Pitch' : 'Campaign'}`
                : `Create New ${projectType === 'pitch' ? 'Pitch' : 'Campaign'}`
              }
            </DialogTitle>
            <DialogDescription>
              {editingProject
                ? `Update the ${editingProject.projectType} details`
                : `Create a new ${projectType} within a brand`
              }
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
                    onChange={(e) => setName(e.target.value)}
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
                  <Select value={brandId} onValueChange={setBrandId}>
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
                      <Select value={region} onValueChange={setRegion}>
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
                      <Select value={pitchStatus} onValueChange={setPitchStatus}>
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
                      <Select value={businessUnitId} onValueChange={setBusinessUnitId}>
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
                      <Select value={projectCategoryId} onValueChange={setProjectCategoryId}>
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
                      <Select value={status} onValueChange={(value: any) => setStatus(value)}>
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
                          <button
                            key={c}
                            className={cn(
                              "w-8 h-8 rounded-full transition-all",
                              color === c && "ring-2 ring-offset-2 ring-primary"
                            )}
                            style={{ backgroundColor: c }}
                            onClick={() => setColor(c)}
                            type="button"
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
                  <Select value={currency} onValueChange={setCurrency}>
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
                      onChange={(e) => setBudget(e.target.value)}
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
                          onChange={(e) => setAsf(e.target.value)}
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
                        onChange={(e) => setQuotationReference(e.target.value)}
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
                        onChange={(e) => setIoFile(e.target.value)}
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
                    onChange={(e) => setNotes(e.target.value)}
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
                      onChange={(e) => setSubmitDate(e.target.value)}
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
                        onChange={(e) => setStartDate(e.target.value)}
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
                        onChange={(e) => setEndDate(e.target.value)}
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
                  <Button type="button" variant="outline" size="sm" onClick={addChannel}>
                    <Icon icon="lucide:plus" className="h-4 w-4 mr-2" />
                    Add Channel
                  </Button>
                </div>

                {projectChannels.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg border-dashed">
                    No channels added yet. Click "Add Channel" to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {projectChannels.map((channel, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-4 bg-muted/20">
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeChannel(index)}
                          >
                            <Icon icon="lucide:trash-2" className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              Channel <span className="text-red-500">*</span>
                            </label>
                            <Select
                              value={channel.channelId}
                              onValueChange={(value) => updateChannel(index, 'channelId', value)}
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
                              onValueChange={(value) => updateChannel(index, 'deliverableId', value)}
                              disabled={!channel.channelId}
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
                              onChange={(e) => updateChannel(index, 'quantity', e.target.value)}
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
                                onChange={(e) => updateChannel(index, 'channelBudget', e.target.value)}
                                placeholder="0.00"
                                className="pl-8"
                              />
                            </div>
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <label className="text-sm font-medium">Man Hours</label>
                            <Input
                              value={channel.manHours}
                              onChange={(e) => updateChannel(index, 'manHours', e.target.value)}
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

            {/* Additional Information Section (CAMPAIGN ONLY) */}
            {projectType === 'campaign' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2">Additional Information</h3>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">
                      Description
                    </label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Project description and objectives"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="flag" className="text-sm font-medium">
                      Flag
                    </label>
                    <Input
                      id="flag"
                      value={flag}
                      onChange={(e) => setFlag(e.target.value)}
                      placeholder="e.g., High Priority, Internal, etc."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || !brandId || createProject.isPending || updateProjectMutation.isPending}
            >
              {createProject.isPending || updateProjectMutation.isPending
                ? "Saving..."
                : editingProject
                  ? "Save Changes"
                  : projectType === 'pitch'
                    ? "Create Pitch"
                    : "Create Campaign"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
