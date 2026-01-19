import { eq } from 'drizzle-orm';
import { db } from './index';
import { brands, resources, projects, assignments } from './schema';
import type { NewBrand, NewResource, NewProject, NewAssignment } from './schema';

// ============ BRANDS ============
export async function getAllBrands() {
  return db.query.brands.findMany({
    with: {
      resources: true,
      projects: true,
    },
  });
}

export async function createBrand(data: NewBrand) {
  const [brand] = await db.insert(brands).values(data).returning();
  return brand;
}

export async function updateBrand(id: string, data: Partial<NewBrand>) {
  const [brand] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
  return brand;
}

export async function deleteBrand(id: string) {
  await db.delete(brands).where(eq(brands.id, id));
}

// ============ RESOURCES ============
export async function getAllResources() {
  return db.query.resources.findMany({
    with: {
      brand: true,
      assignments: true,
    },
  });
}

export async function createResource(data: NewResource) {
  const [resource] = await db.insert(resources).values(data).returning();
  return resource;
}

export async function updateResource(id: string, data: Partial<NewResource>) {
  const [resource] = await db.update(resources).set(data).where(eq(resources.id, id)).returning();
  return resource;
}

export async function deleteResource(id: string) {
  await db.delete(resources).where(eq(resources.id, id));
}

// ============ PROJECTS ============
export async function getAllProjects() {
  return db.query.projects.findMany({
    with: {
      brand: true,
      assignments: true,
    },
  });
}

export async function createProject(data: NewProject) {
  const [project] = await db.insert(projects).values(data).returning();
  return project;
}

export async function updateProject(id: string, data: Partial<NewProject>) {
  const [project] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
  return project;
}

export async function deleteProject(id: string) {
  await db.delete(projects).where(eq(projects.id, id));
}

// ============ ASSIGNMENTS ============
export async function getAllAssignments() {
  return db.query.assignments.findMany({
    with: {
      resource: true,
      project: true,
    },
  });
}

export async function getAssignmentsByResource(resourceId: string) {
  return db.query.assignments.findMany({
    where: eq(assignments.resourceId, resourceId),
    with: {
      project: true,
    },
  });
}

export async function createAssignment(data: NewAssignment) {
  const [assignment] = await db.insert(assignments).values(data).returning();
  return assignment;
}

export async function updateAssignment(id: string, data: Partial<NewAssignment>) {
  const [assignment] = await db.update(assignments).set(data).where(eq(assignments.id, id)).returning();
  return assignment;
}

export async function deleteAssignment(id: string) {
  await db.delete(assignments).where(eq(assignments.id, id));
}
