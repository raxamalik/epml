-- Migration: Add cancellation field to sales and create returns table
-- Description: Adds is_cancelled field to sales table and creates returns table for returned goods
-- Date: 2024

-- Step 1: Add is_cancelled field to sales table
ALTER TABLE "sales" 
  ADD COLUMN IF NOT EXISTS "is_cancelled" boolean DEFAULT false;

-- Step 2: Create index on is_cancelled for better query performance
CREATE INDEX IF NOT EXISTS "idx_sales_is_cancelled" ON "sales"("is_cancelled");

-- Step 3: Create returns table for returned goods
CREATE TABLE IF NOT EXISTS "returns" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "sale_id" varchar NOT NULL,
  "return_date" timestamp NOT NULL DEFAULT now(),
  "reason" text,
  "total_refund" numeric(10, 2) NOT NULL,
  "refund_method" varchar(50) NOT NULL, -- e.g. "cash", "card", "store_credit"
  "status" varchar(50) DEFAULT 'pending', -- e.g. "pending", "approved", "completed", "rejected"
  "store_id" integer NOT NULL,
  "user_id" varchar,
  "processed_by" varchar, -- User who processed the return
  "processed_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT,
  CONSTRAINT "returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT,
  CONSTRAINT "returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "returns_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Step 4: Create returns_items table for individual returned items
CREATE TABLE IF NOT EXISTS "returns_items" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "return_id" integer NOT NULL,
  "sale_item_id" integer NOT NULL, -- Reference to the original sale item
  "product_id" integer NOT NULL,
  "batch_id" integer,
  "quantity" numeric(10, 3) NOT NULL,
  "unit_price" numeric(10, 2) NOT NULL,
  "vat_rate" numeric(5, 2) NOT NULL,
  "refund_amount" numeric(10, 2) NOT NULL,
  "reason" text,
  "condition" varchar(50), -- e.g. "new", "used", "damaged"
  "created_at" timestamp DEFAULT now(),
  CONSTRAINT "returns_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE,
  CONSTRAINT "returns_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sales_items"("id") ON DELETE RESTRICT,
  CONSTRAINT "returns_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
  CONSTRAINT "returns_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL
);

-- Step 5: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_returns_sale_id" ON "returns"("sale_id");
CREATE INDEX IF NOT EXISTS "idx_returns_store_id" ON "returns"("store_id");
CREATE INDEX IF NOT EXISTS "idx_returns_status" ON "returns"("status");
CREATE INDEX IF NOT EXISTS "idx_returns_return_date" ON "returns"("return_date");
CREATE INDEX IF NOT EXISTS "idx_returns_items_return_id" ON "returns_items"("return_id");
CREATE INDEX IF NOT EXISTS "idx_returns_items_sale_item_id" ON "returns_items"("sale_item_id");
CREATE INDEX IF NOT EXISTS "idx_returns_items_product_id" ON "returns_items"("product_id");

-- Step 6: Add comments for documentation
COMMENT ON COLUMN "sales"."is_cancelled" IS 'Mark for canceled/voided sales';
COMMENT ON TABLE "returns" IS 'Stores return transactions for returned goods';
COMMENT ON COLUMN "returns"."sale_id" IS 'Reference to the original sale';
COMMENT ON COLUMN "returns"."return_date" IS 'Date when the return was initiated';
COMMENT ON COLUMN "returns"."reason" IS 'Reason for the return';
COMMENT ON COLUMN "returns"."total_refund" IS 'Total amount to be refunded';
COMMENT ON COLUMN "returns"."refund_method" IS 'Method of refund (cash, card, store_credit)';
COMMENT ON COLUMN "returns"."status" IS 'Return status (pending, approved, completed, rejected)';
COMMENT ON TABLE "returns_items" IS 'Stores individual items being returned';
COMMENT ON COLUMN "returns_items"."sale_item_id" IS 'Reference to the original sale item';
COMMENT ON COLUMN "returns_items"."condition" IS 'Condition of returned item (new, used, damaged)';

