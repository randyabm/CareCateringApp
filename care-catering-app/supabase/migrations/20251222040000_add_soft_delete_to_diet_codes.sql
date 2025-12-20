-- Add soft delete support to diet_codes table
-- This allows diet codes (primary_diet, allergy, dislike, intolerance) to be logically deleted
-- while preserving historical data and preventing broken references in existing orders

-- Add deleted_at column to track when a diet code was deleted
ALTER TABLE diet_codes 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create partial unique index to allow soft-deleted items to have the same code
-- This ensures active diet codes have unique codes, but deleted ones can be reused
-- Note: The unique constraint is on (code, category) combination for active records
DROP INDEX IF EXISTS idx_diet_codes_code_category_unique_active;
CREATE UNIQUE INDEX idx_diet_codes_code_category_unique_active 
ON diet_codes(code, category) 
WHERE deleted_at IS NULL;

-- Drop the old unique constraint on code if it exists
DO $$
BEGIN
    -- Try to drop the unique constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'diet_codes_code_key' 
        AND conrelid = 'diet_codes'::regclass
    ) THEN
        ALTER TABLE diet_codes DROP CONSTRAINT diet_codes_code_key;
    END IF;
END $$;

-- Add comment explaining the soft delete mechanism
COMMENT ON COLUMN diet_codes.deleted_at IS 'Timestamp when the diet code was soft deleted. NULL means the diet code is active. Soft deleted diet codes are preserved for historical data integrity.';

-- Update RLS policies to exclude deleted diet codes for non-admin users
-- Replace the existing "Read diet codes" policy with separate policies for clarity

-- Drop the existing read policy
DROP POLICY IF EXISTS "Read diet codes" ON diet_codes;
DROP POLICY IF EXISTS "Users can read active diet codes" ON diet_codes;
DROP POLICY IF EXISTS "Admin read all diet codes" ON diet_codes;
DROP POLICY IF EXISTS "Users read active diet codes" ON diet_codes;

-- Policy 1: Admins can see all diet codes (including deleted)
CREATE POLICY "Admin read all diet codes" ON diet_codes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Regular authenticated users can see active, non-deleted diet codes
CREATE POLICY "Users read active diet codes" ON diet_codes
    FOR SELECT
    USING (
        auth.role() IS NOT NULL
        AND is_active = true 
        AND deleted_at IS NULL
        AND NOT EXISTS (
            -- Exclude if user is admin (to avoid duplicate results)
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

