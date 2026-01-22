import { eq, and } from 'drizzle-orm';
import { db } from './index';
import { 
  businessUnits, 
  departments, 
  brands, 
  employees, 
  employeeBrandAssignments, 
  projects, 
  assignments 
} from './schema';
import type { 
  NewBusinessUnit, 
  NewDepartment, 
  NewBrand, 
  NewEmployee, 
  NewEmployeeBrandAssignment, 
  NewProject, 
  NewAssignment 
} from './schema';

// ============ BUSINESS UNITS ============
export async function getAllBusinessUnits() {
  return db.query.businessUnits.findMany({
    with: {
      departments: true,
      brands: true,
    },
    orderBy: (bu, { asc }) => [asc(bu.name)],
  });
}

export async function getBusinessUnitById(id: string) {
  return db.query.businessUnits.findFirst({
    where: eq(businessUnits.id, id),
    with: {
      departments: true,
      brands: true,
      employees: true,
    },
  });
}

export async function createBusinessUnit(data: NewBusinessUnit) {
  const [businessUnit] = await db.insert(businessUnits).values(data).returning();
  return businessUnit;
}

export async function updateBusinessUnit(id: string, data: Partial<NewBusinessUnit>) {
  const [businessUnit] = await db
    .update(businessUnits)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(businessUnits.id, id))
    .returning();
  return businessUnit;
}

export async function deleteBusinessUnit(id: string) {
  await db.delete(businessUnits).where(eq(businessUnits.id, id));
}

// ============ DEPARTMENTS ============
export async function getAllDepartments() {
  return db.query.departments.findMany({
    with: {
      businessUnit: true,
    },
    orderBy: (dept, { asc }) => [asc(dept.name)],
  });
}

export async function getDepartmentById(id: string) {
  return db.query.departments.findFirst({
    where: eq(departments.id, id),
    with: {
      businessUnit: true,
      employees: true,
    },
  });
}

export async function createDepartment(data: NewDepartment) {
  const [department] = await db.insert(departments).values(data).returning();
  return department;
}

export async function updateDepartment(id: string, data: Partial<NewDepartment>) {
  const [department] = await db
    .update(departments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(departments.id, id))
    .returning();
  return department;
}

export async function deleteDepartment(id: string) {
  await db.delete(departments).where(eq(departments.id, id));
}

// ============ BRANDS ============
export async function getAllBrands() {
  return db.query.brands.findMany({
    with: {
      businessUnit: true,
      employeeBrandAssignments: {
        with: {
          employee: true,
        },
      },
      projects: true,
    },
    orderBy: (brand, { asc }) => [asc(brand.name)],
  });
}

export async function getBrandById(id: string) {
  return db.query.brands.findFirst({
    where: eq(brands.id, id),
    with: {
      businessUnit: true,
      employeeBrandAssignments: {
        with: {
          employee: true,
        },
      },
      projects: true,
    },
  });
}

export async function createBrand(data: NewBrand) {
  const [brand] = await db.insert(brands).values(data).returning();
  return brand;
}

export async function updateBrand(id: string, data: Partial<NewBrand>) {
  const [brand] = await db
    .update(brands)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(brands.id, id))
    .returning();
  return brand;
}

export async function deleteBrand(id: string) {
  await db.delete(brands).where(eq(brands.id, id));
}

// ============ EMPLOYEES ============
export async function getAllEmployees() {
  return db.query.employees.findMany({
    with: {
      department: true,
      businessUnit: true,
      supervisor: true,
      employeeBrandAssignments: {
        with: {
          brand: true,
        },
      },
      assignments: {
        with: {
          project: true,
        },
      },
    },
    orderBy: (emp, { asc }) => [asc(emp.fullName)],
  });
}

export async function getEmployeeById(id: string) {
  return db.query.employees.findFirst({
    where: eq(employees.id, id),
    with: {
      department: true,
      businessUnit: true,
      supervisor: true,
      subordinates: true,
      employeeBrandAssignments: {
        with: {
          brand: true,
        },
      },
      assignments: {
        with: {
          project: true,
        },
      },
    },
  });
}

export async function createEmployee(data: NewEmployee) {
  const [employee] = await db.insert(employees).values(data).returning();
  return employee;
}

