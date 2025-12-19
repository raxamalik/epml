-- Add company_id column to active_substances table for company-level isolation
ALTER TABLE "active_substances"
  ADD COLUMN IF NOT EXISTS "company_id" integer NOT NULL DEFAULT 1 REFERENCES "companies"("id") ON DELETE CASCADE;

-- Create index on company_id for better query performance
CREATE INDEX IF NOT EXISTS "idx_active_substances_company_id" ON "active_substances"("company_id");

-- Remove the unique constraint on name (since we need unique per company)
ALTER TABLE "active_substances" DROP CONSTRAINT IF EXISTS "active_substances_name_unique";

-- Add unique constraint on (name, company_id) to prevent duplicate names within the same company
CREATE UNIQUE INDEX IF NOT EXISTS "active_substances_name_company_unique" ON "active_substances"("name", "company_id");

-- Update existing records to have a default company_id (if any exist)
-- This assumes company with id=1 exists, adjust if needed
UPDATE "active_substances" SET "company_id" = 1 WHERE "company_id" IS NULL;

