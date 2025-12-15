DROP TABLE IF EXISTS "stock_transactions" CASCADE;
DROP TABLE IF EXISTS "returns_items" CASCADE;
DROP TABLE IF EXISTS "returns" CASCADE;
DROP TABLE IF EXISTS "sales_items" CASCADE;
DROP TABLE IF EXISTS "product_active_substance" CASCADE;
DROP TABLE IF EXISTS "active_substances" CASCADE;
DROP TABLE IF EXISTS "product_batches" CASCADE;
DROP TABLE IF EXISTS "shopping_carts" CASCADE;
DROP TABLE IF EXISTS "category_stores" CASCADE;
DROP TABLE IF EXISTS "sales" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "product_categories" CASCADE;
DROP TABLE IF EXISTS "password_reset_tokens" CASCADE;
DROP TABLE IF EXISTS "user_settings" CASCADE;
DROP TABLE IF EXISTS "company_invitations" CASCADE;
DROP TABLE IF EXISTS "trusted_devices" CASCADE;
DROP TABLE IF EXISTS "activities" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "stores" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "companies" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
CREATE TABLE "companies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" varchar NOT NULL,
	"registration_number" varchar NOT NULL,
	"vat_number" varchar,
	"address" text NOT NULL,
	"email" varchar NOT NULL,
	"phone" varchar NOT NULL,
	"contact_person" varchar NOT NULL,
	"password" varchar,
	"is_active" boolean DEFAULT true,
	"license_status" varchar DEFAULT 'active',
	"max_branches" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar,
	CONSTRAINT "companies_registration_number_unique" UNIQUE("registration_number"),
	CONSTRAINT "companies_email_unique" UNIQUE("email")
);

CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(20),
	"profile_image_url" varchar(500),
	"password_hash" varchar(255),
	"role" varchar(20) DEFAULT 'manager' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"company_id" integer,
	"store_id" integer,
	"two_factor_secret" varchar(100),
	"two_factor_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "stores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" varchar NOT NULL,
	"address" text,
	"phone" varchar,
	"manager_id" varchar,
	"company_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"revenue" integer DEFAULT 0,
	"customer_count" integer DEFAULT 0,
	"product_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
CREATE TABLE "product_categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" varchar(100) NOT NULL,
	"description" text,
	"company_id" integer,
	"store_id" integer,
	"user_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "category_stores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"category_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "category_stores_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE CASCADE,
	CONSTRAINT "category_stores_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE,
	CONSTRAINT "category_stores_unique" UNIQUE("category_id", "store_id")
);

CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 2) DEFAULT '21.00' NOT NULL,
	"category" varchar(100),
	"category_id" integer,
	"barcode" varchar(50),
	"stock" integer DEFAULT 0 NOT NULL,
	"image_url" varchar(500),
	"store_id" integer,
	"company_id" integer,
	"is_active" boolean DEFAULT true,
	"substance_name" varchar(255),
	"form" varchar(50),
	"subtype" varchar(100),
	"package_size" varchar(50),
	"received_date" timestamp,
	"batch_number" varchar(100),
	"quantity_unit" varchar(20),
	"recommended_dose_single" text,
	"recommended_dose_daily" text,
	"dosage_info" text,
	"warning_under18" text,
	"warning_health" text,
	"min_age" integer,
	"adult_only" boolean DEFAULT false,
	"consumer_info" text,
	"active_substances_composition" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "product_batches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"batch_number" varchar(100) NOT NULL,
	"received_date" timestamp NOT NULL,
	"quantity" integer NOT NULL DEFAULT 0,
	"quantity_unit" varchar(20) NOT NULL,
	"expiration_date" timestamp,
	"supplier_name" varchar(255),
	"status" varchar(50) DEFAULT 'Pending',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "product_batches_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
	CONSTRAINT "product_batches_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE
);

CREATE TABLE "active_substances" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" varchar(255) NOT NULL,
	"max_single_dose" numeric(10, 3),
	"max_daily_dose" numeric(10, 3),
	"max_concentration" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "active_substances_name_unique" UNIQUE("name")
);

