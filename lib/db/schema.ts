import { pgTable, uuid, text, integer, timestamp, boolean, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Brands table
export const brands = pgTable('brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#3b82f6'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Resources (team members) table
export const resources = pgTable('resources', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  department: text('department').notNull(),
  capacity: integer('capacity').notNull().default(40), // hours per week
  brandId: uuid('brand_id').references(() => brands.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  brandId: uuid('brand_id').references(() => brands.id).notNull(),
  color: text('color').notNull().default('#10b981'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Assignments table
export const assignments = pgTable('assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  resourceId: uuid('resource_id').references(() => resources.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  hoursPerDay: integer('hours_per_day').notNull().default(8),
  isTimeOff: boolean('is_time_off').notNull().default(false),
  category: text('category'), // 'Design', 'Development', 'Management', etc.
  isBillable: boolean('is_billable').notNull().default(true),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const brandsRelations = relations(brands, ({ many }) => ({
  resources: many(resources),
  projects: many(projects),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  brand: one(brands, {
    fields: [resources.brandId],
    references: [brands.id],
  }),
  assignments: many(assignments),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  brand: one(brands, {
    fields: [projects.brandId],
    references: [brands.id],
  }),
  assignments: many(assignments),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  resource: one(resources, {
    fields: [assignments.resourceId],
    references: [resources.id],
  }),
  project: one(projects, {
    fields: [assignments.projectId],
    references: [projects.id],
  }),
}));

// Type exports for use in application
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
