CREATE TABLE "product_batches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"batch_number" varchar(100) NOT NULL,
	"received_date" timestamp NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"quantity_unit" varchar(20) NOT NULL,
	"expiration_date" timestamp,
	"supplier_name" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "created_by" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "substance_name" varchar(255);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "form" varchar(50);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "subtype" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "package_size" varchar(50);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "received_date" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "batch_number" varchar(100);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "quantity_unit" varchar(20);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "supplier_name" varchar(255);--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_batches" ADD CONSTRAINT "product_batches_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;