CREATE TABLE "product_active_substance" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"product_id" integer NOT NULL,
	"substance_id" integer NOT NULL,
	"content_amount" numeric(10, 3),
	"content_unit" varchar(20),
	"concentration" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "product_active_substance_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE,
	CONSTRAINT "product_active_substance_substance_id_fkey" FOREIGN KEY ("substance_id") REFERENCES "active_substances"("id") ON DELETE CASCADE,
	CONSTRAINT "product_active_substance_unique" UNIQUE("product_id", "substance_id")
);
CREATE TABLE "sales" (
	"id" varchar PRIMARY KEY NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"net_amount" numeric(10, 2),
	"total_vat" numeric(10, 2),
	"vat_breakdown" jsonb,
	"payment_method" varchar(20) NOT NULL,
	"items" jsonb NOT NULL,
	"is_cancelled" boolean DEFAULT false,
	"store_id" integer NOT NULL,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "sales_items" (
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

CREATE TABLE "returns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"sale_id" varchar NOT NULL,
	"return_date" timestamp NOT NULL DEFAULT now(),
	"reason" text,
	"total_refund" numeric(10, 2) NOT NULL,
	"refund_method" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending',
	"store_id" integer NOT NULL,
	"user_id" varchar,
	"processed_by" varchar,
	"processed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE RESTRICT,
	CONSTRAINT "returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT,
	CONSTRAINT "returns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
	CONSTRAINT "returns_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE "returns_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"return_id" integer NOT NULL,
	"sale_item_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"batch_id" integer,
	"quantity" numeric(10, 3) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 2) NOT NULL,
	"refund_amount" numeric(10, 2) NOT NULL,
	"reason" text,
	"condition" varchar(50),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "returns_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE,
	CONSTRAINT "returns_items_sale_item_id_fkey" FOREIGN KEY ("sale_item_id") REFERENCES "sales_items"("id") ON DELETE RESTRICT,
	CONSTRAINT "returns_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT,
	CONSTRAINT "returns_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "product_batches"("id") ON DELETE SET NULL
);

CREATE TABLE "stock_transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"batch_id" integer,
	"transaction_type" varchar(50) NOT NULL,
	"quantity_change" integer NOT NULL,
	"quantity_before" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"sale_id" varchar,
	"sale_item_id" integer,
	"return_id" integer,
	"return_item_id" integer,
	"reason" text,
	"notes" text,
	"user_id" varchar,
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

CREATE TABLE "shopping_carts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"user_id" varchar,
	"company_id" integer,
	"store_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer NOT NULL DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shopping_carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
	CONSTRAINT "shopping_carts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE,
	CONSTRAINT "shopping_carts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE,
	CONSTRAINT "shopping_carts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" varchar(100),
	"user_id" varchar,
	"user_email" varchar(255),
	"user_role" varchar(20),
	"store_id" integer,
	"company_id" integer,
	"ip_address" varchar(45),
	"user_agent" varchar(500),
	"description" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"metadata" jsonb,
	"severity" varchar(20) DEFAULT 'info',
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "activities" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"type" varchar NOT NULL,
	"description" text NOT NULL,
	"user_id" varchar,
	"store_id" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);

CREATE TABLE "trusted_devices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"user_id" varchar NOT NULL,
	"device_token" varchar(255) NOT NULL,
	"device_name" varchar(100),
	"user_agent" varchar(500),
	"ip_address" varchar(45),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "trusted_devices_device_token_unique" UNIQUE("device_token")
);

CREATE TABLE "password_reset_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"email" varchar(255) NOT NULL,
	"reset_token" varchar(255) NOT NULL,
	"user_type" varchar(20) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_reset_token_unique" UNIQUE("reset_token")
);
CREATE TABLE "company_invitations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"company_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"invitation_token" varchar(255) NOT NULL,
	"is_used" boolean DEFAULT false,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp,
	"created_by" varchar,
	CONSTRAINT "company_invitations_invitation_token_unique" UNIQUE("invitation_token")
);

