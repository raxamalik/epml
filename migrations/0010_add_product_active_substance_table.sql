-- Create product_active_substance join table
-- This table records what substances are in each product

CREATE TABLE IF NOT EXISTS "product_active_substance" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "product_id" integer NOT NULL,
  "substance_id" integer NOT NULL,
  "content_amount" numeric(10, 3),
  "content_unit" varchar(20),
  "concentration" numeric(5, 2),
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "product_active_substance_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "product_active_substance_substance_id_fkey" FOREIGN KEY ("substance_id") REFERENCES "active_substances"("id") ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_product_active_substance_product_id" ON "product_active_substance"("product_id");
CREATE INDEX IF NOT EXISTS "idx_product_active_substance_substance_id" ON "product_active_substance"("substance_id");

-- Create unique index to ensure one substance per product (or allow multiple with different amounts)
-- Note: If you want to allow multiple entries of the same substance for a product with different amounts,
-- remove the unique constraint. For now, we'll allow multiple entries.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_active_substance_unique" ON "product_active_substance"("product_id", "substance_id");

