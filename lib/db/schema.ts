import { pgTable, uuid, text, integer, timestamp, boolean, date, decimal, pgEnum, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============ ENUMS ============
export const brandStatusEnum = pgEnum('brand_status', ['active', 'inactive', 'prospect']);
export const employmentStatusEnum = pgEnum('employment_status', ['active', 'inactive', 'contractor']);
export const visibilityEnum = pgEnum('visibility', ['active', 'archived']);
export const projectStatusEnum = pgEnum('project_status', ['planning', 'active', 'on_hold', 'completed', 'cancelled']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['draft', 'confirmed', 'completed']);

// ============ TABLES ============

// 1. Business Units table (NEW)
export const businessUnits = pgTable('business_units', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  color: text('color').notNull().default('#3b82f6'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 2. Departments table (NEW - formalized from resources.department text field)
export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessUnitId: uuid('business_unit_id').references(() => businessUnits.id),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  color: text('color').notNull().default('#10b981'),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 3. Brands table (ENHANCED - add 12 new fields)
export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessUnitId: uuid('business_unit_id').references(() => businessUnits.id),
  name: text('name').notNull(),
  clientCode: text('client_code').unique(),
  color: text('color').notNull().default('#3b82f6'),
  logo: text('logo'),
  website: text('website'),
  contactName: text('contact_name'),
  contactTitle: text('contact_title'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  industryCategory: text('industry_category'),
  description: text('description'),
  status: brandStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 4. Employees table (RENAMED from resources + enhanced)
export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeNumber: text('employee_number').unique(),
  fullName: text('full_name').notNull(),
  nickname: text('nickname'),
  email: text('email'),
  photo: text('photo'),
  position: text('position').notNull(),
  departmentId: uuid('department_id').references(() => departments.id),
  businessUnitId: uuid('business_unit_id').references(() => businessUnits.id),
  directSupervisorId: uuid('direct_supervisor_id').references((): ReturnType<typeof uuid> => employees.id),
  weeklyCapacity: integer('weekly_capacity').notNull().default(40),
  workStartDate: date('work_start_date'),
  dateOfBirth: date('date_of_birth'),
  employmentStatus: employmentStatusEnum('employment_status').notNull().default('active'),
  visibility: visibilityEnum('visibility').notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 5. Employee Brand Assignments table (NEW - junction table for many-to-many)
export const employeeBrandAssignments = pgTable('employee_brand_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  unique('employee_brand_unique').on(table.employeeId, table.brandId),
]);

// 6. Projects table (ENHANCED - add 12 new fields)
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id').references(() => brands.id).notNull(),
  businessUnitId: uuid('business_unit_id').references(() => businessUnits.id),
  projectTypeId: uuid('project_type_id'), // For future phase, make nullable
  name: text('name').notNull(),
  projectNumber: text('project_number').unique(),
  description: text('description'),
  color: text('color').notNull().default('#10b981'),
  budget: decimal('budget', { precision: 12, scale: 2 }),
  currency: text('currency').notNull().default('USD'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: projectStatusEnum('status').notNull().default('active'),
  createdById: uuid('created_by_id').references(() => employees.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 7. Assignments table (ENHANCED)
export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }).notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id'), // For future phase
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  hoursPerDay: decimal('hours_per_day', { precision: 4, scale: 2 }).notNull().default('8'),
  allocationPercentage: decimal('allocation_percentage', { precision: 5, scale: 2 }),
  isTimeOff: boolean('is_time_off').notNull().default(false),
  timeOffTypeId: uuid('time_off_type_id'), // For future phase
  category: text('category'),
  isBillable: boolean('is_billable').notNull().default(true),
  status: assignmentStatusEnum('status').notNull().default('confirmed'),
  note: text('note'),
  createdById: uuid('created_by_id').references(() => employees.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============ RELATIONS ============

export const businessUnitsRelations = relations(businessUnits, ({ many }) => ({
  departments: many(departments),
  brands: many(brands),
  employees: many(employees),
  projects: many(projects),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  businessUnit: one(businessUnits, {
    fields: [departments.businessUnitId],
    references: [businessUnits.id],
  }),
  employees: many(employees),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  businessUnit: one(businessUnits, {
    fields: [brands.businessUnitId],
    references: [businessUnits.id],
  }),
  employeeBrandAssignments: many(employeeBrandAssignments),
  projects: many(projects),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  businessUnit: one(businessUnits, {
    fields: [employees.businessUnitId],
    references: [businessUnits.id],
  }),
  supervisor: one(employees, {
    fields: [employees.directSupervisorId],
    references: [employees.id],
    relationName: 'supervisor',
  }),
  subordinates: many(employees, { relationName: 'supervisor' }),
  employeeBrandAssignments: many(employeeBrandAssignments),
  assignments: many(assignments, { relationName: 'assignedEmployee' }),
  createdProjects: many(projects),
  createdAssignments: many(assignments, { relationName: 'createdBy' }),
}));

export const employeeBrandAssignmentsRelations = relations(employeeBrandAssignments, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeBrandAssignments.employeeId],
    references: [employees.id],
  }),
  brand: one(brands, {
    fields: [employeeBrandAssignments.brandId],
    references: [brands.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  brand: one(brands, {
    fields: [projects.brandId],
    references: [brands.id],
  }),
  businessUnit: one(businessUnits, {
    fields: [projects.businessUnitId],
    references: [businessUnits.id],
  }),
  createdBy: one(employees, {
    fields: [projects.createdById],
    references: [employees.id],
  }),
  assignments: many(assignments),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  employee: one(employees, {
    fields: [assignments.employeeId],
    references: [employees.id],
    relationName: 'assignedEmployee',
  }),
  project: one(projects, {
    fields: [assignments.projectId],
    references: [projects.id],
  }),
  createdBy: one(employees, {
    fields: [assignments.createdById],
    references: [employees.id],
    relationName: 'createdBy',
  }),
}));

// ============ TYPE EXPORTS ============
export type BusinessUnit = typeof businessUnits.$inferSelect;
export type NewBusinessUnit = typeof businessUnits.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type EmployeeBrandAssignment = typeof employeeBrandAssignments.$inferSelect;
export type NewEmployeeBrandAssignment = typeof employeeBrandAssignments.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
