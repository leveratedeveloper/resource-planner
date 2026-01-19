export type Resource = {
  id: string;
  name: string;
  role: string;
  department: string;
  capacity: number; // hours per week (default 40)
};

export type Brand = {
  id: string;
  name: string;
  color: string;
  resourceIds: string[]; // List of resources assigned to this brand
};

export type Project = {
  id: string;
  name: string;
  brandId: string;
  color: string;
  resourceIds: string[]; // People assigned to this project
};

export type AssignmentCategory = 
  | "Research" 
  | "Development" 
  | "Design" 
  | "Meeting" 
  | "Admin" 
  | "Other";

export type Assignment = {
  id: string;
  resourceId: string;
  projectId: string;      // Project this assignment belongs to
  startDate: Date;
  endDate: Date;
  hoursPerDay: number;
  isTimeOff: boolean;     // True = Time Off block (blocks project assignments)
  category: AssignmentCategory;
  isBillable: boolean;
  note?: string;
};
