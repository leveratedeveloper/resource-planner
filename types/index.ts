// ============ ENUMS ============
export type BrandStatus = "active" | "inactive" | "prospect";
export type EmploymentStatus = "active" | "inactive" | "contractor";
export type Visibility = "active" | "archived";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type AssignmentStatus = "draft" | "confirmed" | "completed";

export type AssignmentCategory =
  | "Research"
  | "Development"
  | "Design"
  | "Meeting"
  | "Admin"
  | "Content"
  | "Project Management"
  | "Other";

// ============ CORE TYPES ============

export type BusinessUnit = {
  id: string;
  name: string;
  code: string;
  color: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Department = {
  id: string;
  businessUnitId: string | null;
  name: string;
  code: string;
  color: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  businessUnit?: BusinessUnit;
};

export type EmployeeBrandAssignment = {
  id: string;
  employeeId: string;
  brandId: string;
  isPrimary: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  brand?: Brand;
  employee?: Employee;
};

export type Brand = {
  id: string;
  businessUnitId: string | null;
  name: string;
  clientCode: string | null;
  color: string;
  logo: string | null;
  website: string | null;
  contactName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  industryCategory: string | null;
  description: string | null;
  status: BrandStatus;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  businessUnit?: BusinessUnit;
  employeeBrandAssignments?: EmployeeBrandAssignment[];
  projects?: Project[];
};

export type Employee = {
  id: string;
  employeeNumber: string | null;
  fullName: string;
  nickname: string | null;
  email: string | null;
  photo: string | null;
  position: string;
  departmentId: string | null;
  businessUnitId: string | null;
  directSupervisorId: string | null;
  weeklyCapacity: number;
  workStartDate: Date | null;
  dateOfBirth: Date | null;
  employmentStatus: EmploymentStatus;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  department?: Department;
  businessUnit?: BusinessUnit;
  supervisor?: Employee;
  employeeBrandAssignments?: EmployeeBrandAssignment[];
  assignments?: Assignment[];
};

export type Project = {
  id: string;
  brandId: string;
  businessUnitId: string | null;
  projectTypeId: string | null;
  name: string;
  projectNumber: string | null;
  description: string | null;
  color: string;
  budget: number | null;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  status: ProjectStatus;
  createdById: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  brand?: Brand;
  businessUnit?: BusinessUnit;
  createdBy?: Employee;
  assignments?: Assignment[];
};

export type Assignment = {
  id: string;
  employeeId: string;
  projectId: string | null;
  taskId: string | null;
  startDate: Date;
  endDate: Date;
  hoursPerDay: number;
  allocationPercentage: number | null;
  isTimeOff: boolean;
  timeOffTypeId: string | null;
  category: AssignmentCategory | null;
  isBillable: boolean;
  status: AssignmentStatus;
  note: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  employee?: Employee;
  project?: Project;
  createdBy?: Employee;
};

// ============ LEGACY TYPES (for backwards compatibility during migration) ============

/**
 * @deprecated Use Employee instead. This alias exists only for backwards compatibility.
 */
export type Resource = {
  id: string;
  name: string;
  role: string;
  department: string;
  capacity: number;
};

// ============ UTILITY TYPES ============

export type DateRange = {
  start: Date;
  end: Date;
};
