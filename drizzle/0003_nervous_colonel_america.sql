CREATE TYPE "public"."pitch_status" AS ENUM('introduction', 'waiting_for_brief', 'proposal_development', 'submit_or_presentation', 'waiting_for_feedback', 'negotiation', 'won', 'lost', 'cancelled', 'missing', 'withdraw');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('pitch', 'campaign');--> statement-breakpoint
CREATE TYPE "public"."source_system" AS ENUM('timetrack', 'resource_planner');--> statement-breakpoint
CREATE TYPE "public"."sync_entity_type" AS ENUM('employee', 'brand', 'business_unit', 'department', 'project', 'timesheet');--> statement-breakpoint
CREATE TYPE "public"."sync_operation" AS ENUM('create', 'update', 'delete', 'sync');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('local', 'synced', 'pending', 'conflict');--> statement-breakpoint
CREATE TABLE "channel_classifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_name" text NOT NULL,
	"channel_name_new" text,
	"flag" text DEFAULT 'active' NOT NULL,
	"display_order" integer,
	"pillars_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid,
	"deliverable_name" text NOT NULL,
	"deliverable_name_new" text,
	"flag" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"deliverable_id" uuid,
	"quantity" text,
	"channel_budget" numeric(15, 2),
	"man_hours" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "sync_entity_type" NOT NULL,
	"entity_id" text NOT NULL,
	"operation" "sync_operation" NOT NULL,
	"source_system" "source_system" NOT NULL,
	"target_system" "source_system" NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"payload" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timesheet_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timetrack_employee_id" integer NOT NULL,
	"project_id" uuid NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"task_description" text,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "timesheet_cache_unique" UNIQUE("timetrack_employee_id","project_id","date")
);
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "budget" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "business_units" ADD COLUMN "logo" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_type" "project_type" DEFAULT 'campaign' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "entity" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "asf" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "grand_total" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "io_file" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "flag" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "quotation_reference" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "region" text DEFAULT 'Indonesia';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "submit_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "pitch_status" "pitch_status";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "value_total_estimate" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "hs_deal_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "timetrack_campaign_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sync_status" "sync_status" DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_system" "source_system" DEFAULT 'resource_planner' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sync_error_message" text;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_channel_id_channel_classifications_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel_classifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_channels" ADD CONSTRAINT "project_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_channels" ADD CONSTRAINT "project_channels_channel_id_channel_classifications_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel_classifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_channels" ADD CONSTRAINT "project_channels_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timesheet_cache" ADD CONSTRAINT "timesheet_cache_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;