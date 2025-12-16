-- Migration: Add company_logo column to companies table
-- Description: Adds a column to store the URL of the company logo image
-- Date: 2024

-- Add company_logo column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_logo varchar;

-- Add comment for documentation
COMMENT ON COLUMN companies.company_logo IS 'URL to the company logo image stored in Cloudflare R2';

