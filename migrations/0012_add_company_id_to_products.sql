-- Add company_id column to products table for company-wide products
-- This allows products to be either store-specific (storeId set) or company-wide (storeId null, companyId set)

-- Make storeId nullable (if it's not already)
ALTER TABLE "products" 
  ALTER COLUMN "store_id" DROP NOT NULL;

-- Add company_id column
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "company_id" integer REFERENCES "companies"("id") ON DELETE CASCADE;

-- Create index on company_id for better query performance
CREATE INDEX IF NOT EXISTS "idx_products_company_id" ON "products"("company_id");

-- Update existing products to set company_id based on their store's company
UPDATE "products" p
SET "company_id" = s."company_id"
FROM "stores" s
WHERE p."store_id" = s."id" AND p."company_id" IS NULL;

