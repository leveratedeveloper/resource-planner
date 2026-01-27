import { pgTable, uuid, text, integer, timestamp, boolean, date, decimal, pgEnum, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============ ENUMS ============
export const brandStatusEnum = pgEnum('brand_status', ['active', 'inactive', 'prospect']);
export const employmentStatusEnum = pgEnum('employment_status', ['active', 'inactive', 'contractor']);
export const visibilityEnum = pgEnum('visibility', ['active', 'archived']);
export const projectStatusEnum = pgEnum('project_status', ['planning', 'active', 'on_hold', 'completed', 'cancelled']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['draft', 'confirmed', 'completed']);
export const projectTypeEnum = pgEnum('project_type', ['pitch', 'campaign']);
export const pitchStatusEnum = pgEnum('pitch_status', [
  'introduction',
  'waiting_for_brief',
  'proposal_development',
  'submit_or_presentation',
  'waiting_for_feedback',
  'negotiation',
  'won',
  'lost',
  'cancelled',
  'missing',
  'withdraw'
]);
// Timetrack integration enums
export const syncStatusEnum = pgEnum('sync_status', ['local', 'synced', 'pending', 'conflict']);
export const sourceSystemEnum = pgEnum('source_system', ['timetrack', 'resource_planner']);
export const syncOperationEnum = pgEnum('sync_operation', ['create', 'update', 'delete', 'sync']);
export const syncEntityTypeEnum = pgEnum('sync_entity_type', ['employee', 'brand', 'business_unit', 'department', 'project', 'timesheet']);

// ============ TABLES ============

// 0. Project Categories table (NEW - for project categorization)
export const projectCategories = pgTable('project_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description'),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 1. Business Units table (NEW)
export const businessUnits = pgTable('business_units', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  color: text('color').notNull().default('#3b82f6'),
  logo: text('logo'), // Logo URL for business unit
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 1a. Channel Classifications table (for pitch channels/deliverables)
export const channelClassifications = pgTable('channel_classifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelName: text('channel_name').notNull(),
  channelNameNew: text('channel_name_new'),
  flag: text('flag').notNull().default('active'), // 'active' or 'inactive'
  displayOrder: integer('display_order'),
  pillarsId: integer('pillars_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 1b. Deliverables table (linked to channels)
export const deliverables = pgTable('deliverables', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').references(() => channelClassifications.id),
  deliverableName: text('deliverable_name').notNull(),
  deliverableNameNew: text('deliverable_name_new'),
  flag: text('flag').notNull().default('active'),
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
  companyName: text('company_name'), // Parent company name (e.g., "PT KAO Indonesia")
  brandAddress: text('brand_address'), // Physical address
  clientCode: text('client_code').unique(),
  color: text('color').notNull().default('#3b82f6'),
  logo: text('logo'),
  website: text('website'),
  contactName: text('contact_name'),
  contactTitle: text('contact_title'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  picFinanceName: text('pic_finance_name'), // Finance contact person name
  picFinancePhone: text('pic_finance_phone'), // Finance contact phone number
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
  directSupervisorId: uuid('direct_supervisor_id').references(() => employees.id),
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

// 6. Projects table (ENHANCED - add 12 new fields + pitch/campaign split + Timetrack sync)
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandId: uuid('brand_id').references(() => brands.id).notNull(),
  businessUnitId: uuid('business_unit_id').references(() => businessUnits.id),
  projectCategoryId: uuid('project_category_id').references(() => projectCategories.id),
  projectTypeId: uuid('project_type_id'), // For future phase, make nullable
  projectType: projectTypeEnum('project_type').notNull().default('campaign'), // NEW - pitch or campaign
  entity: text('entity'), // NEW - LSI, SSI, or LMA
  name: text('name').notNull(),
  projectNumber: text('project_number').unique(),
  description: text('description'),
  color: text('color').notNull().default('#10b981'),
  budget: decimal('budget', { precision: 15, scale: 2 }), // Updated precision from 12 to 15
  asf: decimal('asf', { precision: 15, scale: 2 }), // NEW - Administrative Service Fee
  grandTotal: decimal('grand_total', { precision: 15, scale: 2 }), // NEW - Total (budget + asf)
  currency: text('currency').notNull().default('USD'),
  ioFile: text('io_file'), // NEW - IO file path/URL
  flag: text('flag'), // NEW - Flag/marker
  quotationReference: text('quotation_reference'), // NEW - Quotation ref
  startDate: date('start_date'),
  endDate: date('end_date'),
  status: projectStatusEnum('status').notNull().default('active'),
  createdById: uuid('created_by_id').references(() => employees.id),
  notes: text('notes'),
  // Pitch-specific fields (nullable for campaigns)
  region: text('region').default('Indonesia'),
  submitDate: date('submit_date'),
  pitchStatus: pitchStatusEnum('pitch_status'),
  valueTotalEstimate: decimal('value_total_estimate', { precision: 15, scale: 2 }),
  hsDealId: text('hs_deal_id'),
  // Timetrack integration fields
  timetrackCampaignId: integer('timetrack_campaign_id'),
  syncStatus: syncStatusEnum('sync_status').notNull().default('local'),
  lastSyncedAt: timestamp('last_synced_at'),
  sourceSystem: sourceSystemEnum('source_system').notNull().default('resource_planner'),
  syncErrorMessage: text('sync_error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 6a. Project Channels table (for pitch channels/deliverables assignments)
export const projectChannels = pgTable('project_channels', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  channelId: uuid('channel_id').references(() => channelClassifications.id).notNull(),
  deliverableId: uuid('deliverable_id').references(() => deliverables.id),
  quantity: text('quantity'),
  channelBudget: decimal('channel_budget', { precision: 15, scale: 2 }),
  manHours: text('man_hours'),
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

// ============ TIMETRACK INTEGRATION TABLES ============

// 8. Timesheet Cache table (for actual hours from Timetrack)
export const timesheetCache = pgTable('timesheet_cache', {
  id: uuid('id').defaultRandom().primaryKey(),
  timetrackEmployeeId: integer('timetrack_employee_id').notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  date: date('date').notNull(),
  hours: decimal('hours', { precision: 5, scale: 2 }).notNull(),
  billable: boolean('billable').notNull().default(true),
  taskDescription: text('task_description'),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
}, (table) => [
  unique('timesheet_cache_unique').on(table.timetrackEmployeeId, table.projectId, table.date),
]);

// 9. Sync Audit Log table (tracks all sync operations)
export const syncAuditLog = pgTable('sync_audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  entityType: syncEntityTypeEnum('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  operation: syncOperationEnum('operation').notNull(),
  sourceSystem: sourceSystemEnum('source_system').notNull(),
  targetSystem: sourceSystemEnum('target_system').notNull(),
  status: text('status').notNull(), // 'pending', 'success', 'failed', 'conflict'
  errorMessage: text('error_message'),
  payload: text('payload'), // JSON string of the data
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============ RELATIONS ============

export const channelClassificationsRelations = relations(channelClassifications, ({ many }) => ({
  deliverables: many(deliverables),
  projectChannels: many(projectChannels),
}));

export const deliverablesRelations = relations(deliverables, ({ one, many }) => ({
  channel: one(channelClassifications, {
    fields: [deliverables.channelId],
    references: [channelClassifications.id],
  }),
  projectChannels: many(projectChannels),
}));

export const projectChannelsRelations = relations(projectChannels, ({ one }) => ({
  project: one(projects, {
    fields: [projectChannels.projectId],
    references: [projects.id],
  }),
  channel: one(channelClassifications, {
    fields: [projectChannels.channelId],
    references: [channelClassifications.id],
  }),
  deliverable: one(deliverables, {
    fields: [projectChannels.deliverableId],
    references: [deliverables.id],
  }),
}));

export const projectCategoriesRelations = relations(projectCategories, ({ many }) => ({
  projects: many(projects),
}));

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
  projectCategory: one(projectCategories, {
    fields: [projects.projectCategoryId],
    references: [projectCategories.id],
  }),
  createdBy: one(employees, {
    fields: [projects.createdById],
    references: [employees.id],
  }),
  assignments: many(assignments),
  projectChannels: many(projectChannels),
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

// Add relations for new tables
export const timesheetCacheRelations = relations(timesheetCache, ({ one }) => ({
  project: one(projects, {
    fields: [timesheetCache.projectId],
    references: [projects.id],
  }),
}));

// ============ TYPE EXPORTS ============
export type ProjectCategory = typeof projectCategories.$inferSelect;
export type NewProjectCategory = typeof projectCategories.$inferInsert;
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
export type ChannelClassification = typeof channelClassifications.$inferSelect;
export type NewChannelClassification = typeof channelClassifications.$inferInsert;
export type Deliverable = typeof deliverables.$inferSelect;
export type NewDeliverable = typeof deliverables.$inferInsert;
export type ProjectChannel = typeof projectChannels.$inferSelect;
export type NewProjectChannel = typeof projectChannels.$inferInsert;
export type TimesheetCache = typeof timesheetCache.$inferSelect;
export type NewTimesheetCache = typeof timesheetCache.$inferInsert;
export type SyncAuditLog = typeof syncAuditLog.$inferSelect;
export type NewSyncAuditLog = typeof syncAuditLog.$inferInsert;