CREATE TABLE "user_settings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"user_id" varchar,
	"company_id" integer,
	"settings_type" varchar(20) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(20),
	"profile_image_url" varchar(500),
	"timezone" varchar(50) DEFAULT 'Europe/Prague',
	"language" varchar(10) DEFAULT 'en',
	"currency" varchar(10) DEFAULT 'EUR',
	"email_notifications" boolean DEFAULT true,
	"sms_alerts" boolean DEFAULT false,
	"weekly_reports" boolean DEFAULT true,
	"store_alerts" boolean DEFAULT true,
	"session_timeout" integer DEFAULT 30,
	"require_uppercase" boolean DEFAULT true,
	"require_numbers" boolean DEFAULT true,
	"require_symbols" boolean DEFAULT false,
	"two_factor_enabled" boolean DEFAULT false,
	"two_factor_secret" varchar(100),
	"login_audit_trail" boolean DEFAULT true,
	"data_retention" integer DEFAULT 365,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
ALTER TABLE "companies" 
	ADD CONSTRAINT "companies_created_by_users_id_fk" 
	FOREIGN KEY ("created_by") REFERENCES "users"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "users" 
	ADD CONSTRAINT "users_company_id_companies_id_fk" 
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "stores" 
	ADD CONSTRAINT "stores_manager_id_users_id_fk" 
	FOREIGN KEY ("manager_id") REFERENCES "users"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "stores" 
	ADD CONSTRAINT "stores_company_id_companies_id_fk" 
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "product_categories" 
	ADD CONSTRAINT "product_categories_company_id_companies_id_fk" 
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "product_categories" 
	ADD CONSTRAINT "product_categories_store_id_stores_id_fk" 
	FOREIGN KEY ("store_id") REFERENCES "stores"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "products" 
	ADD CONSTRAINT "products_category_id_product_categories_id_fk" 
	FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "products" 
	ADD CONSTRAINT "products_store_id_stores_id_fk" 
	FOREIGN KEY ("store_id") REFERENCES "stores"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "products" 
	ADD CONSTRAINT "products_company_id_companies_id_fk" 
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
	ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "sales" 
	ADD CONSTRAINT "sales_store_id_stores_id_fk" 
	FOREIGN KEY ("store_id") REFERENCES "stores"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "sales" 
	ADD CONSTRAINT "sales_user_id_users_id_fk" 
	FOREIGN KEY ("user_id") REFERENCES "users"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "audit_logs" 
	ADD CONSTRAINT "audit_logs_store_id_stores_id_fk" 
	FOREIGN KEY ("store_id") REFERENCES "stores"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "audit_logs" 
	ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" 
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "activities" 
	ADD CONSTRAINT "activities_store_id_stores_id_fk" 
	FOREIGN KEY ("store_id") REFERENCES "stores"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "company_invitations" 
	ADD CONSTRAINT "company_invitations_company_id_companies_id_fk" 
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "company_invitations" 
	ADD CONSTRAINT "company_invitations_created_by_users_id_fk" 
	FOREIGN KEY ("created_by") REFERENCES "users"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "user_settings" 
	ADD CONSTRAINT "user_settings_user_id_users_id_fk" 
	FOREIGN KEY ("user_id") REFERENCES "users"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "user_settings" 
	ADD CONSTRAINT "user_settings_company_id_companies_id_fk" 
	FOREIGN KEY ("company_id") REFERENCES "companies"("id") 
	ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");

CREATE INDEX "idx_users_company_id" ON "users"("company_id");
CREATE INDEX "idx_users_store_id" ON "users"("store_id");

CREATE INDEX "idx_stores_company_id" ON "stores"("company_id");

CREATE INDEX "idx_products_store_id" ON "products"("store_id");
CREATE INDEX "idx_products_category_id" ON "products"("category_id");
CREATE INDEX "idx_products_company_id" ON "products"("company_id");

