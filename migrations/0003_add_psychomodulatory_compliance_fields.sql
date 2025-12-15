-- Migration: Add psychomodulatory substance compliance fields to products table
-- Description: Adds required fields for distribution and sale compliance under current legal framework
-- Date: 2024

-- Add new compliance fields to products table
ALTER TABLE "products" 
  ADD COLUMN IF NOT EXISTS "recommended_dose_single" text,
  ADD COLUMN IF NOT EXISTS "recommended_dose_daily" text,
  ADD COLUMN IF NOT EXISTS "dosage_info" text,
  ADD COLUMN IF NOT EXISTS "warning_under18" text,
  ADD COLUMN IF NOT EXISTS "warning_health" text,
  ADD COLUMN IF NOT EXISTS "min_age" integer,
  ADD COLUMN IF NOT EXISTS "adult_only" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "consumer_info" text,
  ADD COLUMN IF NOT EXISTS "active_substances_composition" jsonb;

-- Add comments for documentation
COMMENT ON COLUMN "products"."recommended_dose_single" IS 'Recommended single dose (e.g. 2 g)';
COMMENT ON COLUMN "products"."recommended_dose_daily" IS 'Recommended daily dose (e.g. 4 g)';
COMMENT ON COLUMN "products"."dosage_info" IS 'Combined dose info in free text (alternative to recommended_dose_single and recommended_dose_daily)';
COMMENT ON COLUMN "products"."warning_under18" IS 'Legal text: "Not intended for persons under 18..."';
COMMENT ON COLUMN "products"."warning_health" IS 'Legal text: "Use of this product may harm your health..."';
COMMENT ON COLUMN "products"."min_age" IS 'Minimum age restriction (e.g. 18)';
COMMENT ON COLUMN "products"."adult_only" IS 'Age restriction flag indicating adult-only product';
COMMENT ON COLUMN "products"."consumer_info" IS 'Full consumer info (effects, risks, usage instructions)';
COMMENT ON COLUMN "products"."active_substances_composition" IS 'List of active substances (JSON format)';

