-- Add soft delete support to meal_services table
-- This allows meal services to be logically deleted (is_active = false, deleted_at set)
-- while preserving historical data and preventing broken references in existing orders

-- Add deleted_at column to track when a meal service was deleted
ALTER TABLE meal_services 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create partial unique index to allow soft-deleted items to have the same code
-- This ensures active meal services have unique codes, but deleted ones can be reused
DROP INDEX IF EXISTS idx_meal_services_code_unique_active;
CREATE UNIQUE INDEX idx_meal_services_code_unique_active 
ON meal_services(code) 
WHERE deleted_at IS NULL;

-- Drop the old unique constraint on code if it exists (it might be a constraint, not an index)
-- We'll handle uniqueness through the partial index above
DO $$
BEGIN
    -- Try to drop the unique constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'meal_services_code_key' 
        AND conrelid = 'meal_services'::regclass
    ) THEN
        ALTER TABLE meal_services DROP CONSTRAINT meal_services_code_key;
    END IF;
END $$;

-- Update the sync function to handle soft deletes
-- When a meal service is soft deleted (is_active = false), also soft delete the corresponding diet_code
CREATE OR REPLACE FUNCTION sync_meal_service_to_diet_code()
RETURNS TRIGGER AS $$
DECLARE
    diet_code_id BIGINT;
BEGIN
    -- Check if a diet_code already exists for this meal service (by code)
    SELECT id INTO diet_code_id
    FROM diet_codes
    WHERE code = NEW.code AND category = 'meal_service';
    
    IF diet_code_id IS NOT NULL THEN
        -- Update existing diet_code (sync is_active status)
        UPDATE diet_codes
        SET 
            name = NEW.name,
            description = NEW.description,
            is_active = NEW.is_active
        WHERE id = diet_code_id;
    ELSE
        -- Insert new diet_code only if meal service is not deleted
        IF NEW.deleted_at IS NULL THEN
            INSERT INTO diet_codes (code, name, category, description, is_active)
            VALUES (NEW.code, NEW.name, 'meal_service', NEW.description, NEW.is_active);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Replace the DELETE trigger with an UPDATE trigger for soft delete
-- When is_active is set to false and deleted_at is set, treat it as a soft delete
DROP TRIGGER IF EXISTS trg_remove_meal_service_delete ON meal_services;
DROP TRIGGER IF EXISTS trg_soft_delete_meal_service ON meal_services;

-- Create trigger to handle soft delete (when is_active becomes false and deleted_at is set)
CREATE TRIGGER trg_soft_delete_meal_service
    AFTER UPDATE ON meal_services
    FOR EACH ROW
    WHEN (
        OLD.deleted_at IS NULL 
        AND NEW.deleted_at IS NOT NULL
        AND NEW.is_active = false
    )
    EXECUTE FUNCTION sync_meal_service_to_diet_code();

-- Update the sync trigger to also handle soft delete status changes
DROP TRIGGER IF EXISTS trg_sync_meal_service_update ON meal_services;
CREATE TRIGGER trg_sync_meal_service_update
    AFTER UPDATE ON meal_services
    FOR EACH ROW
    WHEN (
        OLD.code IS DISTINCT FROM NEW.code OR 
        OLD.name IS DISTINCT FROM NEW.name OR 
        OLD.description IS DISTINCT FROM NEW.description OR 
        OLD.is_active IS DISTINCT FROM NEW.is_active OR
        OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
    )
    EXECUTE FUNCTION sync_meal_service_to_diet_code();

-- Add comment explaining the soft delete mechanism
COMMENT ON COLUMN meal_services.deleted_at IS 'Timestamp when the meal service was soft deleted. NULL means the meal service is active. Soft deleted meal services are preserved for historical data integrity.';

-- Update RLS policy to exclude deleted meal services for non-admin users
DROP POLICY IF EXISTS "Ward users read active meal services" ON meal_services;
CREATE POLICY "Ward users read active meal services" ON meal_services
    FOR SELECT
    USING (
        is_active = true 
        AND deleted_at IS NULL
        AND (
            -- Allow admins to see all (including deleted if needed)
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'admin'
            )
            OR
            -- Allow authenticated users (nurses, store_man, kitchen_staff) to see only non-deleted active items
            auth.role() IS NOT NULL
        )
    );

