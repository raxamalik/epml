-- Migration: Update shopping_carts table to support company users
-- Description: Makes userId nullable and adds companyId to support company users
--   - Company users have IDs like "company_19" which don't exist in users table
--   - Similar to how sales table handles company users
-- Date: 2024

-- Step 1: Drop the foreign key constraint temporarily
ALTER TABLE "shopping_carts" 
  DROP CONSTRAINT IF EXISTS "shopping_carts_user_id_fkey";

-- Step 2: Add company_id column
ALTER TABLE "shopping_carts" 
  ADD COLUMN IF NOT EXISTS "company_id" integer REFERENCES companies(id) ON DELETE CASCADE;

-- Step 3: Make user_id nullable (to support company users)
ALTER TABLE "shopping_carts" 
  ALTER COLUMN "user_id" DROP NOT NULL;

-- Step 4: Re-add foreign key constraint (now nullable)
ALTER TABLE "shopping_carts"
  ADD CONSTRAINT "shopping_carts_user_id_fkey" 
  FOREIGN KEY ("user_id") 
  REFERENCES users(id) 
  ON DELETE CASCADE;

-- Step 5: Update indexes to include company_id
DROP INDEX IF EXISTS "IDX_cart_user_store";
CREATE INDEX IF NOT EXISTS "IDX_cart_user_store" 
  ON "shopping_carts"("user_id", "store_id") 
  WHERE "user_id" IS NOT NULL;

DROP INDEX IF EXISTS "IDX_cart_company_store";
CREATE INDEX IF NOT EXISTS "IDX_cart_company_store" 
  ON "shopping_carts"("company_id", "store_id") 
  WHERE "company_id" IS NOT NULL;

DROP INDEX IF EXISTS "IDX_cart_user_product";
CREATE INDEX IF NOT EXISTS "IDX_cart_user_product" 
  ON "shopping_carts"("user_id", "product_id") 
  WHERE "user_id" IS NOT NULL;

-- Step 6: Update unique constraint to handle both user and company
DROP INDEX IF EXISTS "IDX_cart_user_store_product";
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_user_store_product" 
  ON "shopping_carts"("user_id", "store_id", "product_id") 
  WHERE "user_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_company_store_product" 
  ON "shopping_carts"("company_id", "store_id", "product_id") 
  WHERE "company_id" IS NOT NULL;

-- Step 7: Add check constraint to ensure either userId or companyId is set
ALTER TABLE "shopping_carts"
  DROP CONSTRAINT IF EXISTS "shopping_carts_user_or_company_check";

ALTER TABLE "shopping_carts"
  ADD CONSTRAINT "shopping_carts_user_or_company_check" 
  CHECK (
    ("user_id" IS NOT NULL AND "company_id" IS NULL) OR 
    ("user_id" IS NULL AND "company_id" IS NOT NULL)
  );

-- Step 8: Update comments
COMMENT ON COLUMN "shopping_carts"."user_id" IS 
  'User ID who owns this cart item (null for company users)';

COMMENT ON COLUMN "shopping_carts"."company_id" IS 
  'Company ID who owns this cart item (null for regular users)';

