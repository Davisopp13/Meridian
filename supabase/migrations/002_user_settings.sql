-- Add settings JSONB column to platform_users
-- Defaults are handled in application code (DEFAULT_SETTINGS in constants.js)
ALTER TABLE platform_users
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT NULL;
