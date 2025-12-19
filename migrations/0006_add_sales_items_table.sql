-- Migration: Create sales_items table
-- Description: Creates a normalized table for sales line items, replacing JSONB items in sales table
-- Date: 2024

-- Create sales_items table
CREATE TABLE IF NOT EXISTS "sales_items" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sale_id" varchar NOT NULL,
  "product_id" integer NOT NULL,
  "batch_id" integer,
  "quantity" numeric(10, 3) NOT NULL,
  "unit_price" numeric(10, 2) NOT NULL,
  "vat_rate" numeric(5, 2) NOT NULL,
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "sales_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE,
  CONSTRAINT "sales_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "sales_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_sales_items_sale_id" ON "sales_items"("sale_id");
CREATE INDEX IF NOT EXISTS "idx_sales_items_product_id" ON "sales_items"("product_id");
CREATE INDEX IF NOT EXISTS "idx_sales_items_batch_id" ON "sales_items"("batch_id");

-- Add comments for documentation
COMMENT ON TABLE "sales_items" IS 'Stores individual line items for each sale transaction';
COMMENT ON COLUMN "sales_items"."sale_id" IS 'Reference to sale transaction';
COMMENT ON COLUMN "sales_items"."product_id" IS 'Product sold';
COMMENT ON COLUMN "sales_items"."batch_id" IS 'Batch that was sold (nullable - not all products may have batches)';
COMMENT ON COLUMN "sales_items"."quantity" IS 'Quantity sold';
COMMENT ON COLUMN "sales_items"."unit_price" IS 'Unit price';
COMMENT ON COLUMN "sales_items"."vat_rate" IS 'VAT percentage';

