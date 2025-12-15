-- Rollback Migration: Remove store_id column from product_categories table
-- Description: Reverts the store-specific category functionality
-- Date: 2024
-- WARNING: This will remove the store_id column and all store-specific category data

-- Step 1: Drop indexes
DROP INDEX IF EXISTS "idx_product_categories_company_store";
DROP INDEX IF EXISTS "idx_product_categories_store_id";

-- Step 2: Drop foreign key constraint
ALTER TABLE "product_categories" 
  DROP CONSTRAINT IF EXISTS "product_categories_store_id_fkey";

-- Step 3: Remove store_id column
ALTER TABLE "product_categories" 
  DROP COLUMN IF EXISTS "store_id";

