// Query key factory for type-safe query keys
export const queryKeys = {
  // Business Units
  businessUnits: ["business-units"] as const,
  businessUnit: (id: string) => ["business-units", id] as const,

  // Departments
  departments: ["departments"] as const,
  department: (id: string) => ["departments", id] as const,

  // Brands
  brands: ["brands"] as const,
  brand: (id: string) => ["brands", id] as const,

  // Employees
  employees: ["employees"] as const,
  employee: (id: string) => ["employees", id] as const,
  employeeBrands: (employeeId: string) => ["employees", employeeId, "brands"] as const,

  // Projects
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  projectsByBrand: (brandId: string) => ["projects", "brand", brandId] as const,

  // Assignments
  assignments: ["assignments"] as const,
  assignment: (id: string) => ["assignments", id] as const,
  assignmentsByEmployee: (employeeId: string) => ["assignments", "employee", employeeId] as const,
  assignmentsByProject: (projectId: string) => ["assignments", "project", projectId] as const,
} as const;
