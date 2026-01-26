CREATE TABLE "project_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "project_category_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_category_id_project_categories_id_fk" FOREIGN KEY ("project_category_id") REFERENCES "public"."project_categories"("id") ON DELETE no action ON UPDATE no action;