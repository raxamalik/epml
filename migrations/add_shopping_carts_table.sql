-- Migration: Add shopping_carts table
-- Description: Stores shopping cart items for users per store. 
--   - Each user can have a separate cart per store
--   - Cart items are automatically cleaned up when user, store, or product is deleted
-- Date: 2024

-- Step 1: Create shopping_carts table
CREATE TABLE IF NOT EXISTS "shopping_carts" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "store_id" integer NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  "product_id" integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  "quantity" integer NOT NULL DEFAULT 1,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "IDX_cart_user_store" 
  ON "shopping_carts"("user_id", "store_id");

CREATE INDEX IF NOT EXISTS "IDX_cart_user_product" 
  ON "shopping_carts"("user_id", "product_id");

-- Step 3: Create unique constraint to prevent duplicate items in cart
-- This ensures a user can only have one cart entry per product per store
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_user_store_product" 
  ON "shopping_carts"("user_id", "store_id", "product_id");

-- Step 4: Add comments for documentation
COMMENT ON TABLE "shopping_carts" IS 
  'Stores shopping cart items for users per store. Each user can have separate carts for different stores.';

COMMENT ON COLUMN "shopping_carts"."user_id" IS 
  'User ID who owns this cart item';

COMMENT ON COLUMN "shopping_carts"."store_id" IS 
  'Store ID where this cart item belongs';

COMMENT ON COLUMN "shopping_carts"."product_id" IS 
  'Product ID in the cart';

COMMENT ON COLUMN "shopping_carts"."quantity" IS 
  'Quantity of the product in the cart';

