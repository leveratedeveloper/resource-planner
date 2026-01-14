export type Resource = {
  id: string;
  name: string;
  role: string;
  department: string;
  capacity: number; // e.g., 40 hours per week
};

export type Brand = {
  id: string;
  name: string;
  color: string;
  resourceIds: string[]; // List of resources assigned to this brand
};

export type Assignment = {
  id: string;
  resourceId: string;
  brandId: string;
  startDate: Date;
  endDate: Date;
  hoursPerDay: number;
};
