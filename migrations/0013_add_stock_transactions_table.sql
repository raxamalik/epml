-- Migration: Create stock_transactions table
-- Description: Creates a comprehensive table to track all stock movements (increases and decreases) with complete audit trail
-- Date: 2024

-- Create stock_transactions table
CREATE TABLE IF NOT EXISTS "stock_transactions" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "product_id" integer NOT NULL,
  "store_id" integer NOT NULL,
  "batch_id" integer,
  
  -- Transaction details
  "transaction_type" varchar(50) NOT NULL, -- 'sale', 'return', 'adjustment', 'transfer_in', 'transfer_out', 'received', 'damaged', 'expired', 'cancelled'
  "quantity_change" integer NOT NULL, -- Positive for increases, negative for decreases
  "quantity_before" integer NOT NULL, -- Stock level before transaction
  "quantity_after" integer NOT NULL, -- Stock level after transaction
  
  -- References to related entities
  "sale_id" varchar, -- If transaction is from a sale
  "sale_item_id" integer, -- Specific sale item
  "return_id" integer, -- If transaction is from a return
  "return_item_id" integer, -- Specific return item
  
  -- Metadata
  "reason" text, -- Reason for adjustment/transfer/etc.
  "notes" text, -- Additional notes
  "user_id" varchar, -- Who performed the transaction
  "created_at" timestamp DEFAULT now() NOT NULL,
  
  CONSTRAINT "stock_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "stock_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT,
  CONSTRAINT "stock_transactions_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL,
  CONSTRAINT "stock_transactions_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL,
  CONSTRAINT "stock_transactions_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sales_items"("id") ON DELETE SET NULL,
  CONSTRAINT "stock_transactions_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE SET NULL,
  CONSTRAINT "stock_transactions_return_item_id_fkey" FOREIGN KEY ("return_item_id") REFERENCES "returns_items"("id") ON DELETE SET NULL,
  CONSTRAINT "stock_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_product_id" ON "stock_transactions"("product_id");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_store_id" ON "stock_transactions"("store_id");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_transaction_type" ON "stock_transactions"("transaction_type");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_created_at" ON "stock_transactions"("created_at");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_sale_id" ON "stock_transactions"("sale_id");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_return_id" ON "stock_transactions"("return_id");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_batch_id" ON "stock_transactions"("batch_id");
CREATE INDEX IF NOT EXISTS "idx_stock_transactions_user_id" ON "stock_transactions"("user_id");

-- Add comments for documentation
COMMENT ON TABLE "stock_transactions" IS 'Tracks all stock movements (increases and decreases) with complete audit trail';
COMMENT ON COLUMN "stock_transactions"."product_id" IS 'Product whose stock changed';
COMMENT ON COLUMN "stock_transactions"."store_id" IS 'Store where the transaction occurred';
COMMENT ON COLUMN "stock_transactions"."batch_id" IS 'Specific batch affected (nullable)';
COMMENT ON COLUMN "stock_transactions"."transaction_type" IS 'Type of transaction: sale, return, adjustment, transfer_in, transfer_out, received, damaged, expired, cancelled';
COMMENT ON COLUMN "stock_transactions"."quantity_change" IS 'Change in quantity (positive for increases, negative for decreases)';
COMMENT ON COLUMN "stock_transactions"."quantity_before" IS 'Stock level before this transaction';
COMMENT ON COLUMN "stock_transactions"."quantity_after" IS 'Stock level after this transaction';
COMMENT ON COLUMN "stock_transactions"."sale_id" IS 'Reference to sale if transaction is from a sale';
COMMENT ON COLUMN "stock_transactions"."sale_item_id" IS 'Reference to specific sale item';
COMMENT ON COLUMN "stock_transactions"."return_id" IS 'Reference to return if transaction is from a return';
COMMENT ON COLUMN "stock_transactions"."return_item_id" IS 'Reference to specific return item';
COMMENT ON COLUMN "stock_transactions"."reason" IS 'Reason for adjustment/transfer/etc.';
COMMENT ON COLUMN "stock_transactions"."notes" IS 'Additional notes about the transaction';
COMMENT ON COLUMN "stock_transactions"."user_id" IS 'User who performed the transaction';

