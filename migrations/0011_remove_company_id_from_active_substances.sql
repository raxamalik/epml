-- Remove company_id column from active_substances table
-- Active substances are now managed only by Super Admin and not linked to companies

-- Drop the unique constraint on (name, company_id)
DROP INDEX IF EXISTS "active_substances_name_company_unique";

-- Drop the index on company_id
DROP INDEX IF EXISTS "idx_active_substances_company_id";

-- Drop the company_id column
ALTER TABLE "active_substances" DROP COLUMN IF EXISTS "company_id";

-- Re-add unique constraint on name (since names should be unique globally now)
CREATE UNIQUE INDEX IF NOT EXISTS "active_substances_name_unique" ON "active_substances"("name");

