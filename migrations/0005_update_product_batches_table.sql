-- Migration: Update product_batches table and remove supplier_name from products
-- Description: Updates product_batches table structure and moves supplier_name from products to product_batches
-- Date: 2024

-- Step 1: Ensure batch_number is varchar (it should already be, but making sure)
-- Note: batch_number is already varchar(100) in product_batches, so no change needed

-- Step 2: Ensure store_id is integer with FK (it should already be, but making sure)
-- Note: store_id is already integer with FK in product_batches, so no change needed

-- Step 3: Add status field to product_batches table
ALTER TABLE "product_batches" 
  ADD COLUMN IF NOT EXISTS "status" varchar(50) DEFAULT 'Pending';

-- Step 4: Create index on status for better query performance
CREATE INDEX IF NOT EXISTS "idx_product_batches_status" ON "product_batches"("status");

-- Step 5: Remove supplier_name from products table (moved to product_batches)
-- Note: supplier_name already exists in product_batches table, so we're removing it from products
-- If you have existing data in products.supplier_name that needs to be preserved, 
-- you should migrate it to product_batches before running this migration
ALTER TABLE "products" DROP COLUMN IF EXISTS "supplier_name";

-- Step 6: Add comments for documentation
COMMENT ON COLUMN "product_batches"."status" IS 'Batch status for internal control (e.g. "Pending", "Released", "Blocked")';
COMMENT ON COLUMN "product_batches"."batch_number" IS 'Batch codes may be alphanumeric';
COMMENT ON COLUMN "product_batches"."store_id" IS 'Foreign key reference to stores table for referential integrity';
COMMENT ON COLUMN "product_batches"."supplier_name" IS 'Each batch may have a different supplier';

