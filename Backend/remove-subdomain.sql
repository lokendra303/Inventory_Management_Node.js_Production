-- Remove subdomain column from tenants table
ALTER TABLE tenants DROP COLUMN IF EXISTS subdomain;

-- Show table structure to verify
DESCRIBE tenants;