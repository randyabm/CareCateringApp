-- Sync meal_services to diet_codes table
-- This ensures meal services are available in diet_codes with category 'meal_service'
-- which is required for the catering form to work

-- Function to sync a single meal service to diet_codes
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
        -- Update existing diet_code
        UPDATE diet_codes
        SET 
            name = NEW.name,
            description = NEW.description,
            is_active = NEW.is_active
        WHERE id = diet_code_id;
    ELSE
        -- Insert new diet_code
        INSERT INTO diet_codes (code, name, category, description, is_active)
        VALUES (NEW.code, NEW.name, 'meal_service', NEW.description, NEW.is_active);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove diet_code when meal_service is deleted
CREATE OR REPLACE FUNCTION remove_meal_service_from_diet_codes()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM diet_codes
    WHERE code = OLD.code AND category = 'meal_service';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to sync meal_services to diet_codes
DROP TRIGGER IF EXISTS trg_sync_meal_service_insert ON meal_services;
CREATE TRIGGER trg_sync_meal_service_insert
    AFTER INSERT ON meal_services
    FOR EACH ROW
    EXECUTE FUNCTION sync_meal_service_to_diet_code();

DROP TRIGGER IF EXISTS trg_sync_meal_service_update ON meal_services;
CREATE TRIGGER trg_sync_meal_service_update
    AFTER UPDATE ON meal_services
    FOR EACH ROW
    WHEN (OLD.code IS DISTINCT FROM NEW.code OR 
          OLD.name IS DISTINCT FROM NEW.name OR 
          OLD.description IS DISTINCT FROM NEW.description OR 
          OLD.is_active IS DISTINCT FROM NEW.is_active)
    EXECUTE FUNCTION sync_meal_service_to_diet_code();

DROP TRIGGER IF EXISTS trg_remove_meal_service_delete ON meal_services;
CREATE TRIGGER trg_remove_meal_service_delete
    AFTER DELETE ON meal_services
    FOR EACH ROW
    EXECUTE FUNCTION remove_meal_service_from_diet_codes();

-- Sync existing meal_services to diet_codes (one-time migration)
INSERT INTO diet_codes (code, name, category, description, is_active)
SELECT 
    ms.code,
    ms.name,
    'meal_service'::diet_category,
    ms.description,
    ms.is_active
FROM meal_services ms
WHERE NOT EXISTS (
    SELECT 1 FROM diet_codes dc 
    WHERE dc.code = ms.code AND dc.category = 'meal_service'
)
ON CONFLICT (code) DO UPDATE
SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active;

-- Add RLS policy to allow ward users (nurses) to read meal_services
-- This is needed if we want to read directly from meal_services table in the future
DROP POLICY IF EXISTS "Ward users read active meal services" ON meal_services;
CREATE POLICY "Ward users read active meal services" ON meal_services
    FOR SELECT
    USING (
        is_active = true AND
        (
            -- Allow admins
            EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'admin'
            )
            OR
            -- Allow authenticated users (nurses, store_man, kitchen_staff)
            auth.role() IS NOT NULL
        )
    );