CREATE INDEX "idx_product_batches_product_id" ON "product_batches"("product_id");
CREATE INDEX "idx_product_batches_store_id" ON "product_batches"("store_id");
CREATE INDEX "idx_product_batches_batch_number" ON "product_batches"("batch_number");
CREATE INDEX "idx_product_batches_expiration_date" ON "product_batches"("expiration_date");
CREATE INDEX "idx_product_batches_status" ON "product_batches"("status");

CREATE INDEX "idx_active_substances_name" ON "active_substances"("name");

CREATE INDEX "idx_product_active_substance_product_id" ON "product_active_substance"("product_id");
CREATE INDEX "idx_product_active_substance_substance_id" ON "product_active_substance"("substance_id");
CREATE INDEX "idx_product_active_substance_unique" ON "product_active_substance"("product_id", "substance_id");

CREATE INDEX "IDX_category_stores_category" ON "category_stores"("category_id");
CREATE INDEX "IDX_category_stores_store" ON "category_stores"("store_id");

CREATE INDEX "idx_sales_store_id" ON "sales"("store_id");
CREATE INDEX "idx_sales_user_id" ON "sales"("user_id");
CREATE INDEX "idx_sales_created_at" ON "sales"("created_at");
CREATE INDEX "idx_sales_is_cancelled" ON "sales"("is_cancelled");

CREATE INDEX "idx_sales_items_sale_id" ON "sales_items"("sale_id");
CREATE INDEX "idx_sales_items_product_id" ON "sales_items"("product_id");
CREATE INDEX "idx_sales_items_batch_id" ON "sales_items"("batch_id");

CREATE INDEX "idx_returns_sale_id" ON "returns"("sale_id");
CREATE INDEX "idx_returns_store_id" ON "returns"("store_id");
CREATE INDEX "idx_returns_status" ON "returns"("status");
CREATE INDEX "idx_returns_return_date" ON "returns"("return_date");

CREATE INDEX "idx_returns_items_return_id" ON "returns_items"("return_id");
CREATE INDEX "idx_returns_items_sale_item_id" ON "returns_items"("sale_item_id");
CREATE INDEX "idx_returns_items_product_id" ON "returns_items"("product_id");

CREATE INDEX "idx_stock_transactions_product_id" ON "stock_transactions"("product_id");
CREATE INDEX "idx_stock_transactions_store_id" ON "stock_transactions"("store_id");
CREATE INDEX "idx_stock_transactions_transaction_type" ON "stock_transactions"("transaction_type");
CREATE INDEX "idx_stock_transactions_created_at" ON "stock_transactions"("created_at");
CREATE INDEX "idx_stock_transactions_sale_id" ON "stock_transactions"("sale_id");
CREATE INDEX "idx_stock_transactions_return_id" ON "stock_transactions"("return_id");
CREATE INDEX "idx_stock_transactions_batch_id" ON "stock_transactions"("batch_id");
CREATE INDEX "idx_stock_transactions_user_id" ON "stock_transactions"("user_id");

CREATE INDEX "IDX_cart_user_store" ON "shopping_carts"("user_id", "store_id");
CREATE INDEX "IDX_cart_company_store" ON "shopping_carts"("company_id", "store_id");
CREATE INDEX "IDX_cart_user_product" ON "shopping_carts"("user_id", "product_id");
CREATE UNIQUE INDEX "IDX_cart_user_store_product" ON "shopping_carts"("user_id", "store_id", "product_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "IDX_cart_company_store_product" ON "shopping_carts"("company_id", "store_id", "product_id") WHERE "company_id" IS NOT NULL;

CREATE INDEX "idx_audit_logs_company_id" ON "audit_logs"("company_id");
CREATE INDEX "idx_audit_logs_store_id" ON "audit_logs"("store_id");
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");

CREATE INDEX "idx_activities_user_id" ON "activities"("user_id");
CREATE INDEX "idx_activities_store_id" ON "activities"("store_id");

CREATE INDEX "IDX_password_reset_token" ON "password_reset_tokens"("reset_token");
CREATE INDEX "IDX_password_reset_email" ON "password_reset_tokens"("email");
CREATE INDEX "IDX_password_reset_expires" ON "password_reset_tokens"("expires_at");
