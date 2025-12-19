-- Migration: Add category_stores junction table
-- Description: Allows categories to be associated with multiple stores
--   - Company admins can create categories for specific stores or all stores
--   - If no entries in this table, category is company-wide (all stores)
--   - If entries exist, category is only for those specific stores
-- Date: 2024

-- Step 1: Create category_stores junction table
CREATE TABLE IF NOT EXISTS "category_stores" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "category_id" integer NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  "store_id" integer NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now(),
  UNIQUE("category_id", "store_id")
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_category_stores_category" 
  ON "category_stores"("category_id");

CREATE INDEX IF NOT EXISTS "IDX_category_stores_store" 
  ON "category_stores"("store_id");

-- Step 3: Add comments for documentation
COMMENT ON TABLE "category_stores" IS 
  'Junction table linking categories to stores. If a category has entries here, it is only available to those stores. If no entries, category is company-wide.';

COMMENT ON COLUMN "category_stores"."category_id" IS 
  'Category ID';

COMMENT ON COLUMN "category_stores"."store_id" IS 
  'Store ID where this category is available';

