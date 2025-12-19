-- Migration: Create active_substances table
-- Description: Stores active substances with their maximum allowed doses and concentrations for regulatory compliance
-- Date: 2024

-- Create active_substances table
CREATE TABLE IF NOT EXISTS "active_substances" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "name" varchar(255) NOT NULL,
  "max_single_dose" numeric(10, 3),
  "max_daily_dose" numeric(10, 3),
  "max_concentration" numeric(5, 2),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "active_substances_name_unique" UNIQUE("name")
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS "idx_active_substances_name" ON "active_substances"("name");

-- Add comments for documentation
COMMENT ON TABLE "active_substances" IS 'Stores active substances with their maximum allowed doses and concentrations for regulatory compliance';
COMMENT ON COLUMN "active_substances"."name" IS 'Name of the active substance (e.g. Mitragynine)';
COMMENT ON COLUMN "active_substances"."max_single_dose" IS 'Maximum allowed single dose (e.g. 125 mg)';
COMMENT ON COLUMN "active_substances"."max_daily_dose" IS 'Maximum allowed daily dose (e.g. 375 mg)';
COMMENT ON COLUMN "active_substances"."max_concentration" IS 'Maximum allowed concentration (%)';

