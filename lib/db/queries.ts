import { eq, and, sql, count, ilike, or, inArray, asc } from 'drizzle-orm';
import { db } from './index';
import {
  projectCategories,
  businessUnits,
  departments,
  brands,
  employees,
  employeeBrandAssignments,
  projects,
  assignments,
  projectChannels,
  channelClassifications,
  deliverables
} from './schema';
import type {
  NewProjectCategory,
  NewBusinessUnit,
  NewDepartment,
  NewBrand,
  NewEmployee,
  NewEmployeeBrandAssignment,
  NewProject,
  NewAssignment,
  NewProjectChannel
} from './schema';

// ============ PROJECT CATEGORIES ============
export async function getAllProjectCategories() {
  return db.query.projectCategories.findMany({
    orderBy: (pc: any, { asc }: any) => [asc(pc.displayOrder), asc(pc.name)],
  });
}

export async function getProjectCategoryById(id: string) {
  return db.query.projectCategories.findFirst({
    where: eq(projectCategories.id, id),
    with: {
      projects: true,
    },
  });
}

export async function createProjectCategory(data: NewProjectCategory) {
  const [projectCategory] = await db.insert(projectCategories).values(data).returning();
  return projectCategory;
}

export async function updateProjectCategory(id: string, data: Partial<NewProjectCategory>) {
  const [projectCategory] = await db
    .update(projectCategories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projectCategories.id, id))
    .returning();
  return projectCategory;
}

export async function deleteProjectCategory(id: string) {
  await db.delete(projectCategories).where(eq(projectCategories.id, id));
}

// ============ BUSINESS UNITS ============
export async function getAllBusinessUnits() {
  return db.query.businessUnits.findMany({
    with: {
      departments: true,
      brands: true,
    },
    orderBy: (bu: any, { asc }: any) => [asc(bu.name)],
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
    orderBy: (dept: any, { asc }: any) => [asc(dept.name)],
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
    orderBy: (brand: any, { asc }: any) => [asc(brand.name)],
  });
}

export async function getBrandsPaginated(limit: number = 10, offset: number = 0, search?: string) {
  const searchFilter = search 
    ? or(
        ilike(brands.name, `%${search}%`),
        ilike(brands.companyName, `%${search}%`)
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(brands)
    .where(searchFilter);
  const total = totalResult?.count ?? 0;
  
  const data = await db.query.brands.findMany({
    where: searchFilter,
    with: {
      businessUnit: true,
      employeeBrandAssignments: {
        with: {
          employee: true,
        },
      },
      projects: true,
    },
    orderBy: (brand: any, { asc }: any) => [asc(brand.name)],
    limit,
    offset,
  });
  
  return {
    data,
    total,
    hasMore: offset + data.length < total,
  };
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
    orderBy: (emp: any, { asc }: any) => [asc(emp.fullName)],
  });
}

export async function getEmployeesPaginated(limit: number = 10, offset: number = 0, search?: string) {
  const searchFilter = search 
    ? or(
        ilike(employees.fullName, `%${search}%`),
        ilike(employees.email, `%${search}%`),
        ilike(employees.position, `%${search}%`)
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(employees)
    .where(searchFilter);
  const total = totalResult?.count ?? 0;
  
  const data = await db.query.employees.findMany({
    where: searchFilter,
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
    orderBy: (emp: any, { asc }: any) => [asc(emp.fullName)],
    limit,
    offset,
  });
  
  return {
    data,
    total,
    hasMore: offset + data.length < total,
  };
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
      projectCategory: true,
      createdBy: true,
      assignments: {
        with: {
          employee: true,
        },
      },
      projectChannels: {
        with: {
          channel: true,
          deliverable: true,
        },
      },
    },
    orderBy: (proj: any, { asc }: any) => [asc(proj.name)],
  });
}

