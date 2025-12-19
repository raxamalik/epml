-- Migration: Add store_id column to product_categories table
-- Description: Enables store-specific categories. 
--   - store_id = NULL: Company-wide category (available to all stores)
--   - store_id = <store_id>: Store-specific category (only for that store)
-- Date: 2024

-- Step 1: Add store_id column to product_categories table
ALTER TABLE "product_categories" 
  ADD COLUMN IF NOT EXISTS "store_id" integer;

-- Step 2: Add foreign key constraint to stores table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'product_categories_store_id_fkey'
  ) THEN
    ALTER TABLE "product_categories"
      ADD CONSTRAINT "product_categories_store_id_fkey" 
      FOREIGN KEY ("store_id") 
      REFERENCES "stores"("id") 
      ON DELETE CASCADE;
  END IF;
END $$;

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_product_categories_store_id" 
  ON "product_categories"("store_id");

CREATE INDEX IF NOT EXISTS "idx_product_categories_company_store" 
  ON "product_categories"("company_id", "store_id");

-- Step 4: Add comments for documentation
COMMENT ON COLUMN "product_categories"."store_id" IS 
  'Store ID for store-specific categories. NULL = company-wide category (available to all stores), set = store-specific category (only for that store)';

-- Step 5: Update existing categories to be company-wide (optional - only if you want to set existing categories)
-- Uncomment the following line if you want to ensure all existing categories are company-wide:
-- UPDATE "product_categories" SET "store_id" = NULL WHERE "store_id" IS NULL;