export async function updateEmployee(id: string, data: Partial<NewEmployee>) {
  const [employee] = await db
    .update(employees)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(employees.id, id))
    .returning();
  return employee;
}

export async function deleteEmployee(id: string) {
  await db.delete(employees).where(eq(employees.id, id));
}

// ============ EMPLOYEE BRAND ASSIGNMENTS ============
export async function getEmployeeBrandAssignments(employeeId: string) {
  return db.query.employeeBrandAssignments.findMany({
    where: eq(employeeBrandAssignments.employeeId, employeeId),
    with: {
      brand: true,
    },
  });
}

export async function getBrandEmployeeAssignments(brandId: string) {
  return db.query.employeeBrandAssignments.findMany({
    where: eq(employeeBrandAssignments.brandId, brandId),
    with: {
      employee: true,
    },
  });
}

export async function createEmployeeBrandAssignment(data: NewEmployeeBrandAssignment) {
  const [assignment] = await db.insert(employeeBrandAssignments).values(data).returning();
  return assignment;
}

export async function updateEmployeeBrandAssignment(id: string, data: Partial<NewEmployeeBrandAssignment>) {
  const [assignment] = await db
    .update(employeeBrandAssignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(employeeBrandAssignments.id, id))
    .returning();
  return assignment;
}

export async function deleteEmployeeBrandAssignment(id: string) {
  await db.delete(employeeBrandAssignments).where(eq(employeeBrandAssignments.id, id));
}

export async function deleteEmployeeBrandAssignmentByEmployeeAndBrand(employeeId: string, brandId: string) {
  await db
    .delete(employeeBrandAssignments)
    .where(
      and(
        eq(employeeBrandAssignments.employeeId, employeeId),
        eq(employeeBrandAssignments.brandId, brandId)
      )
    );
}

// ============ PROJECTS ============
export async function getAllProjects() {
  return db.query.projects.findMany({
    with: {
      brand: true,
      businessUnit: true,
      createdBy: true,
      assignments: {
        with: {
          employee: true,
        },
      },
    },
    orderBy: (proj, { asc }) => [asc(proj.name)],
  });
}

export async function getProjectById(id: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      brand: true,
      businessUnit: true,
      createdBy: true,
      assignments: {
        with: {
          employee: true,
        },
      },
    },
  });
}

export async function getProjectsByBrand(brandId: string) {
  return db.query.projects.findMany({
    where: eq(projects.brandId, brandId),
    with: {
      brand: true,
      assignments: {
        with: {
          employee: true,
        },
      },
    },
    orderBy: (proj, { asc }) => [asc(proj.name)],
  });
}

export async function createProject(data: NewProject) {
  const [project] = await db.insert(projects).values(data).returning();
  return project;
}

export async function updateProject(id: string, data: Partial<NewProject>) {
  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return project;
}

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
}

// ============ ASSIGNMENTS ============
export async function getAllAssignments() {
  return db.query.assignments.findMany({
    with: {
      employee: true,
      project: {
        with: {
          brand: true,
        },
      },
      createdBy: true,
    },
    orderBy: (assign, { asc }) => [asc(assign.startDate)],
  });
}

export async function getAssignmentById(id: string) {
  return db.query.assignments.findFirst({
    where: eq(assignments.id, id),
    with: {
      employee: true,
      project: {
        with: {
          brand: true,
        },
      },
      createdBy: true,
    },
  });
}

export async function getAssignmentsByEmployee(employeeId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.employeeId, employeeId),
    with: {
      project: {
        with: {
          brand: true,
        },
      },
    },
    orderBy: (assign, { asc }) => [asc(assign.startDate)],
  });
}

export async function getAssignmentsByProject(projectId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.projectId, projectId),
    with: {
      employee: true,
    },
    orderBy: (assign, { asc }) => [asc(assign.startDate)],
  });
}

export async function createAssignment(data: NewAssignment) {
  const [assignment] = await db.insert(assignments).values(data).returning();
  return assignment;
}

export async function updateAssignment(id: string, data: Partial<NewAssignment>) {
  const [assignment] = await db
    .update(assignments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(assignments.id, id))
    .returning();
  return assignment;
}

export async function deleteAssignment(id: string) {
  await db.delete(assignments).where(eq(assignments.id, id));
}