export async function getProjectsPaginated(limit: number = 10, offset: number = 0, search?: string) {
  // If search includes brand name, we need to use a different approach
  if (search) {
    const searchPattern = `%${search}%`;
    
    // Build search filter that includes brand name
    // Note: ilike on null column returns null (falsy), so we can safely use it directly
    const searchFilter = or(
      ilike(projects.name, searchPattern),
      ilike(projects.projectNumber, searchPattern),
      ilike(brands.name, searchPattern)
    );

    // Count total with brand name filter (requires JOIN)
    const [totalResult] = await db
      .select({ count: count() })
      .from(projects)
      .leftJoin(brands, eq(projects.brandId, brands.id))
      .where(searchFilter);
    const total = totalResult?.count ?? 0;

    // Fetch project IDs that match the search filter
    // Note: We need to include 'name' in SELECT DISTINCT to be able to ORDER BY it
    const projectIds = await db
      .selectDistinct({ id: projects.id, name: projects.name })
      .from(projects)
      .leftJoin(brands, eq(projects.brandId, brands.id))
      .where(searchFilter)
      .orderBy(asc(projects.name))
      .limit(limit)
      .offset(offset);

    // If no projects found, return empty result
    if (projectIds.length === 0) {
      return {
        data: [],
        total,
        hasMore: false,
      };
    }

    // Fetch full project data with relations for the filtered IDs
    const ids = projectIds.map((p: any) => p.id);
    const data = await db.query.projects.findMany({
      where: inArray(projects.id, ids),
      with: {
        brand: true,
        businessUnit: true,
        projectCategory: true,
        createdBy: true,
        assignments: {
          with: {
            employee: true,
          },
        },
        projectChannels: {
          with: {
            channel: true,
            deliverable: true,
          },
        },
      },
      orderBy: (proj: any, { asc }: any) => [asc(proj.name)],
    });

    return {
      data,
      total,
      hasMore: offset + data.length < total,
    };
  }

  // No search - use the simple relational query
  const searchFilter = undefined;

  const [totalResult] = await db
    .select({ count: count() })
    .from(projects)
    .where(searchFilter);
  const total = totalResult?.count ?? 0;

  const data = await db.query.projects.findMany({
    where: searchFilter,
    with: {
      brand: true,
      businessUnit: true,
      projectCategory: true,
      createdBy: true,
      assignments: {
        with: {
          employee: true,
        },
      },
      projectChannels: {
        with: {
          channel: true,
          deliverable: true,
        },
      },
    },
    orderBy: (proj: any, { asc }: any) => [asc(proj.name)],
    limit,
    offset,
  });

  return {
    data,
    total,
    hasMore: offset + data.length < total,
  };
}

export async function getProjectById(id: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      brand: true,
      businessUnit: true,
      projectCategory: true,
      createdBy: true,
      assignments: {
        with: {
          employee: true,
        },
      },
      projectChannels: {
        with: {
          channel: true,
          deliverable: true,
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
      projectChannels: {
        with: {
          channel: true,
          deliverable: true,
        },
      },
    },
    orderBy: (proj: any, { asc }: any) => [asc(proj.name)],
  });
}

export async function createProject(data: NewProject & { projectChannels?: NewProjectChannel[] }) {
  // Extract projectChannels if provided
  const { projectChannels: channels, ...projectData } = data;

  // Create the project
  const [project] = await db.insert(projects).values(projectData).returning();

  // If there are project channels, create them
  if (channels && channels.length > 0) {
    await db.insert(projectChannels).values(
      channels.map(channel => ({
        ...channel,
        projectId: project.id,
      }))
    );
  }

  // Return the project with its relations
  return getProjectById(project.id);
}

export async function updateProject(id: string, data: Partial<NewProject> & { projectChannels?: NewProjectChannel[] }) {
  // Extract projectChannels if provided
  const { projectChannels: channels, ...projectData } = data;

  // Update the project
  const [project] = await db
    .update(projects)
    .set({ ...projectData, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();

  // If projectChannels are provided, replace them
  if (channels !== undefined) {
    // Delete existing project channels
    await db.delete(projectChannels).where(eq(projectChannels.projectId, id));

    // Insert new project channels if any
    if (channels.length > 0) {
      await db.insert(projectChannels).values(
        channels.map(channel => ({
          ...channel,
          projectId: id,
        }))
      );
    }
  }

  // Return the updated project with its relations
  return getProjectById(id);
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
    orderBy: (assign: any, { asc }: any) => [asc(assign.startDate)],
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
    orderBy: (assign: any, { asc }: any) => [asc(assign.startDate)],
  });
}

export async function getAssignmentsByProject(projectId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.projectId, projectId),
    with: {
      employee: true,
    },
    orderBy: (assign: any, { asc }: any) => [asc(assign.startDate)],
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
