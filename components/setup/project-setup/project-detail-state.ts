import type { Project } from "@/lib/query/hooks/useProjects";

export type ProjectDetailState = {
  projectType: "pitch" | "campaign";
  name: string;
  projectNumber: string;
  brandId: string;
  businessUnitId: string;
  projectCategoryId: string;
  color: string;
  status: "planning" | "active" | "on_hold" | "completed" | "cancelled";
  currency: string;
  budget: string;
  asf: string;
  grandTotal: string;
  quotationReference: string;
  ioFile: string;
  startDate: string;
  endDate: string;
  description: string;
  notes: string;
  flag: string;
  region: string;
  submitDate: string;
  pitchStatus: string;
  valueTotalEstimate: string;
  hsDealId: string;
};

export function getProjectDetailState(project: Project): ProjectDetailState {
  return {
    projectType: project.projectType,
    name: project.name,
    projectNumber: project.projectNumber || "",
    brandId: project.brandId,
    businessUnitId: project.businessUnitId || "",
    projectCategoryId: project.projectCategoryId || "",
    color: project.color,
    status: project.status,
    currency: project.currency,
    budget: project.budget || "",
    asf: project.asf || "",
    grandTotal: project.grandTotal || "",
    quotationReference: project.quotationReference || "",
    ioFile: project.ioFile || "",
    startDate: project.startDate || "",
    endDate: project.endDate || "",
    description: project.description || "",
    notes: project.notes || "",
    flag: project.flag || "",
    region: project.region || "",
    submitDate: project.submitDate || "",
    pitchStatus: project.pitchStatus || "",
    valueTotalEstimate: project.valueTotalEstimate || "",
    hsDealId: project.hsDealId || "",
  };
}
