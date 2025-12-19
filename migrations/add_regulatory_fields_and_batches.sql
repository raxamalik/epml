-- Migration: Add regulatory compliance fields to products table and create product_batches table
-- Date: 2024

-- Step 1: Add new regulatory compliance fields to products table
ALTER TABLE "products" 
  ADD COLUMN IF NOT EXISTS "substance_name" varchar(255),
  ADD COLUMN IF NOT EXISTS "form" varchar(50),
  ADD COLUMN IF NOT EXISTS "subtype" varchar(100),
  ADD COLUMN IF NOT EXISTS "package_size" varchar(50),
  ADD COLUMN IF NOT EXISTS "received_date" timestamp,
  ADD COLUMN IF NOT EXISTS "batch_number" varchar(100),
  ADD COLUMN IF NOT EXISTS "quantity_unit" varchar(20),
  ADD COLUMN IF NOT EXISTS "supplier_name" varchar(255);

-- Step 2: Create product_batches table for multiple batches per product per store
CREATE TABLE IF NOT EXISTS "product_batches" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "product_id" integer NOT NULL,
  "store_id" integer NOT NULL,
  "batch_number" varchar(100) NOT NULL,
  "received_date" timestamp NOT NULL,
  "quantity" integer NOT NULL DEFAULT 0,
  "quantity_unit" varchar(20) NOT NULL,
  "expiration_date" timestamp,
  "supplier_name" varchar(255),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "product_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "product_batches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

-- Step 3: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_product_batches_product_id" ON "product_batches"("product_id");
CREATE INDEX IF NOT EXISTS "idx_product_batches_store_id" ON "product_batches"("store_id");
CREATE INDEX IF NOT EXISTS "idx_product_batches_batch_number" ON "product_batches"("batch_number");
CREATE INDEX IF NOT EXISTS "idx_product_batches_expiration_date" ON "product_batches"("expiration_date");

-- Step 4: Add comment for documentation
COMMENT ON TABLE "product_batches" IS 'Stores multiple batches of the same product per store for regulatory compliance and inventory tracking';
COMMENT ON COLUMN "products"."substance_name" IS 'Name of the substance according to government regulation';
COMMENT ON COLUMN "products"."form" IS 'Product form (e.g. liquid, tablet, powder)';
COMMENT ON COLUMN "products"."subtype" IS 'More specific product subtype (if applicable)';
COMMENT ON COLUMN "products"."package_size" IS 'Size/volume of the package (e.g. 500ml, 30 tablets)';
COMMENT ON COLUMN "products"."received_date" IS 'Date the product was received (legacy - use product_batches for multiple batches)';
COMMENT ON COLUMN "products"."batch_number" IS 'Batch or lot number (legacy - use product_batches for multiple batches)';
COMMENT ON COLUMN "products"."quantity_unit" IS 'Unit of measurement (e.g. ml, pcs, kg)';
COMMENT ON COLUMN "products"."supplier_name" IS 'Name of the supplier (legacy - use product_batches for batch-specific suppliers)';

